import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const LIST = JSON.stringify({
  accounts: [
    { number: 1, email: 'alice@example.com', active: true, usage: { fiveHour: { pct: 5 }, sevenDay: { pct: 92 } } },
    { number: 2, email: 'b@y.com', alias: 'shqkel', active: false, usage: { fiveHour: { pct: 0 } } },
  ],
})
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 },
} as const
const ok = (stdout: string, exitCode = 0) =>
  ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const wait = (ms: number) =>
  new Promise<void>(r => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(r, ms))

// 세션을 시작시키고, refresh 가 비동기로 끝날 때까지 잠깐 기다린다
async function start($: Engine, on: On,
  run: (argv: readonly string[]) => ReturnType<typeof ok>) {
  on('process.run', (_$, e) => run(e.argv))
  on('env.get', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('clock.every', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
  await wait(50)
}

test('설치돼 있으면 계정 띠가 그려지고 ▶ 로 다음 계정이 보인다', async ($, on) => {
  await start($, on, argv => (argv[0] === 'uname' ? ok('Darwin') : ok(argv.includes('--json') ? LIST : '')))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cswap-status', surface, ...BAND } as never)
    expect(await ui.find({ type: 'Text', text: /alice/ })).toBeDefined()
    await ui.press({ key: 'next' })
    expect(await ui.find({ type: 'Text', text: /shqkel/ })).toBeDefined()
    await ui.press({ key: 'prev' })
    await ui.unmount()
  }
})

test('cswap 이 없으면 install 버튼을 보여준다', async ($, on) => {
  await start($, on, argv => (argv[0] === 'uname' ? ok('Linux') : ok('', 127)))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cswap-status', surface, ...BAND } as never)
    expect(await ui.find({ type: 'Text', text: /cswap 미설치/ })).toBeDefined()
    await ui.unmount()
  }
})

test('계정이 없으면 add 버튼을 보여준다', async ($, on) => {
  await start($, on, argv =>
    argv[0] === 'uname' ? ok('Linux') : ok(argv.includes('--json') ? JSON.stringify({ accounts: [] }) : ''))
  const ui = await $.ui.mount({ plugin: 'cswap-status', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /계정 없음/ })).toBeDefined()
  await ui.unmount()
})
