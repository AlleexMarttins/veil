import { test, expect } from 'claude-code/testing'

import type { UsageEntry } from '../types'
import { averagePerMessage, byModel, fmt, lastMessages, parseUsage, periods, totals } from './usage'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 9, 13, 15, 0).getTime()

const entry = (over: Partial<UsageEntry>): UsageEntry => ({
  t: NOW,
  msg: 'm1',
  model: 'haiku',
  style: 'log',
  input: 100,
  output: 50,
  cacheRead: 10,
  cacheWrite: 5,
  ...over,
})

test('totals count every input token kind and distinct messages', () => {
  const x = totals([entry({}), entry({ msg: 'm1' }), entry({ msg: 'm2' })])
  expect(x).toEqual({ calls: 3, messages: 2, input: 345, output: 150, total: 495 })
})

test('periods split by session, day, week, month', () => {
  const list = [
    entry({ t: NOW - 40 * DAY, msg: 'old' }),
    entry({ t: NOW - 10 * DAY, msg: 'month' }),
    entry({ t: NOW - 3 * DAY, msg: 'week' }),
    entry({ t: NOW - 60 * 1000, msg: 'now' }),
  ]
  const p = periods(list, NOW, NOW - 5 * 60 * 1000)
  expect(p.session.messages).toBe(1)
  expect(p.today.messages).toBe(1)
  expect(p.week.messages).toBe(2)
  expect(p.month.messages).toBe(3)
  expect(p.all.messages).toBe(4)
})

test('byModel sorts the biggest spender first', () => {
  const rows = byModel([entry({ model: 'haiku' }), entry({ model: 'opus', output: 5000 })])
  expect(rows.map(r => r[0])).toEqual(['opus', 'haiku'])
})

test('lastMessages merges a retry into its message, newest first', () => {
  const rows = lastMessages([entry({ msg: 'a', t: NOW - 10 }), entry({ msg: 'a', t: NOW - 5 }), entry({ msg: 'b', t: NOW - 20 })], 5)
  expect(rows.map(r => [r.msg, r.calls])).toEqual([
    ['a', 2],
    ['b', 1],
  ])
  expect(rows[0]?.total).toBe(330)
})

test('average per message only counts the same model and style', () => {
  const list = [entry({ msg: 'a' }), entry({ msg: 'b', output: 250 }), entry({ msg: 'c', model: 'opus' })]
  expect(averagePerMessage(list, 'haiku', 'log')).toBe(265)
  expect(averagePerMessage(list, 'sonnet', 'log')).toBe(undefined)
})

test('fmt and parseUsage', () => {
  expect(fmt(999)).toBe('999')
  expect(fmt(1234)).toBe('1.2k')
  expect(fmt(2_500_000)).toBe('2.5M')
  expect(parseUsage([entry({}), { nope: 1 }, null])).toHaveLength(1)
  expect(parseUsage('x')).toEqual([])
})
