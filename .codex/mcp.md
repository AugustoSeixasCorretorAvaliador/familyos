# FamilyOS MCP

## Localizacao e transporte

- Codigo: `mcp-server/`.
- Entrada: `mcp-server/src/index.ts`.
- Transporte atual: stdio.
- O servidor nao escuta `localhost:3001` nem qualquer outra porta.
- `stdout` e exclusivo do protocolo MCP; logs devem ir para `stderr`.

## Seguranca

- Valide bearer tokens com o Supabase Auth.
- Resolva uma associacao ativa em `family_members` antes de executar ferramenta de dominio.
- Exija `family_id` quando o usuario pertencer a mais de uma familia.
- Derive do papel familiar validado no servidor as capabilities definidas em `src/tools/capabilities.ts`.
- Trate capabilities recebidas do cliente somente como reducao de escopo solicitada; nunca como autoridade.
- Nunca registre bearer tokens, tokens Google, conteudo Base64 ou dados pessoais completos.
- `SUPABASE_SERVICE_ROLE` e permitido somente no processo backend do MCP.

## Acesso remoto do Codex ao Supabase

- Servidor configurado: `supabase_familyos`.
- Projeto vinculado: `ffzqloiwmbvbeycaevfm`.
- Autenticacao ativa: Bearer Token fornecido pela variavel de ambiente `SUPABASE_FAMILYOS_TOKEN`.
- Nao execute `codex mcp login` e nao troque a autenticacao deste servidor por OAuth.
- O valor do token nunca deve aparecer em arquivos, comandos documentados, logs ou respostas.
- OAuth continua sendo um fluxo separado da aplicacao quando aplicavel; nao e o metodo de autenticacao do MCP `supabase_familyos`.

## Contexto stdio

Chamadas locais autenticadas usam `_meta` com namespace `familyos/*`:

- `familyos/authorization`
- `familyos/capabilities` (escopo solicitado, limitado pelas capabilities derivadas no servidor)
- `familyos/family-id`
- `familyos/client-name`
- `familyos/client-version`

O transporte HTTP futuro pode mapear os cabecalhos equivalentes, mas nao deve mudar os contratos das ferramentas existentes.

## Ferramentas

- `get_dashboard` fornece o resumo executivo atual.
- `get_family_context` fornece contexto de familia e membros.
- Nao existe uma ferramenta chamada `family_summary` no contrato atual.
- Toda nova ferramenta deve ter schema Zod, capability, escopo familiar, tratamento de erro e auditoria.

## Comandos

```powershell
cd mcp-server
npm run dev
npm run lint
npm run test
npm run build
```

Smoke test MCP real:

```powershell
$env:MCP_TEST_ACCESS_TOKEN = "<access token Supabase de curta duracao>"
$env:MCP_TEST_FAMILY_ID = "<UUID, apenas se necessario>"
npm run smoke
Remove-Item Env:MCP_TEST_ACCESS_TOKEN
Remove-Item Env:MCP_TEST_FAMILY_ID -ErrorAction SilentlyContinue
```

Nunca grave o token de smoke test em arquivo versionado.
