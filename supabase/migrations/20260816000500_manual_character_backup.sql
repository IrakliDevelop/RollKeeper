alter table public.mutation_receipts
drop constraint mutation_receipts_operation_check;

alter table public.mutation_receipts
add constraint mutation_receipts_operation_check
check (operation in ('put_character', 'soft_delete_character', 'restore_character'));

create or replace function public.guard_character_identity_and_tombstone()
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

  if old.deleted_at is not null
    and new.deleted_at is null
    and pg_catalog.current_setting(
      'rollkeeper.allow_character_restore',
      true
    ) is distinct from 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'ordinary writes cannot resurrect a character tombstone';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_character_identity_and_tombstone()
from public, anon, authenticated;

create or replace function public.put_character(
  p_mutation_id uuid,
  p_character_id uuid,
  p_legacy_client_id text,
  p_name text,
  p_payload jsonb,
  p_schema_version integer,
  p_client_revision bigint,
  p_expected_server_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_result jsonb;
  v_character_id uuid := p_character_id;
  v_server_version bigint;
  v_deleted_at timestamptz;
  v_name text;
  v_payload jsonb;
  v_schema_version integer;
  v_client_revision bigint;
begin
  if v_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  if p_mutation_id is null or p_character_id is null then
    raise exception using
      errcode = '22023',
      message = 'mutation ID and character ID are required';
  end if;

  v_request := jsonb_build_object(
    'characterId', p_character_id,
    'legacyClientId', p_legacy_client_id,
    'name', p_name,
    'payload', p_payload,
    'schemaVersion', p_schema_version,
    'clientRevision', p_client_revision,
    'expectedServerVersion', p_expected_server_version
  );
  v_request_hash := encode(
    extensions.digest(v_request::text, 'sha256'),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_mutation_id::text,
      0
    )
  );

  select request_hash, result
  into v_existing_hash, v_result
  from public.mutation_receipts
  where actor_id = v_actor_id
    and mutation_id = p_mutation_id;

  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using
        errcode = '22023',
        message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  update public.characters
  set
    legacy_client_id = p_legacy_client_id,
    name = p_name,
    payload = p_payload,
    schema_version = p_schema_version,
    client_revision = p_client_revision,
    server_version = server_version + 1,
    updated_at = statement_timestamp()
  where id = p_character_id
    and owner_id = v_actor_id
    and deleted_at is null
    and server_version = p_expected_server_version
  returning id, server_version
  into v_character_id, v_server_version;

  if found then
    v_result := jsonb_build_object(
      'status', 'success',
      'characterId', v_character_id,
      'serverVersion', v_server_version
    );
  else
    select
      id,
      server_version,
      deleted_at,
      name,
      payload,
      schema_version,
      client_revision
    into
      v_character_id,
      v_server_version,
      v_deleted_at,
      v_name,
      v_payload,
      v_schema_version,
      v_client_revision
    from public.characters
    where id = p_character_id
      and owner_id = v_actor_id;

    if found then
      v_result := jsonb_build_object(
        'status', case
          when v_deleted_at is null then 'conflict'
          else 'tombstoned'
        end,
        'characterId', v_character_id,
        'serverVersion', v_server_version
      );
    elsif p_expected_server_version = 0 then
      select
        id,
        server_version,
        deleted_at,
        name,
        payload,
        schema_version,
        client_revision
      into
        v_character_id,
        v_server_version,
        v_deleted_at,
        v_name,
        v_payload,
        v_schema_version,
        v_client_revision
      from public.characters
      where owner_id = v_actor_id
        and legacy_client_id = p_legacy_client_id;

      if not found then
        v_character_id := p_character_id;
        insert into public.characters (
          id,
          owner_id,
          legacy_client_id,
          name,
          payload,
          schema_version,
          client_revision,
          server_version
        )
        values (
          p_character_id,
          v_actor_id,
          p_legacy_client_id,
          p_name,
          p_payload,
          p_schema_version,
          p_client_revision,
          1
        )
        on conflict do nothing
        returning id, server_version
        into v_character_id, v_server_version;

        if found then
          v_deleted_at := null;
          v_name := p_name;
          v_payload := p_payload;
          v_schema_version := p_schema_version;
          v_client_revision := p_client_revision;
        else
          select
            id,
            server_version,
            deleted_at,
            name,
            payload,
            schema_version,
            client_revision
          into
            v_character_id,
            v_server_version,
            v_deleted_at,
            v_name,
            v_payload,
            v_schema_version,
            v_client_revision
          from public.characters
          where owner_id = v_actor_id
            and legacy_client_id = p_legacy_client_id;
        end if;
      end if;

      if v_character_id is null then
        v_character_id := p_character_id;
        v_result := jsonb_build_object(
          'status', 'conflict',
          'characterId', p_character_id,
          'serverVersion', null
        );
      elsif v_deleted_at is not null then
        v_result := jsonb_build_object(
          'status', 'tombstoned',
          'characterId', v_character_id,
          'serverVersion', v_server_version
        );
      elsif v_name = p_name
        and v_payload = p_payload
        and v_schema_version = p_schema_version
        and v_client_revision = p_client_revision
      then
        v_result := jsonb_build_object(
          'status', 'success',
          'characterId', v_character_id,
          'serverVersion', v_server_version
        );
      else
        v_result := jsonb_build_object(
          'status', 'conflict',
          'characterId', v_character_id,
          'serverVersion', v_server_version
        );
      end if;
    else
      v_character_id := p_character_id;
      v_result := jsonb_build_object(
        'status', 'conflict',
        'characterId', p_character_id,
        'serverVersion', null
      );
    end if;
  end if;

  insert into public.mutation_receipts (
    actor_id,
    mutation_id,
    operation,
    request_hash,
    character_id,
    result
  ) values (
    v_actor_id,
    p_mutation_id,
    'put_character',
    v_request_hash,
    v_character_id,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.put_character(
  uuid, uuid, text, text, jsonb, integer, bigint, bigint
) from public, anon;
grant execute on function public.put_character(
  uuid, uuid, text, text, jsonb, integer, bigint, bigint
) to authenticated;

create function public.soft_delete_character(
  p_mutation_id uuid,
  p_character_id uuid,
  p_expected_server_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_result jsonb;
  v_server_version bigint;
  v_deleted_at timestamptz;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  v_request := jsonb_build_object(
    'characterId', p_character_id,
    'expectedServerVersion', p_expected_server_version
  );
  v_request_hash := encode(extensions.digest(v_request::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from public.mutation_receipts
  where actor_id = v_actor_id and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023',
        message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  update public.characters
  set deleted_at = statement_timestamp(),
      server_version = server_version + 1,
      updated_at = statement_timestamp()
  where id = p_character_id
    and owner_id = v_actor_id
    and deleted_at is null
    and server_version = p_expected_server_version
  returning server_version, deleted_at into v_server_version, v_deleted_at;

  if found then
    v_result := jsonb_build_object(
      'status', 'success', 'characterId', p_character_id,
      'serverVersion', v_server_version
    );
  else
    select server_version, deleted_at into v_server_version, v_deleted_at
    from public.characters
    where id = p_character_id and owner_id = v_actor_id;
    v_result := jsonb_build_object(
      'status', case when found and v_deleted_at is not null
        then 'tombstoned' else 'conflict' end,
      'characterId', p_character_id,
      'serverVersion', v_server_version
    );
  end if;

  insert into public.mutation_receipts (
    actor_id, mutation_id, operation, request_hash, character_id, result
  ) values (
    v_actor_id, p_mutation_id, 'soft_delete_character', v_request_hash,
    p_character_id, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.soft_delete_character(uuid, uuid, bigint)
from public, anon;
grant execute on function public.soft_delete_character(uuid, uuid, bigint)
to authenticated;

create function public.restore_character(
  p_mutation_id uuid,
  p_character_id uuid,
  p_expected_server_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_result jsonb;
  v_server_version bigint;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  v_request := jsonb_build_object(
    'characterId', p_character_id,
    'expectedServerVersion', p_expected_server_version
  );
  v_request_hash := encode(extensions.digest(v_request::text, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text || ':' || p_mutation_id::text, 0)
  );
  select request_hash, result into v_existing_hash, v_result
  from public.mutation_receipts
  where actor_id = v_actor_id and mutation_id = p_mutation_id;
  if found then
    if v_existing_hash <> v_request_hash then
      raise exception using errcode = '22023',
        message = 'mutation ID was already used with different input';
    end if;
    return v_result;
  end if;

  perform pg_catalog.set_config('rollkeeper.allow_character_restore', 'on', true);
  update public.characters
  set deleted_at = null,
      server_version = server_version + 1,
      updated_at = statement_timestamp()
  where id = p_character_id
    and owner_id = v_actor_id
    and deleted_at is not null
    and server_version = p_expected_server_version
  returning server_version into v_server_version;
  perform pg_catalog.set_config('rollkeeper.allow_character_restore', 'off', true);

  if found then
    v_result := jsonb_build_object(
      'status', 'success', 'characterId', p_character_id,
      'serverVersion', v_server_version
    );
  else
    select server_version into v_server_version
    from public.characters
    where id = p_character_id and owner_id = v_actor_id;
    v_result := jsonb_build_object(
      'status', 'conflict',
      'characterId', p_character_id,
      'serverVersion', v_server_version
    );
  end if;

  insert into public.mutation_receipts (
    actor_id, mutation_id, operation, request_hash, character_id, result
  ) values (
    v_actor_id, p_mutation_id, 'restore_character', v_request_hash,
    p_character_id, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.restore_character(uuid, uuid, bigint)
from public, anon;
grant execute on function public.restore_character(uuid, uuid, bigint)
to authenticated;
