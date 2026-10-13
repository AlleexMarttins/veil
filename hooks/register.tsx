import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Settings } from '../types'
import { lookup } from './lookup'
import { DEFAULT_LANG, DEFAULT_STYLE, LANGUAGES, SAMPLE, STYLES, exampleOf, langOf, parseSettings, styleOf } from './styles'
import { buildPrompt, clean, echoes, maxTokensFor } from './translate'

const PANE = 'painel'
const KEEP = 200
const cache = atom({ plugin: 'painel', key: 'cache' } as const, {} as Record<string, string>)
const settings = atom(
  { plugin: 'painel', key: 'settings' } as const,
  { style: DEFAULT_STYLE, lang: DEFAULT_LANG } as Settings,
)
// The style each message was sent with, by its text.
const sent = atom({ plugin: 'painel', key: 'sent' } as const, {} as Record<string, Settings>)
const view = atom({ plugin: 'painel', key: 'view' } as const, 'main' as 'main' | 'lang')

const cacheKey = (style: string, lang: string, text: string) => `${style}:${lang}\n${text}`

export const register: Register = on => {
  const pending = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'painel', description: 'Estilo das suas mensagens no chat' })
    const saved = parseSettings(await $.store.get('settings'))
    await update($, settings, () => saved)

    return next(e)
  })

  on('command.run', { command: 'painel' }, async $ => {
    await update($, view, () => 'main')
    await $.ui.open({ id: PANE, title: 'Painel', focus: true, closeOnEscape: true })

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await read($, settings)
    const where = await read($, view)
    const active = styleOf(current)
    const language = langOf(current)

    const save = async (updated: Settings) => {
      await update($, settings, () => updated)
      await $.store.set('settings', updated)
    }

    const header = (title: string) => (
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
    )

    if (where === 'lang') {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
          {header('✦ Code Language')}
          {LANGUAGES.map((l, i) => {
            const isActive = l.id === language.id

            return (
              <Button
                key={l.id}
                hotkey={String(i + 1)}
                onPress={async () => {
                  await save({ style: 'code', lang: l.id })
                  await update($, view, () => 'main')
                }}
              >
                <Text color={isActive ? 'green' : 'gray'} bold>
                  {isActive ? '◉' : '○'}
                </Text>{' '}
                <Text bold={isActive} dimColor={!isActive}>
                  {l.label}
                </Text>
              </Button>
            )
          })}
          <Box marginTop={1}>
            <Button key="back" hotkey="b" dimColor onPress={() => update($, view, () => 'main')}>
              ← Voltar
            </Button>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        {header('✦ Estilo das mensagens')}
        {STYLES.map((s, i) => {
          const isActive = s.id === active.id
          const detail = s.hasLanguages ? `${language.label} ›` : ''

          return (
            <Button
              key={s.id}
              hotkey={i < 9 ? String(i + 1) : undefined}
              onPress={async () => {
                await save({ style: s.id, lang: language.id })
                if (s.hasLanguages) await update($, view, () => 'lang')
              }}
            >
              <Text color={isActive ? 'green' : 'gray'} bold>
                {isActive ? '◉' : '○'}
              </Text>{' '}
              <Text bold={isActive} dimColor={!isActive}>
                {s.label}
              </Text>
              {detail ? <Text dimColor>{`  ${detail}`}</Text> : ''}
            </Button>
          )
        })}
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text>{active.about}</Text>
          {active.id !== 'off' && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>{SAMPLE}</Text>
              <Text color="cyan">{exampleOf(active, language.label)}</Text>
            </Box>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>ctrl+o mostra o original · esc fecha</Text>
        </Box>
      </Box>
    )
  })

  on('prompt.submit', async ($, e, next) => {
    const text = e.text
    const s = await read($, settings)
    const language = langOf(s)
    const style = styleOf(s)
    const key = cacheKey(style.id, language.id, text)
    if (style.id !== 'off' && text.trim() !== '') {
      await update($, sent, m => {
        const merged = { ...m, [text]: { style: style.id, lang: language.id } }
        const keys = Object.keys(merged)
        for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete merged[k]
        return merged
      })
    }
    const system = style.system
    if (system && text.trim() !== '' && !pending.has(key)) {
      pending.add(key)
      // Not awaited: the row is drawn right away either way, holding '⋯' until this lands.
      void (async () => {
        let wrote = false
        try {
          // One retry when the model pastes the message back as a literal.
          for (const attempt of [0, 1]) {
            const r = await $.model.complete({
              model: 'haiku',
              system: system(language.label),
              prompt: attempt === 0 ? buildPrompt(text) : `${buildPrompt(text)}\nNão cite o texto: escreva só o resultado que representa o que ele pede.`,
              maxTokens: maxTokensFor(text),
              effort: 'low',
              timeoutMs: 5000,
            })
            if (!r.isAnswered) break
            const code = clean(r.text)
            if (code === '' || echoes(code, text)) continue

            await update($, cache, c => {
              const merged = { ...c, [key]: code }
              const keys = Object.keys(merged)
              for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete merged[k]
              return merged
            })
            wrote = true
            break
          }
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
    if (e.props.origin.kind !== 'composer' || e.props.isExpanded) {
      return next(e)
    }

    const current = await read($, settings)
    if (styleOf(current).id === 'off') {
      return next(e)
    }

    // A message keeps the style it was sent with; switching styles restyles new ones only.
    const s = (await read($, sent))[e.props.text] ?? current
    const style = styleOf(s)
    const found = style.system
      ? lookup(e.props.text, cacheKey(style.id, langOf(s).id, ''), await read($, cache), pending)
      : { isWaiting: false }
    // The row is drawn while Haiku still works: hold a placeholder, not the hex fallback.
    const shown = found.isWaiting ? '⋯' : style.render(e.props.text, found.translated)

    return shown === undefined ? next(e) : next({ ...e, props: { ...e.props, text: shown } })
  })
}
