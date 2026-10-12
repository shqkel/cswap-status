export type Usage = { label: string; pct: number }
export type Account = { number: number; name: string; active: boolean; usage: Usage[] }
export type Setup = 'unknown' | 'missing' | 'ready'

declare module 'claude-code' {
  interface PluginState {
    'cswap-status': {
      accounts: Account[]
      shown: number
      busy: boolean
      watching: boolean
      setup: Setup
    }
  }
}
