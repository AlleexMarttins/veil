import type { UsageEntry } from '../types'

export const KEEP_USAGE = 5000

export type Totals = { calls: number; messages: number; input: number; output: number; total: number }

// Input counts every token the model read: uncached, cache reads and cache writes.
export const totals = (entries: readonly UsageEntry[]): Totals => {
  const input = entries.reduce((n, e) => n + e.input + e.cacheRead + e.cacheWrite, 0)
  const output = entries.reduce((n, e) => n + e.output, 0)
  return { calls: entries.length, messages: new Set(entries.map(e => e.msg)).size, input, output, total: input + output }
}

export const since = (entries: readonly UsageEntry[], from: number): UsageEntry[] => entries.filter(e => e.t >= from)

const DAY = 24 * 60 * 60 * 1000

export const startOfDay = (now: number): number => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const periods = (entries: readonly UsageEntry[], now: number, sessionStart: number) => ({
  session: totals(since(entries, sessionStart)),
  today: totals(since(entries, startOfDay(now))),
  week: totals(since(entries, now - 7 * DAY)),
  month: totals(since(entries, now - 30 * DAY)),
  all: totals(entries),
})

export const byModel = (entries: readonly UsageEntry[]): Array<[string, Totals]> => {
  const groups = new Map<string, UsageEntry[]>()
  for (const e of entries) groups.set(e.model, [...(groups.get(e.model) ?? []), e])
  return [...groups.entries()].map(([model, list]) => [model, totals(list)] as [string, Totals]).sort((a, b) => b[1].total - a[1].total)
}

export type MessageUsage = { msg: string; t: number; model: string; style: string; calls: number; total: number }

// One row per message, newest first; a retry adds to its message's row.
export const lastMessages = (entries: readonly UsageEntry[], count: number): MessageUsage[] => {
  const rows = new Map<string, MessageUsage>()
  for (const e of entries) {
    const row = rows.get(e.msg) ?? { msg: e.msg, t: e.t, model: e.model, style: e.style, calls: 0, total: 0 }
    row.calls += 1
    row.total += e.input + e.cacheRead + e.cacheWrite + e.output
    row.t = Math.max(row.t, e.t)
    rows.set(e.msg, row)
  }
  return [...rows.values()].sort((a, b) => b.t - a.t).slice(0, count)
}

// Average tokens per message among messages sent with this model and style.
export const averagePerMessage = (entries: readonly UsageEntry[], model: string, style: string): number | undefined => {
  const rows = lastMessages(
    entries.filter(e => e.model === model && e.style === style),
    Number.MAX_SAFE_INTEGER,
  )
  return rows.length === 0 ? undefined : Math.round(rows.reduce((n, r) => n + r.total, 0) / rows.length)
}

export const fmt = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

export const parseUsage = (raw: unknown): UsageEntry[] =>
  Array.isArray(raw)
    ? raw.filter(
        (e): e is UsageEntry =>
          !!e && typeof e === 'object' && typeof (e as UsageEntry).t === 'number' && typeof (e as UsageEntry).input === 'number',
      )
    : []
