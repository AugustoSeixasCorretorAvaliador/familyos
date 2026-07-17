# FamilyOS - arquitetura oficial

## Produto

FamilyOS e o sistema operacional da familia. Centraliza pessoas, documentos, saude, patrimonio, financas, agenda, tarefas, processos, timeline, alertas e contexto familiar.

## Frontend e aplicacao web

- Next.js 14.2.35 com App Router e React Server Components.
- React 18 e TypeScript 5.
- Tailwind CSS 3.4.
- Aplicacao em `app/`, componentes compartilhados em `app/components/` e integracoes em `lib/`.
- Autenticacao SSR com `@supabase/ssr` e callback OAuth em `app/auth/callback/`.

## Backend e dados

- Supabase Postgres como fonte de verdade.
- Supabase Auth para identidade e sessoes.
- Supabase Storage para arquivos privados.
- RLS e grants de privilegio minimo como camadas obrigatorias de autorizacao.
- Projeto remoto oficial: `ffzqloiwmbvbeycaevfm`.

## IA e processamento

- Provedores de IA configurados somente por variaveis privadas de ambiente.
- OCR com Google Vision para imagens e extracao de PDF no backend.
- Nenhuma chave de IA pode usar prefixo `NEXT_PUBLIC_`.

## Google Workspace

- Login Google mediado pelo Supabase Auth.
- Google Calendar acessado com token de provedor de curta duracao e escopos minimos.
- O frontend nao persiste tokens Google no banco.

## MCP

- Servidor independente em `mcp-server/`.
- Node.js, TypeScript, Zod e `@modelcontextprotocol/sdk`.
- Transporte local stdio; nao existe porta HTTP no estado atual.
- Autenticacao com access token Supabase, escopo por familia, capabilities por ferramenta e auditoria persistente.

## Principios arquiteturais

1. Preservar compatibilidade de contratos, rotas, schemas e ferramentas.
2. Manter autorizacao no banco por RLS, mesmo quando houver validacao na aplicacao.
3. Separar clientes publicos de clientes administrativos.
4. Usar migrations versionadas para toda mudanca de schema.
5. Manter credenciais apenas em ambiente privado e fora do Git.
6. Preferir integracoes reais e testaveis; identificar stubs explicitamente.
