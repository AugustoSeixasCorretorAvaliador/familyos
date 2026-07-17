# Processo de release

## Antes de alterar

1. Confirme o repositorio, branch e remote corretos.
2. Leia `AGENTS.md` e o documento `.codex/` relevante.
3. Inspecione `git status` e preserve alteracoes nao relacionadas.
4. Para Supabase, confirme o project ref `ffzqloiwmbvbeycaevfm`.

## Validacao obrigatoria antes de commit

Aplicacao web, na raiz:

```powershell
npm run lint
npm run build
```

Servidor MCP:

```powershell
npm --prefix mcp-server run lint
npm --prefix mcp-server run test
npm --prefix mcp-server run build
```

Checks Git:

```powershell
git diff --check
git status --short
git diff --cached --check
```

Se um comando nao existir ou nao se aplicar ao escopo, nao finja que passou: registre a excecao e execute o equivalente mais proximo. Atualmente a raiz nao possui script `test`; os testes automatizados vivem no `mcp-server`.

## Banco

- Revise a migration antes da aplicacao.
- Valide schema, RLS, policies, grants, indices, historico e advisors depois da aplicacao.
- Mantenha migration local e estado remoto sincronizados.

## Commit e push

1. Faca staging apenas dos arquivos aprovados.
2. Confirme que segredos, `.env`, diagnosticos e seeds fora de escopo nao foram adicionados.
3. Use mensagem curta no formato Conventional Commits quando apropriado.
4. Atualize-se com `origin/main` antes do push.
5. Nao use force push em `main`.

## Release/tag

- Publique tag apenas depois de build, testes, smoke test relevante e verificacao de migrations.
- Para mudancas MCP, confirme `tools/list` e ao menos uma `tools/call` real autenticada.
- Documente limitacoes, avisos dos advisors e passos manuais restantes.
