// Cosmetic only: a deterministic hex stream derived from the text, so a row redraws the same.
const fnv = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const MAX_GROUPS = 24

export const cipherLine = (line: string, salt: number): string => {
  if (line.trim() === '') return ''
  let x = (fnv(line) ^ salt) >>> 0 || 1
  const groups: string[] = []
  const count = Math.min(MAX_GROUPS, Math.ceil(line.length / 2))
  for (let i = 0; i < count; i++) {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    groups.push((x & 0xffff).toString(16).padStart(4, '0'))
  }
  return groups.join(' ')
}

export const cipher = (text: string): string => {
  const salt = fnv(text)
  return text
    .split('\n')
    .map((line, i) => cipherLine(line, salt + i))
    .join('\n')
}
