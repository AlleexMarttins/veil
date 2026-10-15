import { atom, memberOf, read, update } from 'claude-code'
import type { Register, RenderChildren, RenderInput } from 'claude-code'

import type { Sent, Settings, UsageEntry, View } from '../types'
import { LOCALES, localeOf, styleText, t } from './i18n'
import { lookup } from './lookup'
import { DEFAULTS, DETAILS, EFFORTS, LANGUAGES, MODELS, STYLES, cycle, exampleOf, langOf, parseSettings, styleOf } from './styles'
import { RETRY_NOTE, buildPrompt, clean, echoes, maxTokensFor } from './translate'
import { KEEP_USAGE, averagePerMessage, byModel, fmt, lastMessages, parseUsage, periods } from './usage'

const PANE = 'veil'
const KEEP = 200
// A free engine action: the user binds a chord to it (ctrl+x r) and the hint line's button answers it.
const REVEAL_ACTION = 'app:toggleReplTab'

const cache = atom({ plugin: 'veil', key: 'cache' } as const, {} as Record<string, string>)
const settings = atom({ plugin: 'veil', key: 'settings' } as const, DEFAULTS as Settings)
// The style each message was sent with, by its text.
const sent = atom({ plugin: 'veil', key: 'sent' } as const, {} as Record<string, Sent>)
const view = atom({ plugin: 'veil', key: 'view' } as const, 'main' as View)
const revealed = atom({ plugin: 'veil', key: 'revealed' } as const, false)
// Per message: whether the person clicked it open.
const opened = atom({ plugin: 'veil', key: 'opened' } as const, false)

// Clicks reach a mod only on the terminal's fullscreen renderer (/tui fullscreen).
function canPress<E extends Pick<RenderInput, 'surface' | 'viewport'>>(e: E): e is E & { surface: 'terminal' } {
  return e.surface === 'terminal' && e.viewport?.isFullscreen === true
}
const usage = atom({ plugin: 'veil', key: 'usage' } as const, [] as UsageEntry[])
const sessionStart = atom({ plugin: 'veil', key: 'sessionStart' } as const, 0)

// Where the person's own messages come from: the terminal's prompt box, Remote Control (phone, web),
// and a session attached from another terminal, whose socket the engine leaves unstamped.
const USER_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge', 'unclassified'])

const cacheKey =(style: string, lang: string, text: string) => `${style}:${lang}\n${text}`

const trim = <T,>(record: Record<string, T>): Record<string, T> => {
  const keys = Object.keys(record)
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete record[k]
  return record
}

// A stored object with only the entries `isValue` accepts; anything else becomes empty.
const asRecord = (raw: unknown, isValue: (v: unknown) => boolean): Record<string, unknown> =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => isValue(v)))
    : {}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// The last thing each hook saw, kept in the store file so a bug report can quote it.
const seen: Record<string, string> = {}
function note($: { store: { set: (key: string, value: unknown) => Promise<void> } }, hook: string, facts: Record<string, unknown>) {
  const json = JSON.stringify(facts)
  if (seen[hook] === json) return
  seen[hook] = json
  $.store.set(`diag.${hook}`, facts).catch(() => undefined)
}

