# Prompt para o Copilot Chat / Codex Agent (modo Agent, no VS Code)

Cole isso inteiro no painel de chat, com o modo **Agent** selecionado, dentro da pasta do repo `familyos` já clonado.

---

Crie um projeto Next.js 14 (App Router, TypeScript, Tailwind) dentro desta pasta, conectado ao Supabase, seguindo estas especificações:

## 1. Setup do projeto
- Inicialize com `create-next-app` (App Router, TS, Tailwind, sem `src/` — usar diretório raiz `app/`)
- Instale `@supabase/supabase-js` e `@supabase/ssr`
- Crie `.env.local` com placeholders:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  ```
  (vou preencher manualmente com os valores do projeto Supabase "familyos")
- Adicione `.env.local` ao `.gitignore` se ainda não estiver

## 2. Cliente Supabase
Crie `lib/supabase/client.ts` com um cliente browser padrão usando `createBrowserClient` de `@supabase/ssr`, lendo as env vars acima.

## 3. Schema de referência (já existe no banco, não recriar)
O banco já tem estas tabelas relevantes (schema em `public`, criado via `01_PostgreSQL_Schema_2.sql` + `02_Supabase_Auth_RLS.sql`):

- `families (id, name, description, created_at, ...)`
- `people (id, family_id, first_name, last_name, birth_date, cpf, email, phone, ...)`
- `documents (id, person_id, document_type, number, expiration_date, status, ...)`
- `properties (id, family_id, title, address, city, property_type, ...)`
- `alerts (id, related_entity_type, related_entity_id, severity, title, description, due_date, status, ...)`
- `tasks (id, assigned_person_id, alert_id, title, due_date, status, ...)`
- `family_members (id, family_id, user_id, person_id, role, status, ...)` — liga `auth.users` a `people`

RLS já está habilitada: um usuário só vê dados da família onde é `family_members.status = 'active'`.

## 4. Página Dashboard
Crie `app/dashboard/page.tsx` (Server Component) que:
1. Busca a família do usuário logado via `family_members` (join com `families`)
2. Busca contagem de `people`, `properties`, `documents` ativos da família
3. Busca até 5 `alerts` com `status = 'open'` ordenados por `due_date` ascendente, mais urgentes primeiro
4. Renderiza em cards simples com Tailwind:
   - Saudação: "Bom dia, {nome}." + data de hoje
   - Card "Alertas" listando os alerts (título + due_date)
   - Card "Família" com contadores (pessoas / imóveis / documentos)
   - Estado vazio elegante se não houver dados ainda (não quebrar se as tabelas estiverem vazias)

## 5. Autenticação mínima
Crie `app/login/page.tsx` com botão "Entrar com Google" usando `supabase.auth.signInWithOAuth({ provider: 'google' })`, e middleware básico (`middleware.ts`) redirecionando `/dashboard` para `/login` se não houver sessão.

## 6. Rodar local
Ao final, rode `npm run dev` e confirme que a página `/login` carrega sem erros de build.

---

**Depois que isso rodar localmente:**
- Preencha o `.env.local` com a Project URL e a Publishable key do Supabase (aba "Get Connected" no dashboard do projeto)
- Rode `npm run dev` e abra `http://localhost:3000`
- Faça login, e se `family_members` ainda não tiver seu usuário linkado a uma família, insira manualmente uma linha via Table Editor do Supabase para testar
