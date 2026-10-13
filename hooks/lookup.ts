export type Lookup = { translated?: string; isWaiting: boolean }

const MIN_PART = 8

// Finds the translation for a transcript row. A prompt typed mid-turn can reach
// the row joined with other queued prompts or wrapped, so when the exact text
// misses, the row is matched by the submitted texts it contains.
export const lookup = (
  row: string,
  prefix: string,
  cache: Readonly<Record<string, string>>,
  pending: ReadonlySet<string>,
): Lookup => {
  const exact = cache[prefix + row]
  if (exact !== undefined) return { translated: exact, isWaiting: false }
  if (pending.has(prefix + row)) return { isWaiting: true }

  type Hit = { at: number; end: number; code?: string }
  const found: Hit[] = []
  const scan = (key: string, code?: string) => {
    if (!key.startsWith(prefix)) return
    const part = key.slice(prefix.length).trim()
    if (part.length < MIN_PART) return
    const at = row.indexOf(part)
    if (at >= 0) found.push({ at, end: at + part.length, code })
  }
  for (const [key, code] of Object.entries(cache)) scan(key, code)
  for (const key of pending) if (!(key in cache)) scan(key)

  // Longest parts first; a part inside one already taken is the same text.
  const taken: Hit[] = []
  for (const hit of found.sort((a, b) => b.end - b.at - (a.end - a.at))) {
    if (!taken.some(t => hit.at < t.end && t.at < hit.end)) taken.push(hit)
  }
  if (taken.length === 0) return { isWaiting: false }
  if (taken.some(t => t.code === undefined)) return { isWaiting: true }

  return { translated: taken.sort((a, b) => a.at - b.at).map(t => t.code).join('\n'), isWaiting: false }
}
