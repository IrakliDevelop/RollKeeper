begin;

select plan(9);

select ok(
  not has_table_privilege('authenticated', 'public.characters', 'DELETE'),
  'authenticated clients cannot delete characters directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.characters', 'TRUNCATE'),
  'authenticated clients cannot truncate characters'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.guard_character_identity_and_tombstone()',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the character guard function'
);

set local role anon;
select throws_ok(
  $$select id from public.characters$$,
  '42501',
  null,
  'anonymous users cannot read characters'
);
select throws_ok(
  $$insert into public.characters (
      id, owner_id, legacy_client_id, name, payload, schema_version,
      client_revision, server_version
    ) values (
      'a0000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      'anonymous-write',
      'Denied',
      '{}'::jsonb,
      1,
      1,
      1
    )$$,
  '42501',
  null,
  'anonymous users cannot write characters'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select results_eq(
  $$select name from public.characters order by id$$,
  $$values ('User A Character'::text)$$,
  'User A can read User A character'
);
select throws_ok(
  $$update public.characters
    set name = 'Direct write bypass'
    where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticated clients cannot bypass mutation receipts with direct writes'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
select is_empty(
  $$select id from public.characters
    where id = 'a0000000-0000-4000-8000-000000000001'$$,
  'User B cannot read User A character'
);

reset role;
select throws_ok(
  $$update public.characters
    set owner_id = '20000000-0000-4000-8000-000000000002'
    where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501',
  'character ownership cannot be reassigned',
  'character ownership is immutable'
);

select * from finish();
rollback;
