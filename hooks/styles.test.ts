import { test, expect } from 'claude-code/testing'

import { STYLE_TEXT, t } from './i18n'
import { DEFAULTS, STYLES, cycle, exampleOf, langOf, parseSettings, styleOf } from './styles'

test('defaults: code in python, English, haiku', () => {
  expect(parseSettings(null)).toEqual(DEFAULTS)
  expect(parseSettings('lixo')).toEqual(DEFAULTS)
  expect(DEFAULTS.locale).toBe('en')
  expect(DEFAULTS.model).toBe('haiku')
})

test('junk values fall back one by one', () => {
  const s = parseSettings({ style: 'nope', lang: 'cobol', locale: 'xx', model: 'gpt', effort: 'max', retry: 'yes', detail: 'huge' })
  expect(s).toEqual(DEFAULTS)
})

test('reads saved settings', () => {
  const saved = { style: 'log', lang: 'rust', locale: 'pt', model: 'sonnet', effort: 'high', retry: false, detail: 'compact', meter: false }
  expect(parseSettings(saved)).toEqual(saved)
})

test('migrates earlier saved settings', () => {
  expect(parseSettings({ style: 'python' })).toEqual({ ...DEFAULTS, style: 'code', lang: 'python' })
  expect(parseSettings({ on: { cifra: false } }).style).toBe('off')
  expect(parseSettings({ on: { cifra: true }, opt: { cifra: 'hex' } }).style).toBe('hex')
  expect(parseSettings({ style: 'hex', lang: 'go' })).toEqual({ ...DEFAULTS, style: 'hex', lang: 'go' })
})

test('off draws as typed, code uses the translation', () => {
  expect(styleOf({ style: 'off' }).render('oi', undefined)).toBe(undefined)
  expect(styleOf({ style: 'code' }).render('oi', 'print("oi")')).toBe('print("oi")')
  expect(styleOf({ style: 'code' }).render('oi', undefined)).toBe(styleOf({ style: 'hex' }).render('oi', undefined))
  expect(langOf({ lang: 'nope' }).id).toBe('python')
})

test('every style has text in every locale and an example', () => {
  for (const locale of Object.keys(STYLE_TEXT)) {
    for (const s of STYLES) {
      const text = STYLE_TEXT[locale as 'en'][s.id]
      expect(text?.label.length ?? 0).toBeGreaterThan(1)
      expect(text?.about.length ?? 0).toBeGreaterThan(5)
      if (s.id !== 'off') expect(exampleOf(s, 'Python', locale)).not.toBe(t(locale, 'sample'))
    }
  }
})

test('cycle wraps around', () => {
  expect(cycle(['a', 'b', 'c'], 'c')).toBe('a')
  expect(cycle(['a', 'b', 'c'], 'a')).toBe('b')
})
