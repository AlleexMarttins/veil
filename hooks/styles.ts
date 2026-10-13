import type { Settings } from '../types'
import { cipher } from './cipher'
import { binary, braille, glitch, matrix, morse, rot13, runes } from './ciphers'
import { emojiSystem, logSystem, systemFor } from './translate'

export type Style = {
  id: string
  label: string
  about: string
  // Haiku styles show this as their example; offline ones draw the sample themselves.
  example?: (language: string) => string
  // Text drawn in place of the message; undefined draws it as typed.
  render: (text: string, translated: string | undefined) => string | undefined
  // Asks Haiku for a rewrite on submit; `render` gets it as `translated`.
  system?: (language: string) => string
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

export const SAMPLE = 'abrir o navegador'

// What the details box shows under the menu: the sample as this style would draw it.
export const exampleOf = (style: Style, language: string): string =>
  style.example ? style.example(language) : (style.render(SAMPLE, undefined) ?? SAMPLE)

// One style is active at a time. Add a new one here; /painel lists it by itself.
export const STYLES: readonly Style[] = [
  { id: 'off', label: 'Desativado', about: 'As mensagens aparecem normais.', render: () => undefined },
  {
    id: 'hex',
    label: 'Hexadecimal',
    about: 'Cada mensagem vira blocos hexadecimais.',
    render: text => cipher(text),
  },
  {
    id: 'code',
    label: 'Code Language',
    about: 'O Haiku reescreve a mensagem como código na linguagem escolhida.',
    example: language => CODE_EXAMPLES[language] ?? 'browser.open()',
    system: systemFor,
    hasLanguages: true,
    render: (text, translated) => translated ?? cipher(text),
  },
  {
    id: 'log',
    label: 'Log',
    about: 'O pedido vira linhas de log de sistema.',
    example: () => '[EXEC] browser.open()\n[OK] navegador aberto',
    system: logSystem,
    render: (text, translated) => translated ?? cipher(text),
  },
  {
    id: 'emoji',
    label: 'Emojis',
    about: 'O pedido é contado só com emojis.',
    example: () => '🔓🌐',
    system: emojiSystem,
    render: (text, translated) => translated ?? cipher(text),
  },
  { id: 'binary', label: 'Binário', about: 'Cada caractere vira 8 bits.', render: text => binary(text) },
  { id: 'morse', label: 'Morse', about: 'Letras e números viram código Morse.', render: text => morse(text) },
  { id: 'runes', label: 'Runas', about: 'Letras viram runas do alfabeto Futhark.', render: text => runes(text) },
  { id: 'braille', label: 'Braille', about: 'Letras viram caracteres Braille.', render: text => braille(text) },
  { id: 'matrix', label: 'Matrix', about: 'Letras viram katakana, como na chuva do Matrix.', render: text => matrix(text) },
  { id: 'rot13', label: 'ROT13', about: 'Cada letra avança 13 posições no alfabeto.', render: text => rot13(text) },
  { id: 'glitch', label: 'Glitch', about: 'O texto fica corrompido por marcas sobrepostas.', render: text => glitch(text) },
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
