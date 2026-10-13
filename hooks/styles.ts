import type { Settings } from '../types'
import { cipher } from './cipher'
import { binary, braille, glitch, matrix, morse, rot13, runes } from './ciphers'
import { DEFAULT_LOCALE, LOCALES, t } from './i18n'
import { emojiSystem, logSystem, systemFor } from './translate'

export type Style = {
  id: string
  // Text drawn in place of the message; undefined draws it as typed.
  render: (text: string, translated: string | undefined) => string | undefined
  // Asks the model for a rewrite on submit; `render` gets it as `translated`.
  system?: (codeLanguage: string, outputLanguage: string) => string
  // Model styles show this as their example; offline ones draw the sample themselves.
  example?: (codeLanguage: string, locale: string) => string
  // Opens the language sub-menu when picked.
  hasLanguages?: boolean
}

const CODE_EXAMPLES: Record<string, string> = {
  Python: 'browser.open()',
  JavaScript: 'await browser.open()',
  Rust: 'browser.open()?;',
  Go: 'browser.Open()',
  C: 'browser_open();',
  SQL: "UPDATE browser SET state = 'open';",
  Bash: 'open-browser --start',
  Lua: 'browser.open()',
  Haskell: 'openBrowser :: IO ()',
}

const viaModel = (text: string, translated: string | undefined) => translated ?? cipher(text)

// One style is active at a time. Add a new one here and its text in i18n.ts; /painel lists it by itself.
export const STYLES: readonly Style[] = [
  { id: 'off', render: () => undefined },
  { id: 'hex', render: text => cipher(text) },
  {
    id: 'code',
    system: systemFor,
    hasLanguages: true,
    example: language => CODE_EXAMPLES[language] ?? 'browser.open()',
    render: viaModel,
  },
  { id: 'log', system: logSystem, example: (_, locale) => t(locale, 'logExample'), render: viaModel },
  { id: 'emoji', system: emojiSystem, example: () => '🔓🌐', render: viaModel },
  { id: 'binary', render: text => binary(text) },
  { id: 'morse', render: text => morse(text) },
  { id: 'runes', render: text => runes(text) },
  { id: 'braille', render: text => braille(text) },
  { id: 'matrix', render: text => matrix(text) },
  { id: 'rot13', render: text => rot13(text) },
  { id: 'glitch', render: text => glitch(text) },
]

export const LANGUAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'c', label: 'C' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Bash' },
  { id: 'lua', label: 'Lua' },
  { id: 'haskell', label: 'Haskell' },
]

export const MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'haiku', label: 'Haiku' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
]
export const EFFORTS = ['low', 'medium', 'high'] as const
export const DETAILS = ['compact', 'normal', 'detailed'] as const

export const DEFAULTS: Settings = {
  style: 'code',
  lang: 'python',
  locale: DEFAULT_LOCALE,
  model: 'haiku',
  effort: 'low',
  retry: true,
  detail: 'normal',
  meter: true,
}

// What the details box shows under the menu: the sample as this style would draw it.
export const exampleOf = (style: Style, codeLanguage: string, locale: string): string => {
  const sample = t(locale, 'sample')
  return style.example ? style.example(codeLanguage, locale) : (style.render(sample, undefined) ?? sample)
}

export const styleOf = (s: Readonly<Record<string, unknown>>): Style =>
  STYLES.find(x => x.id === s.style) ?? (STYLES.find(x => x.id === DEFAULTS.style) as Style)

export const langOf = (s: Readonly<Record<string, unknown>>): { id: string; label: string } =>
  LANGUAGES.find(x => x.id === s.lang) ?? (LANGUAGES.find(x => x.id === DEFAULTS.lang) as { id: string; label: string })

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export const parseSettings = (raw: unknown): Settings => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown> & {
    on?: Record<string, boolean>
    opt?: Record<string, string>
  }
  const lang = pick(r.lang, LANGUAGES.map(x => x.id), DEFAULTS.lang)
  let style = pick(r.style, STYLES.map(x => x.id), DEFAULTS.style)
  // Settings saved by earlier versions of the menu.
  if (r.style === 'python') style = 'code'
  else if (r.style === undefined && r.on?.cifra === false) style = 'off'
  else if (r.style === undefined && r.opt?.cifra === 'hex') style = 'hex'

  return {
    style,
    lang: r.style === 'python' ? 'python' : lang,
    locale: pick(r.locale, LOCALES.map(l => l.id), DEFAULTS.locale as 'en'),
    model: pick(r.model, MODELS.map(m => m.id), DEFAULTS.model),
    effort: pick(r.effort, EFFORTS, 'low'),
    retry: typeof r.retry === 'boolean' ? r.retry : DEFAULTS.retry,
    detail: pick(r.detail, DETAILS, 'normal'),
    meter: typeof r.meter === 'boolean' ? r.meter : DEFAULTS.meter,
  }
}

// The next value of a setting the menu cycles through.
export const cycle = <T>(values: readonly T[], current: T): T =>
  values[(values.indexOf(current) + 1) % values.length] as T
