create table public.characters (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete restrict,
  legacy_client_id text not null check (length(legacy_client_id) between 1 and 255),
  name text not null check (length(name) between 1 and 255),
  payload jsonb not null,
  schema_version integer not null check (schema_version >= 1),
  client_revision bigint not null check (client_revision >= 0),
  server_version bigint not null check (server_version >= 1),
  deleted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint characters_owner_legacy_client_id_key
    unique (owner_id, legacy_client_id)
);

alter table public.characters enable row level security;

revoke all on table public.characters from public, anon;
grant select, insert, update on table public.characters to authenticated;

create policy characters_select_own
on public.characters
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy characters_insert_own
on public.characters
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy characters_update_own
on public.characters
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create function public.guard_character_identity_and_tombstone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception using
      errcode = '42501',
      message = 'character ownership cannot be reassigned';
  end if;

  if old.deleted_at is not null and new.deleted_at is null then
    raise exception using
      errcode = '42501',
      message = 'ordinary writes cannot resurrect a character tombstone';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_character_identity_and_tombstone() from public;

create trigger guard_character_identity_and_tombstone
before update on public.characters
for each row
execute function public.guard_character_identity_and_tombstone();
