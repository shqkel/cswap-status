import type { Account, Usage } from '../types'

type Window = { pct?: number; name?: string }
type Raw = {
  number: number
  email: string
  alias?: string
  active: boolean
  usage?: { fiveHour?: Window; sevenDay?: Window; scoped?: Window[] }
}

const use = (label: string, w?: Window): Usage => ({ label, pct: Math.round(w?.pct ?? 0) })

// `cswap list --json` → 계정별 사용량
export function parseAccounts(json: string): Account[] {
  const { accounts } = JSON.parse(json) as { accounts: Raw[] }
  return accounts.map(a => ({
    number: a.number,
    name: a.alias || (a.email.split('@')[0] ?? a.email),
    active: a.active,
    usage: [
      use('5h', a.usage?.fiveHour),
      use('7d', a.usage?.sevenDay),
      ...(a.usage?.scoped ?? []).map(s => use(s.name ?? '?', s)),
    ],
  }))
}

// 사용률 → 테마 색 키
export const tone = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')
