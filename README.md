# veil

A Claude Code mod that changes how your messages look in the chat. Open it with `/veil`.

## Styles

- **Off**: messages as typed.
- **Model styles**: the message is rewritten by a model you pick (Haiku by default).
  - **Code Language**: pseudo-code in Python, JavaScript, Rust, Go, C, SQL, Bash, Lua or Haskell.
  - **Log**: system log lines.
  - **Emojis**: the request told with emojis only.
- **Offline styles**, instant and free: Hexadecimal, Binary, Morse, Runes, Braille, Matrix, ROT13, Glitch.

Each message keeps the style it was sent with.

## Seeing the originals

- `ctrl+o` opens the transcript with the originals.
- `/reveal` shows or hides them in place.
- `ctrl+x r` does the same as `/reveal`. Claude Code has no custom key actions for mods, so the mod answers the unused `app:toggleReplTab` action. Bind it in `~/.claude/keybindings.json`:

```json
{
  "bindings": [{ "context": "Global", "bindings": { "ctrl+x r": "app:toggleReplTab" } }]
}
```

## Settings

The **Settings** tab sets the interface and output language (English, Português, Español), the model, effort, retry when the reply copies the message, detail level and the live meter.

## Usage

The **Usage** tab counts the exact tokens the mod spends, from the API's own usage report: per session, today, 7 days, 30 days and all time; per model; per message; and the average per message with the current settings. The live meter on the right of the hint line under the prompt shows the session's tokens, the mod's model and the session model.

## Development

```
claude plugin validate .
claude plugin test .
```

New styles go in `STYLES` in `hooks/styles.ts`, with their text in `hooks/i18n.ts`.
