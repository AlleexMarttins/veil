import { test, expect } from 'claude-code/testing'

import { cipher } from './cipher'

test('same text, same cipher', () => {
  expect(cipher('oi claude')).toBe(cipher('oi claude'))
})

test('hides the original text', () => {
  const out = cipher('minha senha secreta')
  expect(out.includes('senha')).toBe(false)
  expect(/^[0-9a-f ]+$/.test(out)).toBe(true)
})

test('keeps line breaks', () => {
  expect(cipher('a\nb\nc').split('\n').length).toBe(3)
})
