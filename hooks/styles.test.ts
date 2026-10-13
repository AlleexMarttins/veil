import { test, expect } from 'claude-code/testing'

import { langOf, parseSettings, styleOf } from './styles'

const DEFAULT = { style: 'code', lang: 'python' }

test('defaults to code in python, ignores junk', () => {
  expect(parseSettings(null)).toEqual(DEFAULT)
  expect(parseSettings('lixo')).toEqual(DEFAULT)
  expect(parseSettings({ style: 'nope', lang: 'cobol' })).toEqual(DEFAULT)
})

test('reads a saved style and language', () => {
  expect(parseSettings({ style: 'hex' })).toEqual({ style: 'hex', lang: 'python' })
  expect(parseSettings({ style: 'code', lang: 'rust' })).toEqual({ style: 'code', lang: 'rust' })
})

test('migrates earlier saved settings', () => {
  expect(parseSettings({ style: 'python' })).toEqual(DEFAULT)
  expect(parseSettings({ on: { cifra: false } })).toEqual({ style: 'off', lang: 'python' })
  expect(parseSettings({ on: { cifra: true }, opt: { cifra: 'hex' } })).toEqual({ style: 'hex', lang: 'python' })
})

test('off draws as typed, code uses the translation, no emoji', () => {
  expect(styleOf({ style: 'off' }).render('oi', undefined)).toBe(undefined)
  expect(styleOf({ style: 'code' }).render('oi', 'print("oi")')).toBe('print("oi")')
  expect(styleOf({ style: 'code' }).render('oi', undefined)).toBe(styleOf({ style: 'hex' }).render('oi', undefined))
  expect(langOf({ lang: 'nope' }).id).toBe('python')
})
