-- Private, immutable logical snapshots for reversible family consolidation.

create schema if not exists private;

create table if not exists private.family_consolidation_backups (
  id uuid primary key default gen_random_uuid(),
  source_family_id uuid not null,
  target_family_id uuid not null,
  reason text not null,
  snapshot jsonb not null,
  snapshot_sha256 text not null
    check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (source_family_id <> target_family_id)
);

alter table private.family_consolidation_backups enable row level security;

revoke all on table private.family_consolidation_backups
from public, anon, authenticated, service_role;

comment on table private.family_consolidation_backups is
  'Private logical snapshots created before reversible family consolidation.';
