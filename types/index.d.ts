export type Settings = {
  style: string
  lang: string
  locale: string
  model: string
  effort: string
  retry: boolean
  detail: string
  meter: boolean
}

// The style a message was sent with.
export type Sent = { style: string; lang: string; locale?: string }

export type UsageEntry = {
  t: number
  msg: string
  model: string
  style: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type View = 'main' | 'lang' | 'settings' | 'usage'

declare module 'claude-code' {
  interface PluginState {
    veil: {
      cache: Record<string, string>
      settings: Settings
      view: View
      sent: Record<string, Sent>
      revealed: boolean
      /** Per message: whether the person clicked it open. */
      opened: StateFamily<boolean>
      usage: UsageEntry[]
      sessionStart: number
    }
  }
}
