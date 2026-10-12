import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import { parseAccounts, tone } from './format'
import { INSTALLERS, NO_INSTALLER, cswapCandidates, osFrom, watchCommands } from './platform'
import type { Argv, Os } from './platform'

const PERIOD_MS = 60_000

const accounts = atom({ plugin: 'cswap-status', key: 'accounts' } as const, [])
const shown = atom({ plugin: 'cswap-status', key: 'shown' } as const, 0)
const busy = atom({ plugin: 'cswap-status', key: 'busy' } as const, false)
// `cswap auto` 전역 감시가 돌고 있는지 (refresh 마다 다시 확인)
const watching = atom({ plugin: 'cswap-status', key: 'watching' } as const, false)
// cswap 설치 상태: 'unknown' 확인 전 · 'missing' 미설치 · 'ready' 사용 가능
const setup = atom({ plugin: 'cswap-status', key: 'setup' } as const, 'unknown')

type Platform = { os: Os; cswap: string | null }

// 운영체제와 cswap 위치. 세션 시작·설치 직후에 다시 찾는다
let plat: Platform | null = null

// 실행 자체가 안 되면(명령 없음 등) null
async function tryRun($: EngineInterface, argv: Argv, timeoutMs = 15_000) {
  try {
    return await $.process.run(argv, { timeoutMs })
  } catch {
    return null
  }
}

async function detect($: EngineInterface): Promise<Platform> {
  const envOs = await $.env.get('OS')
  const uname = envOs === 'Windows_NT' ? undefined : (await tryRun($, ['uname', '-s']))?.stdout
  const os = osFrom(envOs, uname)
  const home = (os === 'windows' ? await $.env.get('USERPROFILE') : await $.env.get('HOME')) ?? ''
  for (const c of cswapCandidates(os, home)) {
    if ((await tryRun($, [c, '--version']))?.exitCode === 0) return { os, cswap: c }
  }
  return { os, cswap: null }
}

async function ensurePlatform($: EngineInterface) {
  plat ??= await detect($)
  const found = plat.cswap
  await update($, setup, () => (found ? 'ready' : 'missing'))
  return plat
}

async function checkWatching($: EngineInterface, p: Platform) {
  if (!p.cswap) return false
  return (await tryRun($, watchCommands(p.os, p.cswap).check))?.exitCode === 0
}

async function setWatch($: EngineInterface, p: Platform, on: boolean) {
  if (!p.cswap) return false
  const cmds = watchCommands(p.os, p.cswap)
  if (on && (await checkWatching($, p))) return true // 이미 하나 돌고 있으면 또 띄우지 않는다
  await tryRun($, on ? cmds.start : cmds.stop, 30_000)
  return (await checkWatching($, p)) === on
}

// uv → pipx 순으로 claude-swap 을 설치한다
async function install($: EngineInterface) {
  for (const argv of INSTALLERS) {
    const r = await tryRun($, argv, 300_000)
    if (!r) continue // 설치 도구 자체가 없음
    const tail = (r.stdout + r.stderr).trim().split('\n').pop() ?? ''
    return `${argv[0]}: ${tail}`
  }
  return NO_INSTALLER
}

// 목록을 새로 읽고, 활성 계정이 바뀌었으면 그 계정을 보여준다
async function refresh($: EngineInterface) {
  const p = await ensurePlatform($)
  if (!p.cswap) return
  void checkWatching($, p).then(on => update($, watching, () => on))
  try {
    const { exitCode, stdout } = await $.process.run([p.cswap, 'list', '--json'], { timeoutMs: 20_000 })
    if (exitCode !== 0) return
    const list = parseAccounts(stdout)
    const before = (await read($, accounts)).find(a => a.active)
    const active = list.find(a => a.active)
    await update($, accounts, () => list)
    if (before?.number !== active?.number) {
      await update($, shown, () => Math.max(list.findIndex(a => a.active), 0))
    }
  } catch {
    // 다음 주기에 다시 시도
  }
}

// `auto --once` 는 종료 코드가 결과: 0 전환 · 1 오류 · 2 전환 불필요 · 3 전환할 계정 없음
const AUTO_EXIT: Record<number, string> = { 0: '전환함', 1: '오류', 2: '전환 불필요', 3: '전환할 계정 없음' }

function outcome(args: string[], exitCode: number, stdout: string, stderr: string) {
  const last = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').pop()?.replace(/^\d\d:\d\d:\d\d\s+/, '')
  const detail = last(stdout) || last(stderr)
  if (args[0] === 'auto') return [AUTO_EXIT[exitCode] ?? `종료 코드 ${exitCode}`, detail].filter(Boolean).join(' — ')
  return detail || (exitCode === 0 ? '완료' : '실패')
}