export const register: Register = on => {
  const pending = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'veil', description: 'Message styles, settings and token usage' })
    await $.command.register({ name: 'reveal', description: 'Show or hide the original messages', immediate: true })
    const saved = parseSettings(await $.store.get('settings'))
    await update($, settings, () => saved)
    const history = parseUsage(await $.store.get('usage'))
    await update($, usage, () => history)
    // Translations and each message's style outlive the session, so a reopened one draws as it did.
    const savedCache = asRecord(await $.store.get('cache'), v => typeof v === 'string')
    await update($, cache, () => savedCache as Record<string, string>)
    const savedSent = asRecord(await $.store.get('sent'), v => !!v && typeof v === 'object' && typeof (v as Sent).style === 'string')
    await update($, sent, () => savedSent as Record<string, Sent>)
    const now = await $.clock.now()
    await update($, sessionStart, () => now)

    return next(e)
  })

  on('command.run', { command: 'veil' }, async $ => {
    await update($, view, () => 'main')
    await $.ui.open({ id: PANE, title: 'Veil', focus: true, closeOnEscape: true })

    return {}
  })

  on('command.run', { command: 'reveal' }, async $ => {
    await update($, revealed, r => !r)

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = parseSettings(await read($, settings))
    const where = await read($, view)
    const active = styleOf(current)
    const language = langOf(current)
    const loc = current.locale

    const save = async (updated: Settings) => {
      await update($, settings, () => updated)
      await $.store.set('settings', updated)
    }
    const go = (to: View) => update($, view, () => to)

    const radio = (isOn: boolean, label: string, extra?: string) => [
      <Text color={isOn ? 'green' : 'gray'} bold>
        {isOn ? '◉' : '○'}
      </Text>,
      ' ',
      <Text bold={isOn} dimColor={!isOn}>
        {label}
      </Text>,
      extra ? <Text dimColor>{`  ${extra}`}</Text> : '',
    ]

    const frame = (body: RenderChildren) => (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        {where !== 'lang' && (
          <Box gap={2} marginBottom={1}>
            {(
              [
                ['main', 'tabStyles', 's'],
                ['settings', 'tabSettings', 'c'],
                ['usage', 'tabUsage', 'u'],
              ] as const
            ).map(([id, key, hotkey]) => (
              <Button key={`tab-${id}`} hotkey={hotkey} onPress={() => go(id)}>
                <Text bold={where === id} color={where === id ? 'cyan' : 'gray'}>
                  {t(loc, key)}
                </Text>
              </Button>
            ))}
          </Box>
        )}
        {body}
        <Box marginTop={1}>
          <Text dimColor>{t(loc, 'footer')}</Text>
        </Box>
      </Box>
    )

    if (where === 'lang') {
      return frame(
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color="cyan">
              {t(loc, 'langTitle')}
            </Text>
          </Box>
          {LANGUAGES.map((l, i) => (
            <Button
              key={l.id}
              hotkey={String(i + 1)}
              onPress={async () => {
                await save({ ...DEFAULTS, ...current, style: 'code', lang: l.id })
                await go('main')
              }}
            >
              {radio(l.id === language.id, l.label)}
            </Button>
          ))}
          <Box marginTop={1}>
            <Button key="back" hotkey="b" dimColor onPress={() => go('main')}>
              {t(loc, 'back')}
            </Button>
          </Box>
        </Box>,
      )
    }

    if (where === 'settings') {
      const onOff = (v: boolean) => t(loc, v ? 'on' : 'off')
      const rows: Array<{ key: string; label: string; value: string; hint?: string; next: () => Settings }> = [
        {
          key: 'locale',
          label: t(loc, 'setLocale'),
          value: localeOf(loc).label,
          next: () => ({ ...current, locale: cycle(LOCALES.map(l => l.id) as string[], current.locale) }),
        },
        {
          key: 'model',
          label: t(loc, 'setModel'),
          value: MODELS.find(m => m.id === current.model)?.label ?? current.model,
          hint: t(loc, 'hintModel'),
          next: () => ({ ...current, model: cycle(MODELS.map(m => m.id), current.model) }),
        },
        {
          key: 'effort',
          label: t(loc, 'setEffort'),
          value: t(loc, current.effort as (typeof EFFORTS)[number]),
          hint: t(loc, 'hintEffort'),
          next: () => ({ ...current, effort: cycle(EFFORTS as readonly string[], current.effort) }),
        },
        {
          key: 'retry',
          label: t(loc, 'setRetry'),
          value: onOff(current.retry),
          hint: t(loc, 'hintRetry'),
          next: () => ({ ...current, retry: !current.retry }),
        },
        {
          key: 'detail',
          label: t(loc, 'setDetail'),
          value: t(loc, current.detail as (typeof DETAILS)[number]),
          hint: t(loc, 'hintDetail'),
          next: () => ({ ...current, detail: cycle(DETAILS as readonly string[], current.detail) }),
        },
        {
          key: 'meter',
          label: t(loc, 'setMeter'),
          value: onOff(current.meter),
          next: () => ({ ...current, meter: !current.meter }),
        },
      ]
      const width = Math.max(...rows.map(r => r.label.length)) + 2

      return frame(
        <Box flexDirection="column" gap={1}>
          {rows.map((r, i) => (
            <Box key={`row-${r.key}`} flexDirection="column">
              <Button key={`set-${r.key}`} hotkey={String(i + 1)} onPress={() => save(r.next())}>
                <Text>{r.label.padEnd(width)}</Text>
                <Text color="cyan" bold>
                  {r.value}
                </Text>
                <Text dimColor> ›</Text>
              </Button>
              {r.hint ? <Text dimColor>{r.hint}</Text> : ''}
            </Box>
          ))}
        </Box>,
      )
    }

    if (where === 'usage') {
      const entries = await read($, usage)
      const now = await $.clock.now()
      const p = periods(entries, now, await read($, sessionStart))
      const line = (label: string, x: { input: number; output: number; messages: number }) => (
        <Text>
          <Text>{label.padEnd(12)}</Text>
          <Text color="cyan">{fmt(x.input + x.output).padStart(7)}</Text>
          <Text dimColor>{`  ${t(loc, 'tokensIn')} ${fmt(x.input)} · ${t(loc, 'tokensOut')} ${fmt(x.output)} · ${x.messages} msg`}</Text>
        </Text>
      )
      const average = averagePerMessage(entries, current.model, active.id)

      return frame(
        <Box flexDirection="column">
          {entries.length === 0 ? (
            <Text dimColor>{t(loc, 'none')}</Text>
          ) : (
            <Box flexDirection="column" gap={1}>
              <Box flexDirection="column">
                {line(t(loc, 'session'), p.session)}
                {line(t(loc, 'today'), p.today)}
                {line(t(loc, 'week'), p.week)}
                {line(t(loc, 'month'), p.month)}
                {line(t(loc, 'all'), p.all)}
              </Box>
              <Box flexDirection="column">
                <Text bold>{t(loc, 'byModel')}</Text>
                {byModel(entries).map(([model, x]) => line(MODELS.find(m => m.id === model)?.label ?? model, x))}
              </Box>
              <Box flexDirection="column">
                <Text bold>{t(loc, 'lastMessages')}</Text>
                {lastMessages(entries, 5).map(m => (
                  <Text>
                    <Text dimColor>{`${hhmm(m.t)}  `}</Text>
                    <Text>{styleText(loc, m.style).label.padEnd(14)}</Text>
                    <Text dimColor>{(MODELS.find(x => x.id === m.model)?.label ?? m.model).padEnd(8)}</Text>
                    <Text color="cyan">{fmt(m.total).padStart(7)}</Text>
                    {m.calls > 1 ? <Text dimColor>{`  ×${m.calls}`}</Text> : ''}
                  </Text>
                ))}
              </Box>
              <Text>
                <Text dimColor>{`${t(loc, 'perMessage')}: `}</Text>
                <Text color="cyan">{average === undefined ? '—' : fmt(average)}</Text>
              </Text>
              <Button
                key="clear"
                dimColor
                onPress={async () => {
                  await update($, usage, () => [])
                  await $.store.set('usage', [])
                }}
              >
                {t(loc, 'clear')}
              </Button>
            </Box>
          )}
        </Box>,
      )
    }

    const about = styleText(loc, active.id).about

    return frame(
      <Box flexDirection="column">
        {STYLES.map((s, i) => (
          <Button
            key={s.id}
            hotkey={i < 9 ? String(i + 1) : undefined}
            onPress={async () => {
              await save({ ...current, style: s.id })
              if (s.hasLanguages) await go('lang')
            }}
          >
            {radio(s.id === active.id, styleText(loc, s.id).label, s.hasLanguages ? `${language.label} ›` : undefined)}
          </Button>
        ))}
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text>{about}</Text>
          {active.id !== 'off' && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>{t(loc, 'sample')}</Text>
              <Text color="cyan">{exampleOf(active, language.label, loc)}</Text>
            </Box>
          )}
        </Box>
      </Box>,
    )
  })

  on('prompt.submit', async ($, e, next) => {
    const text = e.text
    note($, 'submit', { origin: e.origin.kind })
    if (!USER_ORIGINS.has(e.origin.kind)) {
      return next(e)
    }
    const s = parseSettings(await read($, settings))
    const language = langOf(s)
    const style = styleOf(s)
    const key = cacheKey(style.id, language.id, text)
    if (style.id !== 'off' && text.trim() !== '') {
      const kept = await update($, sent, m => trim({ ...m, [text]: { style: style.id, lang: language.id } }))
      await $.store.set('sent', kept)
    }
    const system = style.system
    if (system && text.trim() !== '' && !pending.has(key)) {
      pending.add(key)
      // Not awaited: the row is drawn right away either way, holding '⋯' until this lands.
      void (async () => {
        let wrote = false
        try {
          for (const attempt of s.retry ? [0, 1] : [0]) {
            const r = await $.model.complete({
              model: s.model,
              system: system(language.label, localeOf(s.locale).outputLanguage),
              prompt: attempt === 0 ? buildPrompt(text, s.detail) : `${buildPrompt(text, s.detail)}\n${RETRY_NOTE}`,
              maxTokens: maxTokensFor(text, s.detail),
              effort: s.effort as (typeof EFFORTS)[number],
              timeoutMs: 8000,
            })
            const u = r.usage
            const entry: UsageEntry = {
              t: await $.clock.now(),
              msg: key,
              model: s.model,
              style: style.id,
              input: u?.input_tokens ?? 0,
              output: u?.output_tokens ?? 0,
              cacheRead: u?.cache_read_input_tokens ?? 0,
              cacheWrite: u?.cache_creation_input_tokens ?? 0,
            }
            const history = await update($, usage, list => [...list, entry].slice(-KEEP_USAGE))
            await $.store.set('usage', history)

            if (!r.isAnswered) break
            const code = clean(r.text)
            if (code === '' || echoes(code, text)) continue

            const kept = await update($, cache, c => trim({ ...c, [key]: code }))
            await $.store.set('cache', kept)
            wrote = true
            break
          }
        } catch (err) {
          // Surfaced so a refused call or state write is not silent.
          $.ui.toast(`veil: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          pending.delete(key)
          // A failed call wrote nothing: redraw so the row trades '⋯' for the hex fallback.
          if (!wrote) await update($, cache, c => ({ ...c }))
        }
      })()
    }

    return next(e)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isRevealed = await read($, revealed)
    note($, `render.${e.props.origin.kind}`, { origin: e.props.origin.kind, isExpanded: e.props.isExpanded, isRevealed, surface: e.surface })
    if (!USER_ORIGINS.has(e.props.origin.kind) || e.props.isExpanded || isRevealed) {
      return next(e)
    }

    const current = parseSettings(await read($, settings))
    if (styleOf(current).id === 'off') {
      return next(e)
    }

    // A message keeps the style it was sent with; switching styles restyles new ones only.
    const recorded = (await read($, sent))[e.props.text]
    // An unstamped row is disguised only when this mod saw it submitted, never a teammate's.
    if (e.props.origin.kind === 'unclassified' && recorded === undefined) {
      return next(e)
    }
    const s = recorded ?? current
    const style = styleOf(s)
    const found = style.system
      ? lookup(e.props.text, cacheKey(style.id, langOf(s).id, ''), await read($, cache), pending)
      : { isWaiting: false }
    // The row is drawn while the model still works: hold a placeholder, not the hex fallback.
    const shown = found.isWaiting ? '⋯' : style.render(e.props.text, found.translated)

    if (shown === undefined) {
      return next(e)
    }
    const veiled = { ...e, props: { ...e.props, text: shown } }
    if (!canPress(e)) {
      return next(veiled)
    }

    // The engine still draws the row; a diamond beside it opens this one message.
    const open = memberOf(opened, e)
    const isOpen = await read($, open)
    const drawn = await next(isOpen ? e : veiled)
    const { Box, Button, Text } = $.ui.resolve(e)

    // A one-glyph plain Button: a Markdown link would print its address beside the glyph.
    return (
      <Box flexDirection="row" alignItems="flex-end" gap={1}>
        {drawn}
        <Button key={`veil-open-${e.requestId}`} plain onPress={() => update($, open, was => !was)}>
          <Text color={isOpen ? 'yellow' : 'cyan'}>{isOpen ? '◇' : '◆'}</Text>
        </Button>
      </Box>
    )
  })

  // The hint line under the prompt: the engine's hint on the left, the meter on the right.
  // Its button answers REVEAL_ACTION, so the chord bound to it reveals the originals.
  on('ui.render', { component: 'PromptHint' }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = parseSettings(await read($, settings))
    const isRevealed = await read($, revealed)
    const glyph = isRevealed ? '◇' : '◆'
    const toggle = () => update($, revealed, r => !r)

    let meter = ''
    if (s.meter) {
      const spent = periods(await read($, usage), await $.clock.now(), await read($, sessionStart)).session
      const ours = MODELS.find(m => m.id === s.model)?.label ?? s.model
      meter = ` ${fmt(spent.total)} tok (${ours}) · ${await $.session.model()}`
    }

    return (
      <Box justifyContent="space-between" width="100%">
        <Text dimColor wrap="truncate-end">
          {e.props.hint}
        </Text>
        <Button key="veil-reveal" plain action={REVEAL_ACTION} onPress={toggle}>
          <Text color={isRevealed ? 'yellow' : 'cyan'}>{glyph}</Text>
          <Text dimColor>{meter}</Text>
        </Button>
      </Box>
    )
  })
}
