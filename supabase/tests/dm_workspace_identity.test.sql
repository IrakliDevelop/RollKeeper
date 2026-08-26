begin;

select plan(33);

select has_table('public', 'campaigns', 'campaign workspaces exist');
select has_table(
  'public',
  'campaign_authority_records',
  'independent authority records exist'
);
select has_table(
  'public',
  'campaign_workspace_claim_provenance',
  'sanitized claim provenance exists'
);
select has_table(
  'private',
  'workspace_claim_authorizations',
  'claim authorizations are private'
);
select has_index(
  'public',
  'campaigns',
  'campaigns_owner_id_idx',
  'workspace ownership foreign key is indexed'
);
select has_index(
  'public',
  'campaign_workspace_claim_provenance',
  'campaign_workspace_claim_provenance_claimant_id_idx',
  'claimant provenance foreign key is indexed'
);
select has_index(
  'public',
  'campaign_workspace_claim_provenance',
  'campaign_workspace_claim_provenance_authorization_id_idx',
  'claim authorization provenance foreign key is indexed'
);
select has_index(
  'private',
  'campaign_mutation_receipts',
  'campaign_mutation_receipts_campaign_id_idx',
  'workspace mutation receipt foreign key is indexed'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_campaign_workspace(uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can create owner workspaces'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_campaign_workspace(uuid,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot create owner workspaces'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated users cannot access claim authorization storage'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

create temporary table created_workspace as
select public.create_campaign_workspace(
  '60000000-0000-4000-8000-000000000001',
  'Northwatch',
  'new_workspace',
  null
) as result;

select is(
  result ->> 'membershipAuthority',
  'legacy',
  'workspace creation keeps membership legacy'
)
from created_workspace;
select is(
  result ->> 'familyAuthorities',
  'legacy',
  'workspace creation cuts over no durable family'
)
from created_workspace;
select is(
  result ->> 'liveRuntimeAuthority',
  'redis_relay',
  'workspace creation keeps Redis and relay authoritative'
)
from created_workspace;
select matches(
  result ->> 'displayCode',
  '^[A-F0-9]{12}$',
  'workspace receives a new opaque display code'
)
from created_workspace;

select is(
  (
    select count(*)::integer
    from public.campaign_authority_records
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from created_workspace
    )
  ),
  11,
  'workspace, membership, eight families, and live runtime are independent records'
);
select is(
  (
    select count(*)::integer
    from public.campaign_authority_records
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from created_workspace
    )
      and axis = 'durable_family'
      and authority = 'legacy'
  ),
  8,
  'all durable family authorities begin as legacy'
);
select is(
  (
    select count(*)::integer
    from public.campaign_authority_records
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from created_workspace
    )
      and axis = 'membership'
      and authority = 'legacy'
      and epoch = 0
  ),
  1,
  'membership authority is explicit and starts at epoch zero'
);
select is(
  (
    select claim_kind
    from public.campaign_workspace_claim_provenance
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from created_workspace
    )
  ),
  'new_workspace',
  'new workspace provenance is sanitized'
);

select is(
  public.create_campaign_workspace(
    '60000000-0000-4000-8000-000000000001',
    'Northwatch',
    'new_workspace',
    null
  ),
  (select result from created_workspace),
  'response-loss replay returns the original workspace receipt'
);
select throws_ok(
  $$select public.create_campaign_workspace(
    '60000000-0000-4000-8000-000000000001',
    'Changed replay',
    'new_workspace',
    null
  )$$,
  '22023',
  'mutation ID was already used with different input',
  'mutation replay with changed input is denied'
);
select throws_ok(
  $$select public.create_campaign_workspace(
    '60000000-0000-4000-8000-000000000002',
    'Bad fork',
    'import_fork',
    'not-a-sanitized-fingerprint'
  )$$,
  '22023',
  'a SHA-256 source fingerprint is required for import/fork',
  'raw campaign identity cannot be stored as claim provenance'
);

create temporary table forked_workspace as
select public.create_campaign_workspace(
  '60000000-0000-4000-8000-000000000003',
  'Northwatch fork',
  'import_fork',
  repeat('c', 64)
) as result;
select isnt(
  result ->> 'displayCode',
  'ABC123',
  'an import/fork receives a separate new display code'
)
from forked_workspace;
select is(
  (
    select claim_kind
    from public.campaign_workspace_claim_provenance
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from forked_workspace
    )
  ),
  'import_fork',
  'fork provenance does not claim the legacy campaign identity'
);
select is(
  (
    select source_fingerprint
    from public.campaign_workspace_claim_provenance
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from forked_workspace
    )
  ),
  repeat('c', 64),
  'fork provenance retains only the sanitized source fingerprint'
);

reset role;
insert into private.workspace_claim_authorizations (
  id,
  claimant_id,
  legacy_source_fingerprint,
  token_hash,
  expires_at
)
values (
  '61000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  repeat('d', 64),
  extensions.digest('manual-proof-token', 'sha256'),
  statement_timestamp() + interval '1 hour'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
select throws_ok(
  $$select public.claim_campaign_workspace(
    '62000000-0000-4000-8000-000000000001',
    'Stolen campaign',
    repeat('d', 64),
    'manual-proof-token'
  )$$,
  '42501',
  'workspace ownership proof was not accepted',
  'wrong account cannot consume a valid ownership proof'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$select public.claim_campaign_workspace(
    '62000000-0000-4000-8000-000000000002',
    'Claimed campaign',
    repeat('d', 64),
    'campaign-code-or-dmid'
  )$$,
  '42501',
  'workspace ownership proof was not accepted',
  'campaign code, dmId, recovery possession, and fabricated proof are denied'
);

create temporary table claimed_workspace as
select public.claim_campaign_workspace(
  '62000000-0000-4000-8000-000000000003',
  'Claimed campaign',
  repeat('d', 64),
  'manual-proof-token'
) as result;

select is(
  (
    select proof_method
    from public.campaign_workspace_claim_provenance
    where campaign_id = (
      select (result ->> 'campaignId')::uuid from claimed_workspace
    )
  ),
  'manual_verified',
  'accepted claims retain only sanitized proof provenance'
);
select is(
  public.claim_campaign_workspace(
    '62000000-0000-4000-8000-000000000003',
    'Claimed campaign',
    repeat('d', 64),
    'manual-proof-token'
  ),
  (select result from claimed_workspace),
  'claim response-loss replay returns the original receipt'
);
select throws_ok(
  $$select public.claim_campaign_workspace(
    '62000000-0000-4000-8000-000000000004',
    'Claim replay',
    repeat('d', 64),
    'manual-proof-token'
  )$$,
  '42501',
  'workspace ownership proof was not accepted',
  'consumed proof cannot claim a second workspace'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_workspace_claim_provenance'
      and column_name in (
        'dm_id',
        'campaign_code',
        'recovery_manifest',
        'authorization_token',
        'evidence'
      )
  ),
  0,
  'claim provenance has no raw authority evidence columns'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
select is(
  (
    select count(*)::integer
    from public.campaigns
    where id = (
      select (result ->> 'campaignId')::uuid from created_workspace
    )
  ),
  0,
  'another account cannot read the owner workspace'
);
select throws_ok(
  $$insert into public.campaigns (
    id,
    owner_id,
    display_code,
    name
  ) values (
    gen_random_uuid(),
    auth.uid(),
    'BAD0BAD0BAD0',
    'Direct insert'
  )$$,
  '42501',
  null,
  'authenticated clients cannot bypass the workspace RPC'
);

select * from finish();
rollback;
