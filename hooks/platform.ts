// 운영체제별로 다른 명령만 여기 모은다 (순수 함수: 실행은 register.tsx 가 한다)
//   cswap 위치 후보 · 설치 명령 · 전역 감시(`cswap auto`) 확인·켜기·끄기
export type Os = 'mac' | 'linux' | 'windows'
export type Argv = readonly string[]

const JOB = 'cswap-status.auto' // launchd 레이블
const UNIT = 'cswap-status-auto' // systemd --user 유닛

/** `OS` 환경변수와 `uname -s` 출력으로 운영체제를 정한다 */
export function osFrom(envOs: string | undefined, uname: string | undefined): Os {
  if (envOs === 'Windows_NT') return 'windows'
  return uname?.includes('Darwin') ? 'mac' : 'linux'
}

/** PATH 의 cswap, 그다음 uv·pipx 기본 설치 위치 */
export function cswapCandidates(os: Os, home: string): string[] {
  return os === 'windows'
    ? ['cswap', `${home}\\.local\\bin\\cswap.exe`]
    : ['cswap', `${home}/.local/bin/cswap`]
}

/** 앞에서부터 시도: 설치 도구가 없으면(실행 실패) 다음 것으로 */
export const INSTALLERS: Argv[] = [
  ['uv', 'tool', 'install', 'claude-swap'],
  ['pipx', 'install', 'claude-swap'],
]
export const NO_INSTALLER = 'uv 또는 pipx 가 필요합니다 — https://docs.astral.sh/uv/ 설치 후 다시 누르세요'

const sh = (script: string): Argv => ['/bin/sh', '-c', script]
const ps = (script: string): Argv => ['powershell', '-NoProfile', '-NonInteractive', '-Command', script]
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const psq = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Windows: `cswap auto` 로 끝나는 명령줄 (`--once`·`--dry-run` 은 제외) */
export const WIN_AUTO = /cswap(\.exe)?["']?\s+auto\s*$/
const WIN_MATCH = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '${WIN_AUTO.source.replace(/'/g, "''")}' }`

export type WatchCommands = {
  /** 종료 코드 0 이면 어디서 띄웠든 `cswap auto` 가 돌고 있다 */
  check: Argv
  /**
   * 전역 감시를 하나 띄운다. Claude Code 와 무관하게 살고, 어느 세션에서 켜든 같은 하나다.
   * mac: launchd 작업 · linux: systemd --user 임시 유닛 (없으면 setsid nohup) · windows: 숨김 프로세스
   */
  start: Argv
  /** 이 mod 가 띄운 것과 사람이 터미널에서 띄운 `cswap auto` 를 모두 멈춘다 */
  stop: Argv
}

export function watchCommands(os: Os, cswap: string): WatchCommands {
  if (os === 'windows') {
    return {
      check: ps(`if (${WIN_MATCH}) { exit 0 } else { exit 1 }`),
      start: ps(
        `$log = Join-Path $env:LOCALAPPDATA 'cswap-auto'; New-Item -ItemType Directory -Force $log | Out-Null; ` +
          `Start-Process -FilePath ${psq(cswap)} -ArgumentList 'auto' -WindowStyle Hidden ` +
          `-RedirectStandardOutput (Join-Path $log 'out.log') -RedirectStandardError (Join-Path $log 'err.log')`,
      ),
      // uv 의 cswap.exe 는 python 을 자식으로 띄우므로 트리째 끈다
      stop: ps(`${WIN_MATCH} | ForEach-Object { taskkill /T /F /PID $_.ProcessId | Out-Null }`),
    }
  }

  // pgrep/pkill 의 패턴은 끝이 `auto` 여야 한다: 이 sh 들의 명령줄은 auto 로 끝나지 않으니 자기 자신은 안 걸린다
  const check = sh("pgrep -f 'cswap auto$' >/dev/null")
  if (os === 'mac') {
    const log = '"$HOME/Library/Logs/cswap-auto.log"'
    return {
      check,
      start: sh(`launchctl remove ${JOB} 2>/dev/null; launchctl submit -l ${JOB} -o ${log} -e ${log} -- ${q(cswap)} auto; true`),
      stop: sh(`launchctl remove ${JOB} 2>/dev/null; pkill -f 'cswap auto$'; true`),
    }
  }
  const log = '"${XDG_STATE_HOME:-$HOME/.local/state}/cswap-auto.log"'
  return {
    check,
    start: sh(
      `systemctl --user reset-failed ${UNIT} 2>/dev/null; ` +
        `if command -v systemd-run >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then ` +
        `systemd-run --user --quiet --unit=${UNIT} -p Restart=on-failure ${q(cswap)} auto; ` +
        `else mkdir -p "$(dirname ${log})"; nohup setsid ${q(cswap)} auto >>${log} 2>&1 </dev/null & fi; true`,
    ),
    stop: sh(`systemctl --user stop ${UNIT} 2>/dev/null; pkill -f 'cswap auto$'; true`),
  }
}
