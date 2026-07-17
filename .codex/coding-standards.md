# Padroes de codigo

## TypeScript e Next.js

- Mantenha `strict` habilitado e evite `any`; quando inevitavel, limite o cast ao menor escopo.
- Respeite a fronteira entre Server Components e Client Components.
- Use `"use client"` somente quando houver estado, eventos ou APIs do navegador.
- Segredos, `service_role` e clientes administrativos pertencem exclusivamente ao servidor.
- Use `NEXT_PUBLIC_` apenas para valores deliberadamente publicos.
- Trate erros externos sem expor tokens, respostas sensiveis ou detalhes internos ao usuario.

## Organizacao

- Rotas e telas ficam em `app/`.
- Integracoes e regras reutilizaveis ficam em `lib/`.
- O backend MCP fica isolado em `mcp-server/`.
- Evite duplicar logica de autorizacao, redacao de dados ou acesso Supabase.
- Atualize tipos, documentacao e testes junto com mudancas de contrato.

## Interface

- Preserve a identidade visual HERO.FamilyOS e os assets oficiais em `public/brand/` e `public/icons/`.
- Use portugues do Brasil para textos de interface.
- Garanta estados de carregamento, vazio, sucesso e erro nas integracoes.
- Preserve acessibilidade basica: labels, foco, contraste e texto alternativo.

## Dependencias

- Nao instale dependencia sem necessidade demonstravel.
- Versione o lockfile junto com qualquer mudanca de dependencia.
- Nao execute `npm audit fix --force` sem revisar mudancas incompatíveis e validar a aplicacao.

## Qualidade

- Prefira mudancas pequenas, coesas e verificaveis.
- Nao silencie erros que impedem diagnostico; exponha mensagens seguras e registre detalhes apenas no backend.
- Nao altere arquivos fora do escopo nem descarte mudancas existentes do usuario.