// 버튼 하나의 작업: 실행 중엔 다른 버튼을 막고, 끝나면 결과를 토스트로 알리고 다시 읽는다
async function task($: EngineInterface, label: string, work: (p: Platform) => Promise<string>) {
  if (await read($, busy)) return
  await update($, busy, () => true)
  try {
    $.ui.toast(`${label}: ${await work(await ensurePlatform($))}`)
  } catch {
    $.ui.toast(`${label}: 실행 실패`)
  } finally {
    await update($, busy, () => false)
    await refresh($)
  }
}

const runCswap = ($: EngineInterface, args: string[], label: string) =>
  task($, label, async p => {
    if (!p.cswap) return 'cswap 이 설치되어 있지 않습니다'
    const { exitCode, stdout, stderr } = await $.process.run([p.cswap, ...args], { timeoutMs: 60_000 })
    return outcome(args, exitCode, stdout, stderr)
  })

const toggleWatch = ($: EngineInterface) =>
  task($, 'auto', async p =>
    (await read($, watching))
      ? (await setWatch($, p, false)) ? '전역 감시 끔' : '감시를 끄지 못했습니다'
      : (await setWatch($, p, true)) ? '전역 감시 켬 — 60초마다 확인, 90% 넘으면 전환' : '감시를 켜지 못했습니다',
  )

const installCswap = ($: EngineInterface) =>
  task($, 'install', async () => {
    const message = await install($)
    plat = null // 설치 위치를 다시 찾는다
    return message
  })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    void refresh($)
    $.clock.every(PERIOD_MS, () => refresh($))
    return result
  })

  // 터미널에서 cswap 을 직접 실행하면 바로 반영
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    if (/\bcswap\b/.test(e.command)) $.clock.after(3_000, () => refresh($))
    return next(e)
  }).catch((_$, e, next) => next(e))

  // 프롬프트 바로 위 띠 오른쪽
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const row = await widget($, $.ui.resolve(e))
    if (!row) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box justifyContent="flex-end">{row}</Box>
  })
}

type Els = ReturnType<EngineInterface['ui']['resolve']>

// ◀ 계정 5h n% · 7d n% ▶  switch aut○  (aut = --once, ○/● = 전역 감시 토글)
async function widget($: EngineInterface, { Button, Text }: Els) {
  const state = await read($, setup)
  const isBusy = await read($, busy)

  if (state === 'unknown') return null
  if (state === 'missing') {
    return [
      <Text dimColor>cswap 미설치 </Text>,
      <Button key="install" plain label={isBusy ? '설치 중…' : 'install'} onPress={() => installCswap($)} />,
    ]
  }

  const list = await read($, accounts)
  const acc = list[(await read($, shown)) % Math.max(list.length, 1)]
  if (!acc) {
    return [
      <Text dimColor>cswap 계정 없음 </Text>,
      <Button key="add" plain label={isBusy ? '…' : 'add'} onPress={() => runCswap($, ['add'], 'add')} />,
      <Text dimColor> (지금 로그인한 계정을 등록)</Text>,
    ]
  }

  const isWatching = await read($, watching)
  const step = (d: number) => () => { void update($, shown, n => (n + d + list.length) % list.length) }
  // 보고 있는 계정이 활성 계정이면 다음 계정으로, 아니면 그 계정으로 전환
  const switchArgs = acc.active ? ['switch'] : ['switch', String(acc.number)]

  return [
    <Button key="prev" plain dimColor label="◀" onPress={step(-1)} />,
    <Text> </Text>,
    <Text bold={acc.active} color={acc.active ? 'claude' : undefined} dimColor={!acc.active}>{acc.name}</Text>,
    ...acc.usage.map((u, k) => (
      <Text>
        <Text dimColor>{k === 0 ? ' ' : ' · '}{u.label} </Text>
        <Text color={tone(u.pct)}>{u.pct}%</Text>
      </Text>
    )),
    <Text> </Text>,
    <Button key="next" plain dimColor label="▶" onPress={step(1)} />,
    <Text>  </Text>,
    <Button key="switch" plain dimColor label={isBusy ? '…' : 'switch'} onPress={() => runCswap($, switchArgs, 'switch')} />,
    <Text> </Text>,
    <Button key="auto" plain dimColor label="aut" onPress={() => runCswap($, ['auto', '--once'], 'auto')} />,
    // 전역 감시 토글: 켜지면 초록 ●
    isWatching
      ? <Button key="watch" plain onPress={() => toggleWatch($)}><Text color="success" bold>●</Text></Button>
      : <Button key="watch" plain dimColor label="○" onPress={() => toggleWatch($)} />,
  ]
}
