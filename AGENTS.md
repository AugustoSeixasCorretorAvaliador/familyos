# FamilyOS - instrucoes do projeto

Estas regras se aplicam a todo o repositorio. Antes de alterar um subsistema, leia o documento correspondente em `.codex/`.

## Fonte de verdade

- Arquitetura: `.codex/architecture.md`
- Padroes de codigo: `.codex/coding-standards.md`
- Banco e Supabase: `.codex/database-rules.md`
- Servidor MCP: `.codex/mcp.md`
- Validacao, commit e release: `.codex/release-process.md`

## Regras obrigatorias

- Preserve compatibilidade e comportamento existente, salvo mudanca explicitamente solicitada.
- Nunca exponha `service_role`, secret keys, tokens ou credenciais no frontend, em logs ou no Git.
- Toda tabela em schema exposto deve usar RLS e privilegio minimo.
- Toda mudanca de schema deve possuir migration versionada e validada.
- Nao altere arquivos em `sql/diagnostics/` nem `sql/seeds/004_seixasos_mvp_data_backfill.sql` sem pedido explicito.
- Nao use `git add -A` em uma arvore mista; faca staging explicito.
- Antes de qualquer commit, execute todos os checks definidos em `.codex/release-process.md`.
- Use portugues do Brasil na interface e preserve nomes tecnicos, APIs e identificadores em ingles.

## Versoes atuais

- Next.js 14.2.35 com App Router
- React 18
- Tailwind CSS 3.4
- TypeScript 5
- Supabase para Postgres, Auth e Storage
- MCP em Node.js/TypeScript com transporte stdio

Nao documente uma versao futura como se ja estivesse instalada. Atualize este arquivo junto com qualquer upgrade de stack.
