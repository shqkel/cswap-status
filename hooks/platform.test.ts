import { test, expect } from 'claude-code/testing'
// Windows 감시 프로세스 판별 정규식 (platform.ts 의 WIN_MATCH 와 같은 패턴)
test('Windows: cswap auto 로 끝나는 명령줄만 감시로 본다', async () => {
  const re = /cswap(\.exe)?["']?\s+auto\s*$/
  expect(re.test('"C:\\Users\\a\\.local\\bin\\cswap.exe" auto')).toBe(true)
  expect(re.test('C:\\Python\\python.exe C:\\Users\\a\\.local\\bin\\cswap auto')).toBe(true)
  expect(re.test('cswap.exe auto --once')).toBe(false)
  expect(re.test('cswap.exe auto --dry-run')).toBe(false)
})

import { osFrom, watchCommands } from './platform'

test('운영체제 판별', async () => {
  expect(osFrom('Windows_NT', undefined)).toBe('windows')
  expect(osFrom(undefined, 'Darwin\n')).toBe('mac')
  expect(osFrom(undefined, 'Linux\n')).toBe('linux')
})

test('mac·linux 의 감시 명령은 자기 자신이 pgrep 패턴에 걸리지 않는다', async () => {
  for (const os of ['mac', 'linux'] as const) {
    const c = watchCommands(os, "/home/o'neil/.local/bin/cswap")
    for (const argv of [c.check, c.start, c.stop]) expect(/cswap auto$/.test(argv.join(' '))).toBe(false)
  }
  expect(watchCommands('mac', '/x/cswap').start.join(' ')).toContain('launchctl submit')
  expect(watchCommands('linux', '/x/cswap').start.join(' ')).toContain('systemd-run --user')
})

test('windows 감시 명령은 powershell 로 돈다', async () => {
  const c = watchCommands('windows', 'C:\\Users\\a\\.local\\bin\\cswap.exe')
  expect(c.start[0]).toBe('powershell')
  expect(c.start.join(' ')).toContain("Start-Process -FilePath 'C:\\Users\\a\\.local\\bin\\cswap.exe' -ArgumentList 'auto'")
  expect(c.stop.join(' ')).toContain('taskkill /T /F')
})
