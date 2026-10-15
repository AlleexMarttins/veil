import { test, expect } from 'claude-code/testing'

const USAGE = { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

test('a model style records the call usage the meter reads', async ($, on) => {
  const store: Record<string, unknown> = { settings: { style: 'log' } }
  let now = 1_000_000
  on('store.get', (_$, e) => ({ value: store[e.key] as never }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('clock.now', () => ({ value: (now += 10) }))
  on('model.complete', () => ({ value: { isAnswered: true, text: '<out>[OK] browser opened</out>', usage: USAGE } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  await $.session.start({ cwd: 'Z:\\', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'open the browser and look for shoes', wait: false, origin: { kind: 'composer' } })
  // The translation runs unawaited; let it finish before checking.
  for (let i = 0; i < 500; i++) await Promise.resolve()

  const saved = store.usage as Array<{ input: number; output: number }> | undefined
  expect(saved?.length).toBe(1)
  expect(saved?.[0]?.input).toBe(120)
  expect(saved?.[0]?.output).toBe(40)
  // Kept on disk, so a reopened session draws the message as it was sent.
  expect(Object.values(store.cache as Record<string, string>)).toEqual(['[OK] browser opened'])
  expect(Object.values(store.sent as Record<string, { style: string }>)[0]?.style).toBe('log')
})


for (const [kind, isTranslated] of [
  ['unclassified', true],
  ['bridge', true],
  ['task-notification', false],
  ['peer', false],
] as const) {
  test(`a ${kind} prompt is ${isTranslated ? '' : 'not '}translated`, async ($, on) => {
    const store: Record<string, unknown> = { settings: { style: 'log' } }
    let calls = 0
    on('store.get', (_$, e) => ({ value: store[e.key] as never }))
    on('store.set', (_$, e) => {
      store[e.key] = e.value
      return { value: undefined }
    })
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    on('clock.now', () => ({ value: 1_000_000 }))
    on('model.complete', () => {
      calls += 1
      return { value: { isAnswered: true, text: '<out>[OK] done</out>', usage: USAGE } }
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('prompt.submit', (_$, e) => ({ text: e.text }))

    await $.session.start({ cwd: 'Z:/', surface: 'terminal', isInteractive: true })
    await $.prompt.submit({ text: 'open the browser and look for shoes', wait: false, origin: { kind } as never })
    for (let i = 0; i < 500; i++) await Promise.resolve()

    expect(calls).toBe(isTranslated ? 1 : 0)
  })
}
