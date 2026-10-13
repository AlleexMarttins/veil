import { test, expect } from 'claude-code/testing'

import { binary, braille, glitch, matrix, morse, rot13, runes } from './ciphers'
import { STYLES } from './styles'

test('binary writes 8 bits per character', () => {
  expect(binary('Oi')).toBe('01001111 01101001')
})

test('morse ignores accents and separates words', () => {
  expect(morse('SOS ação')).toBe('... --- ... / .- -.-. .- ---')
})

test('rot13 is its own inverse and keeps case and accents', () => {
  expect(rot13('Olá, Mundo')).toBe('Byá, Zhaqb')
  expect(rot13(rot13('Olá, Mundo'))).toBe('Olá, Mundo')
})

test('letter alphabets map a-z one to one', () => {
  for (const f of [runes, braille, matrix]) {
    expect(Array.from(f('abcdefghijklmnopqrstuvwxyz')).length).toBe(26)
    expect(f('abc')).not.toBe('abc')
    expect(f('ação')).toBe(f('acao'))
  }
})

test('glitch is deterministic and keeps the letters', () => {
  expect(glitch('teste')).toBe(glitch('teste'))
  expect(glitch('teste').replace(/[\u0300-\u036f]/g, '')).toBe('teste')
})

test('long text is capped', () => {
  expect(Array.from(binary('a'.repeat(500))).length).toBeLessThanOrEqual(601)
})

test('every style has a unique id', () => {
  const ids = STYLES.map(s => s.id)
  expect(new Set(ids).size).toBe(ids.length)
})
