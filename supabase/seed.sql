insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'user-a@rollkeeper.local',
    '2026-08-16 00:00:00+00',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '2026-08-16 00:00:00+00',
    '2026-08-16 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'user-b@rollkeeper.local',
    '2026-08-16 00:00:00+00',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '2026-08-16 00:00:00+00',
    '2026-08-16 00:00:00+00'
  )
on conflict (id) do update
set
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into public.characters (
  id,
  owner_id,
  legacy_client_id,
  name,
  payload,
  schema_version,
  client_revision,
  server_version,
  created_at,
  updated_at
)
values (
  'a0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'local-character-a',
  'User A Character',
  '{"source":"deterministic-seed"}'::jsonb,
  1,
  1,
  1,
  '2026-08-16 00:00:00+00',
  '2026-08-16 00:00:00+00'
)
on conflict (id) do update
set
  name = excluded.name,
  payload = excluded.payload,
  schema_version = excluded.schema_version,
  client_revision = excluded.client_revision,
  server_version = excluded.server_version,
  deleted_at = null,
  updated_at = '2026-08-16 00:00:00+00';
