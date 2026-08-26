-- Fix the shared document canonicalizer's object-key ordering.
--
-- private.canonical_campaign_document_json sorted object keys with `order by
-- e.key`, i.e. under the database's default collation (en_US.UTF-8 on the local
-- and hosted stacks). That was wrong in two independent ways:
--
--   1. It diverged from the TypeScript canonicalizer, which sorts with
--      Object.keys().sort() -- UTF-16 code-unit order. The two orders disagree
--      whenever two sibling keys differ only by letter case at the deciding
--      position. The concrete case is `{requestId, requestedAt}`: byte order
--      puts requestId first ('I' = 0x49 < 'e' = 0x65) while en_US.UTF-8 folds
--      case at the primary level and puts requestedAt first ('e' < 'i'). The
--      canonical JSON therefore differed, the SHA-256 digests differed, and a
--      browser-computed payloadFingerprint could never match
--      private.campaign_document_hash for such a payload.
--   2. It was locale-dependent: the same payload could hash differently on two
--      PostgreSQL instances whose datcollate differs, which breaks the
--      fingerprint contract independently of any client.
--
-- Sorting with the C collation restores byte order, which equals JavaScript's
-- code-unit order for every key the durable-DM families use. Only key order
-- changes: canonical byte counts, the array branch, and the scalar branch are
-- untouched, and no family payload registered before this migration contains a
-- sibling key pair whose order this changes.
--
-- The function keeps its original posture exactly: plpgsql, stable, strict,
-- `set search_path = ''`, not security definer, and revoked from public, anon
-- and authenticated (create or replace preserves ACLs; the revoke is restated
-- so this migration is self-contained).

create or replace function private.canonical_campaign_document_json(p_value jsonb) returns text
language plpgsql stable strict set search_path = '' as $$
declare v_result text;
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'object' then
      select '{'||coalesce(string_agg(pg_catalog.to_jsonb(e.key)::text||':'||private.canonical_campaign_document_json(e.value),',' order by e.key collate "C"),'')||'}'
      into v_result from pg_catalog.jsonb_each(p_value) e;
    when 'array' then
      select '['||coalesce(string_agg(private.canonical_campaign_document_json(e.value),',' order by e.ordinality),'')||']'
      into v_result from pg_catalog.jsonb_array_elements(p_value) with ordinality e(value,ordinality);
    else v_result:=p_value::text;
  end case;
  return v_result;
end; $$;

revoke all on function private.canonical_campaign_document_json(jsonb) from public,anon,authenticated;
