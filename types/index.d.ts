export type Settings = { style: string; lang: string }

declare module 'claude-code' {
  interface PluginState {
    painel: {
      cache: Record<string, string>
      settings: Settings
      view: 'main' | 'lang'
    }
  }
}
