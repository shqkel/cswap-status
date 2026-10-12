import { test, expect } from 'claude-code/testing'
import { parseAccounts, tone } from './format'

test('cswap list --json 을 계정별 사용량으로 바꾼다', async () => {
  const json = JSON.stringify({
    accounts: [
      { number: 1, email: 'alice@example.com', active: true,
        usage: { fiveHour: { pct: 5 }, sevenDay: { pct: 25.4 }, scoped: [{ name: 'Fable', pct: 0 }] } },
      { number: 2, email: 'b@y.com', alias: 'home', active: false, usage: { fiveHour: { pct: 0 } } },
    ],
  })
  expect(parseAccounts(json)).toEqual([
    { number: 1, name: 'alice', active: true,
      usage: [{ label: '5h', pct: 5 }, { label: '7d', pct: 25 }, { label: 'Fable', pct: 0 }] },
    { number: 2, name: 'home', active: false, usage: [{ label: '5h', pct: 0 }, { label: '7d', pct: 0 }] },
  ])
})

test('사용률 구간별 색', async () => {
  expect([tone(10), tone(70), tone(95)]).toEqual(['success', 'warning', 'error'])
})
