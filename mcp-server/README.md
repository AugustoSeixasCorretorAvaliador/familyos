# FamilyOS MCP Server v1.0

Standalone MCP backend for FamilyOS with Supabase JWT auth, family-scoped access, capability-based tool authorization, and audit logging.

## Features

- MCP stdio server using `@modelcontextprotocol/sdk`
- Supabase JWT validation through the Auth server and active `family_members` check
- Family-level data scoping in all services
- Capability gate per tool via `x-familyos-capabilities`
- Persistent audit logs in `public.mcp_audit_logs`, with masked summaries
- Real document upload/versioning/OCR job/review flow against private Supabase Storage
- Google Calendar read/write calls when the MCP client supplies a Google access token and scopes
- Domain tools for dashboard, people, documents, health, patrimonio, financas, agenda, timeline, alertas, tarefas, processos, family context, knowledge graph, executive AI
- Docker + CI + Vitest baseline

## Project Structure

- `src/auth`: JWT and session context
- `src/config`: env and logger
- `src/middleware`: audit hooks
- `src/models`: shared types
- `src/providers`: external providers abstractions
- `src/services`: family-scoped domain services
- `src/tools`: MCP tool schemas, capability map, registry
- `src/server`: MCP bootstrap and health checks
- `supabase/migrations`: SQL required by the MCP server

## Environment

Copy `.env.example` to `.env` and configure:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE` (required for audit writes, storage uploads, document pipeline, and health DB check)

Optional provider keys are in `.env.example`.

For local monorepo development, the server also loads `../.env.local` and maps
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` when the MCP-specific
variables are not set. Server-only credentials such as `SUPABASE_SERVICE_ROLE` are
never read from `NEXT_PUBLIC_*` variables.

## Development

```bash
npm install
npm run dev
```

## Build and Run

```bash
npm run build
npm run start
```

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Local MCP smoke test

The stdio server accepts per-call authentication through MCP request `_meta` using
the `familyos/*` namespace. The bundled client verifies discovery, calls `health`,
and then executes the real `get_dashboard` tool:

```powershell
$env:MCP_TEST_ACCESS_TOKEN = "<short-lived Supabase access token>"
# Only required when the user belongs to more than one family:
$env:MCP_TEST_FAMILY_ID = "<family UUID>"
npm run smoke
Remove-Item Env:MCP_TEST_ACCESS_TOKEN
Remove-Item Env:MCP_TEST_FAMILY_ID -ErrorAction SilentlyContinue
```

Never commit the access token or place it in `.env.example`. It is sent only through
the local stdio pipe and is not included in audit input summaries.

## Security Model

1. Caller sends `Authorization: Bearer <supabase_jwt>`.
2. Server validates the JWT with the project's Supabase Auth server.
3. Server confirms active membership in `family_members`.
4. Tool access is checked against `x-familyos-capabilities`.
5. Domain queries always apply `family_id` from auth context.
6. Users with more than one family must send `x-familyos-family-id`.
7. Google Calendar tools use `x-google-access-token` and `x-google-scopes`; tokens are never returned or audited.

## Notes

- Run `supabase/migrations/20260716120000_create_mcp_audit_logs.sql` in Supabase before enabling audit query tools.
- `upload_document` accepts Base64 payloads up to 20 MB because stdio MCP can carry this v1 flow. For larger files, add a signed-upload two-step flow.
- The Web app currently keeps Google `provider_token` in session, not durable storage. MCP Calendar write tools therefore require the client to provide a valid short-lived Google token and the `https://www.googleapis.com/auth/calendar.events` scope.
