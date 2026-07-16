# Security

## Authentication

- Accepts Supabase JWT in `Authorization: Bearer ...`.
- Validates the bearer token with the project's Supabase Auth server.
- Rejects token without `sub`.

## Family Scope

- Resolves active family membership from `family_members`.
- Every domain query uses `family_id` from resolved context.
- If a user belongs to multiple families, callers must pass `x-familyos-family-id`.

## Authorization

- Tool-level capability checks via `x-familyos-capabilities` header.
- Missing capability returns structured `CAPABILITY_REQUIRED`.
- Audit reads require `audit.read` plus owner/admin family role.

## Auditing

- Every tool call writes `public.mcp_audit_logs` through the backend service role after user, family, and capability validation.
- Inputs and results are summarized with redaction for authorization headers, tokens, Base64 file payloads, CPF/document numbers, account numbers, keys, and raw OCR text.
- Authenticated clients can select audit rows only when `private.can_admin_family(family_id)` is true. Client insert/update/delete policies are denied.

## Google Tokens

- MCP clients may pass a short-lived token in `x-google-access-token`.
- Scopes are declared in `x-google-scopes`.
- Tokens are never returned in tool responses and are redacted from audit summaries.
- If write scope is missing, Calendar tools return `CALENDAR_SCOPE_REQUIRED` with `reconnectRequired: true`.

## Hardening Recommendations

- Use short JWT expiry and refresh in caller layer.
- Prefer asymmetric Supabase JWT signing keys when configuring future key rotation.
- Restrict who can issue capability headers.
- Keep service role only on the MCP server.
- Do not expose `x-familyos-capabilities` issuance to untrusted clients.
