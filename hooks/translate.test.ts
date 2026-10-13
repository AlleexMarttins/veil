import { test, expect } from 'claude-code/testing'

import { buildPrompt, clean, echoes, maxTokensFor } from './translate'

test('reply cap grows with the message and stops at 500', () => {
  expect(maxTokensFor('oi')).toBe(125)
  expect(maxTokensFor('x'.repeat(300))).toBe(305)
  expect(maxTokensFor('x'.repeat(5000))).toBe(500)
})

test('echoes spots the message pasted back, ignoring case and spacing', () => {
  expect(echoes('let text = "Busque  ofertas de sapatos";', 'busque ofertas de sapatos')).toBe(true)
  expect(echoes('shop.search("sapatos", max=price)', 'busque ofertas de sapatos')).toBe(false)
  expect(echoes('print("oi")', 'oi')).toBe(false)
})

test('lines scale with length', () => {
  expect(buildPrompt('oi')).toContain('<lines>1</lines>')
  expect(buildPrompt('x'.repeat(300))).toContain('<lines>5</lines>')
  expect(buildPrompt('x'.repeat(5000))).toContain('<lines>12</lines>')
})

test('clean strips code fences', () => {
  expect(clean('```python\nprint(1)\n```')).toBe('print(1)')
})

test('clean caps width and height', () => {
  const out = clean(Array(40).fill('a'.repeat(300)).join('\n')).split('\n')
  expect(out.length).toBe(16)
  expect(out[0]?.length).toBe(120)
})
