import { test, expect } from 'claude-code/testing'

import { lookup } from './lookup'

const P = 'log:python\n'

test('exact text hits the cache', () => {
  expect(lookup('abrir o navegador', P, { [`${P}abrir o navegador`]: '[EXEC] chrome' }, new Set())).toEqual({
    translated: '[EXEC] chrome',
    isWaiting: false,
  })
})

test('exact text still in flight waits', () => {
  expect(lookup('abrir o navegador', P, {}, new Set([`${P}abrir o navegador`]))).toEqual({ isWaiting: true })
})

test('queued prompts joined in one row are translated part by part, in order', () => {
  const cache = { [`${P}primeira mensagem`]: '[OK] um', [`${P}segunda mensagem`]: '[OK] dois' }
  expect(lookup('primeira mensagem\nsegunda mensagem', P, cache, new Set())).toEqual({
    translated: '[OK] um\n[OK] dois',
    isWaiting: false,
  })
})

test('a joined row waits while any part is in flight', () => {
  const cache = { [`${P}primeira mensagem`]: '[OK] um' }
  expect(lookup('primeira mensagem\nsegunda mensagem', P, cache, new Set([`${P}segunda mensagem`]))).toEqual({
    isWaiting: true,
  })
})

test('other styles and short parts never match', () => {
  expect(lookup('abrir o navegador agora', P, { 'hex:python\nabrir o navegador': 'x', [`${P}abrir`]: 'y' }, new Set())).toEqual({
    isWaiting: false,
  })
})

test('a part contained in a longer cached part is not counted twice', () => {
  const cache = { [`${P}abrir o navegador`]: 'curto', [`${P}abrir o navegador e buscar`]: 'longo' }
  expect(lookup('abrir o navegador e buscar', P, cache, new Set()).translated).toBe('longo')
})
