begin;

select plan(14);

select ok(
  has_function_privilege(
    'authenticated',
    'public.soft_delete_character(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated users can archive through the RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.restore_character(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated users can restore through the RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.soft_delete_character(uuid,uuid,bigint)',
    'EXECUTE'
  ),
  'anonymous users cannot archive characters'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.put_character(
    '51000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'manual-cloud-character',
    'Manual cloud copy',
    '{"id":"manual-cloud-character","unknown":null}'::jsonb,
    1,
    4,
    0
  ) ->> 'status',
  'success',
  'first upload succeeds'
);

select is(
  public.put_character(
    '51000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    'manual-cloud-character',
    'Manual cloud copy',
    '{"id":"manual-cloud-character","unknown":null}'::jsonb,
    1,
    4,
    0
  ) ->> 'characterId',
  'b0000000-0000-4000-8000-000000000001',
  'a repeated first upload resolves idempotently by owner and legacy ID'
);

select is(
  (select count(*)::integer from public.characters
   where legacy_client_id = 'manual-cloud-character'),
  1,
  'owner and legacy ID idempotency creates only one row'
);

select is(
  public.soft_delete_character(
    '52000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    1
  ) ->> 'status',
  'success',
  'archive succeeds at the expected version'
);

select isnt(
  deleted_at,
  null,
  'archive records a soft-deletion timestamp'
)
from public.characters
where id = 'b0000000-0000-4000-8000-000000000001';

select is(
  payload,
  '{"id":"manual-cloud-character","unknown":null}'::jsonb,
  'archive leaves the passthrough payload unchanged'
)
from public.characters
where id = 'b0000000-0000-4000-8000-000000000001';

select is(
  public.soft_delete_character(
    '52000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    1
  ),
  public.soft_delete_character(
    '52000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    1
  ),
  'archive response-loss retry returns the original receipt'
);

select is(
  public.restore_character(
    '53000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    2
  ) ->> 'status',
  'success',
  'an archived cloud copy can be restored'
);

select is(
  deleted_at,
  null,
  'restore clears only the soft-deletion timestamp'
)
from public.characters
where id = 'b0000000-0000-4000-8000-000000000001';

select is(
  payload,
  '{"id":"manual-cloud-character","unknown":null}'::jsonb,
  'restore leaves the passthrough payload unchanged'
)
from public.characters
where id = 'b0000000-0000-4000-8000-000000000001';

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);

select is(
  public.soft_delete_character(
    '54000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    3
  ) ->> 'status',
  'conflict',
  'User B cannot archive User A cloud data'
);

select * from finish();
rollback;
