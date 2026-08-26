begin;

select plan(9);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.put_character(
    '30000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'First CAS',
    '{"cycle":1}'::jsonb,
    1,
    2,
    1
  ) ->> 'status',
  'success',
  'a compare-and-swap update succeeds at the expected version'
);

select is(
  public.put_character(
    '30000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'First CAS',
    '{"cycle":1}'::jsonb,
    1,
    2,
    1
  ),
  public.put_character(
    '30000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'First CAS',
    '{"cycle":1}'::jsonb,
    1,
    2,
    1
  ),
  'retrying after a committed response loss returns the original receipt'
);

select throws_ok(
  $$select public.put_character(
      '30000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001',
      'local-character-a',
      'Changed reuse',
      '{"cycle":"different"}'::jsonb,
      1,
      3,
      2
    )$$,
  '22023',
  'mutation ID was already used with different input',
  'reusing a mutation ID with different input is rejected'
);

select is(
  public.put_character(
    '30000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'CAS winner',
    '{"cycle":2}'::jsonb,
    1,
    3,
    2
  ) ->> 'status',
  'success',
  'the first request at a server version succeeds'
);

select is(
  public.put_character(
    '30000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'CAS loser',
    '{"cycle":3}'::jsonb,
    1,
    4,
    2
  ) ->> 'status',
  'conflict',
  'a stale compare-and-swap request conflicts'
);

reset role;
update public.characters
set deleted_at = '2026-08-16 01:00:00+00'
where id = 'a0000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.put_character(
    '30000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    'local-character-a',
    'Resurrection attempt',
    '{"cycle":4}'::jsonb,
    1,
    5,
    3
  ) ->> 'status',
  'tombstoned',
  'ordinary writes report a tombstone instead of resurrecting it'
);

select isnt(
  deleted_at,
  null,
  'the tombstone remains present'
)
from public.characters
where id = 'a0000000-0000-4000-8000-000000000001';

select is(
  payload,
  '{"cycle":2}'::jsonb,
  'the resurrection attempt does not replace tombstoned payload data'
)
from public.characters
where id = 'a0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select * from public.mutation_receipts$$,
  '42501',
  null,
  'mutation receipts are inaccessible directly'
);

select * from finish();
rollback;
