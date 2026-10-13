# painel

Mod do Claude Code que personaliza como suas mensagens aparecem no chat. Abra o menu com `/painel`.

## Estilos

- **Desativado**: mensagens normais.
- **Hexadecimal**: blocos hex derivados do texto.
- **Code Language**: o Haiku reescreve a mensagem como pseudo-código na linguagem escolhida (Python, JavaScript, Rust, Go, C, SQL, Bash, Lua, Haskell).

`ctrl+o` mostra o texto original. A escolha fica salva entre sessões.

## Desenvolvimento

```
claude plugin validate .
claude plugin test .
```

Novos estilos entram na lista `STYLES` em `hooks/styles.ts`.
