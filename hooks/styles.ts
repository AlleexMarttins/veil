import type { Settings } from '../types'
import { cipher } from './cipher'
import { binary, braille, glitch, matrix, morse, rot13, runes } from './ciphers'
import { emojiSystem, logSystem, systemFor } from './translate'

export type Style = {
  id: string
  label: string
  hint?: string
  // Text drawn in place of the message; undefined draws it as typed.
  render: (text: string, translated: string | undefined) => string | undefined
  // Asks Haiku for a rewrite on submit; `render` gets it as `translated`.
  system?: (language: string) => string
  // Opens the language sub-menu when picked.
  hasLanguages?: boolean
}

// One style is active at a time. Add a new one here; /painel lists it by itself.
export const STYLES: readonly Style[] = [
  { id: 'off', label: 'Desativado', render: () => undefined },
  {
    id: 'hex',
    label: 'Hexadecimal',
    hint: 'blocos hex derivados do texto',
    render: text => cipher(text),
  },
  {
    id: 'code',
    label: 'Code Language',
    system: systemFor,
    hasLanguages: true,
    render: (text, translated) => translated ?? cipher(text),
  },
  {
    id: 'log',
    label: 'Log',
    system: logSystem,
    render: (text, translated) => translated ?? cipher(text),
  },
  {
    id: 'emoji',
    label: 'Emojis',
    hint: 'o pedido contado só com emojis · Haiku',
    system: emojiSystem,
    render: (text, translated) => translated ?? cipher(text),
  },
  { id: 'binary', label: 'Binário', hint: '01001111', render: text => binary(text) },
  { id: 'morse', label: 'Morse', hint: '.-.. --- --. ---', render: text => morse(text) },
  { id: 'runes', label: 'Runas', hint: 'ᚠᚢᚦᚨᚱᚲ', render: text => runes(text) },
  { id: 'braille', label: 'Braille', hint: '⠃⠗⠁⠊⠇⠇⠑', render: text => braille(text) },
  { id: 'matrix', label: 'Matrix', hint: 'カタカナ', render: text => matrix(text) },
  { id: 'rot13', label: 'ROT13', hint: 'cifra de César', render: text => rot13(text) },
  { id: 'glitch', label: 'Glitch', hint: 'texto corrompido', render: text => glitch(text) },
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

export const DEFAULT_STYLE = 'code'
export const DEFAULT_LANG = 'python'

export const styleOf = (s: Readonly<Record<string, unknown>>): Style =>
  STYLES.find(x => x.id === s.style) ?? (STYLES.find(x => x.id === DEFAULT_STYLE) as Style)

export const langOf = (s: Readonly<Record<string, unknown>>): { id: string; label: string } =>
  LANGUAGES.find(x => x.id === s.lang) ?? (LANGUAGES.find(x => x.id === DEFAULT_LANG) as { id: string; label: string })

export const parseSettings = (raw: unknown): Settings => {
  const r = (raw ?? {}) as { style?: unknown; lang?: unknown; on?: Record<string, boolean>; opt?: Record<string, string> }
  const lang = typeof r.lang === 'string' && LANGUAGES.some(x => x.id === r.lang) ? r.lang : DEFAULT_LANG
  if (r.style === 'python') return { style: 'code', lang: 'python' }
  if (typeof r.style === 'string' && STYLES.some(x => x.id === r.style)) return { style: r.style, lang }
  // Settings saved by the earlier toggle + option menu.
  if (r.on && r.on.cifra === false) return { style: 'off', lang }
  if (r.opt?.cifra === 'hex') return { style: 'hex', lang }
  return { style: DEFAULT_STYLE, lang }
}
