// Deterministic, offline styles: the same text always draws the same way.

const CAP = 600

export const cap = (s: string): string => {
  const chars = Array.from(s)
  return chars.length > CAP ? `${chars.slice(0, CAP).join('')}…` : s
}

// Lowercase without accents, so "ação" maps like "acao".
const plain = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

// Replaces each a-z by the glyph at the same place in `glyphs`; the rest stays.
const substitute = (text: string, glyphs: readonly string[], space: string): string =>
  Array.from(plain(text))
    .map(c => {
      const i = LETTERS.indexOf(c)
      if (i >= 0) return glyphs[i]
      return c === ' ' ? space : c
    })
    .join('')

export const binary = (text: string): string =>
  cap(
    Array.from(text)
      .filter(c => c.trim() !== '' || c === ' ')
      .map(c => (c.codePointAt(0) ?? 0).toString(2).padStart(8, '0'))
      .join(' '),
  )

const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....',
  '7': '--...', '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
}

export const morse = (text: string): string =>
  cap(
    plain(text)
      .split(/\s+/)
      .filter(w => w !== '')
      .map(w =>
        Array.from(w)
          .map(c => MORSE[c])
          .filter((m): m is string => m !== undefined)
          .join(' '),
      )
      .filter(w => w !== '')
      .join(' / '),
  )

const RUNES = Array.from('ᚨᛒᚲᛞᛖᚠᚷᚺᛁᛃᚲᛚᛗᚾᛟᛈᚲᚱᛊᛏᚢᚹᚹᛉᛃᛉ')
export const runes = (text: string): string => cap(substitute(text, RUNES, '᛫'))

const BRAILLE = Array.from('⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵')
export const braille = (text: string): string => cap(substitute(text, BRAILLE, ' '))

const KATAKANA = Array.from('アイウエオカキクケコサシスセソタチツテトナニヌネノハ')
export const matrix = (text: string): string => cap(substitute(text, KATAKANA, '・'))

export const rot13 = (text: string): string =>
  cap(
    text.replace(/[a-z]/gi, c => {
      const base = c <= 'Z' ? 65 : 97
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
    }),
  )

export const glitch = (text: string): string => {
  let seed = 7
  for (const c of text) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }
  return Array.from(text.slice(0, 300))
    .map(c => {
      if (c.trim() === '') return c
      let marks = ''
      for (let n = 1 + (next() % 3); n > 0; n--) marks += String.fromCharCode(0x0300 + (next() % 0x70))
      return c + marks
    })
    .join('')
}
