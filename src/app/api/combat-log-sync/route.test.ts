/**
 * Route tests for `POST /api/combat-log-sync` — the `combat_log_archive`
 * durable DM cloud-sync family.
 *
 * WARNING TO THE NEXT READER — DO NOT REPEAT THIS MISTAKE.
 *
 * A **403** from this route on an unauthenticated (or cross-origin, or
 * CSRF-less) request does **NOT** prove that `SUPABASE_COMBAT_LOG_SYNC_ENABLED`
 * is on, and it does not prove the flag reached the server at all.
 * `validateCampaignMembershipMutation(request)` runs *before*
 * `createCombatLogArchiveUserClient()`, so a bare `curl` — flag on or flag off —
 * is answered 403 by the origin/CSRF guard and never reaches the flag check.
 * The flag's own answer is **404 `{ error: 'Not found' }`**, deliberately
 * masquerading as not-found.
 *
 * This exact inference was made wrongly once already on this repository and a
 * prior session drew a false conclusion from it; see
 * `BACKPORT_EVIDENCE.md:163-169` ("Correction to an earlier inference in this
 * run"). If you want evidence about flag state, use a request that *passes*
 * origin + CSRF + `content-type: application/json` and read 404 vs 200/409/403
 * from there — or read client-side signals (card presence, IndexedDB markers)
 * instead. Never read flag state off a 403.
 *
 * Note on the project's `waitFor` rule: it governs React/DOM assertions. Every
 * assertion here awaits the `POST` promise directly, so each observation is
 * already settled and deterministic — there is nothing to poll for and no
 * unbounded wait anywhere in this file.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createClient,
}));

import { POST } from './route';

type NextRequestLike = import('next/server').NextRequest;

function rawRequest(
  body: string,
  headers: Record<string, string> = {},
  omit: string[] = []
) {
  const merged: Record<string, string> = {
    host: 'rollkeeper.test',
    origin: 'http://rollkeeper.test',
    'content-type': 'application/json',
    'x-rollkeeper-csrf': '1',
    ...headers,
  };
  for (const key of omit) delete merged[key];
  return new Request('http://rollkeeper.test/api/combat-log-sync', {
    method: 'POST',
    headers: merged,
    body,
  }) as unknown as NextRequestLike;
}

function request(
  body: unknown,
  headers: Record<string, string> = {},
  omit: string[] = []
) {
  return rawRequest(JSON.stringify(body), headers, omit);
}

function enableFlag() {
  vi.stubEnv('SUPABASE_COMBAT_LOG_SYNC_ENABLED', 'true');
}

function mockRpc(result: unknown = { ok: true }) {
  const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
  createClient.mockResolvedValue({ rpc });
  return rpc;
}

describe('combat log archive API gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('answers 404 Not found when the server flag is off, even for a request that clears origin and CSRF', async () => {
    // An authenticated owner's client is available; only the flag is off.
    const rpc = mockRpc();
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('answers 404 Not found when the flag is on but no Supabase server client can be built', async () => {
    enableFlag();
    createClient.mockResolvedValue(null);
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('rejects a request missing the x-rollkeeper-csrf header with 403 before the flag check', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(
      request(
        { action: 'history', campaignId: 'campaign', legacyId: 'legacy' },
        {},
        ['x-rollkeeper-csrf']
      )
    );
    expect(
      request({ action: 'history' }, {}, ['x-rollkeeper-csrf']).headers.get(
        'x-rollkeeper-csrf'
      )
    ).toBeNull();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Request origin or CSRF validation failed',
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin request with 403 without touching the database', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(
      request(
        { action: 'history', campaignId: 'campaign', legacyId: 'legacy' },
        { origin: 'http://attacker.test' }
      )
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Request origin or CSRF validation failed',
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires an action string', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(request({ campaignId: 'campaign' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive action is required',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a non-string action', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(request({ action: 7 }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive action is required',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an unparseable body', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(rawRequest('{ not json'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive action is required',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an unknown action with 400 without touching the database', async () => {
    enableFlag();
    const rpc = mockRpc();
    const response = await POST(request({ action: 'delete-combat-log' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown combat log archive action',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects projection and drain actions — this family is DM-private', async () => {
    enableFlag();
    const rpc = mockRpc();
    for (const action of [
      'projection-status',
      'projection-incidents',
      'replay-projection',
      'drain-projection',
    ]) {
      const response = await POST(request({ action, campaignId: 'campaign' }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Unknown combat log archive action',
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns the RPC payload with no-store and no-referrer headers', async () => {
    enableFlag();
    mockRpc({ versions: [{ serverVersion: 1 }] });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    await expect(response.json()).resolves.toEqual({
      versions: [{ serverVersion: 1 }],
    });
  });

  it('ignores a caller-supplied family and passes only the registered combat_log_archive RPCs', async () => {
    enableFlag();
    const rpc = mockRpc({ versions: [] });
    const response = await POST(
      request({
        action: 'history',
        campaignId: 'campaign',
        legacyId: 'legacy',
        family: 'npc',
      })
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'list_combat_log_archive_document_versions',
      {
        p_campaign_id: 'campaign',
        p_legacy_id: 'legacy',
      }
    );
  });

  describe('action → RPC dispatch', () => {
    const cases: Array<
      [string, Record<string, unknown>, string, Record<string, unknown>]
    > = [
      [
        'begin-staging',
        {
          action: 'begin-staging',
          mutationId: 'mutation',
          campaignId: 'campaign',
          deviceId: 'device',
          expectedEpoch: 1,
          manifestFingerprint: 'manifest',
          recoveryManifestHash: 'recovery-manifest',
          recoveryReceiptHash: 'recovery-receipt',
          recordCount: 3,
          totalBytes: 1024,
        },
        'begin_combat_log_archive_staging',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_device_id: 'device',
          p_expected_epoch: 1,
          p_manifest_fingerprint: 'manifest',
          p_recovery_manifest_hash: 'recovery-manifest',
          p_recovery_receipt_hash: 'recovery-receipt',
          p_record_count: 3,
          p_total_bytes: 1024,
        },
      ],
      [
        'stage-items',
        {
          action: 'stage-items',
          mutationId: 'mutation',
          runId: 'run',
          items: [{ legacyId: 'a' }],
        },
        'stage_combat_log_archive_items',
        {
          p_mutation_id: 'mutation',
          p_run_id: 'run',
          p_items: [{ legacyId: 'a' }],
        },
      ],
      [
        'confirm-cutover',
        {
          action: 'confirm-cutover',
          mutationId: 'mutation',
          runId: 'run',
          manifestFingerprint: 'manifest',
          expectedEpoch: 2,
        },
        'confirm_combat_log_archive_cutover',
        {
          p_mutation_id: 'mutation',
          p_run_id: 'run',
          p_manifest_fingerprint: 'manifest',
          p_expected_epoch: 2,
        },
      ],
      [
        'put',
        {
          action: 'put',
          mutationId: 'mutation',
          campaignId: 'campaign',
          expectedEpoch: 2,
          legacyId: 'legacy',
          operation: 'create',
          expectedServerVersion: 0,
          schemaVersion: 2,
          payload: { legacyId: 'legacy', kind: 'damage' },
          payloadFingerprint: 'fingerprint',
        },
        'put_combat_log_archive_document',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_expected_epoch: 2,
          p_legacy_id: 'legacy',
          p_operation: 'create',
          p_expected_server_version: 0,
          p_schema_version: 2,
          p_payload: { legacyId: 'legacy', kind: 'damage' },
          p_payload_fingerprint: 'fingerprint',
        },
      ],
      [
        'history',
        { action: 'history', campaignId: 'campaign', legacyId: 'legacy' },
        'list_combat_log_archive_document_versions',
        { p_campaign_id: 'campaign', p_legacy_id: 'legacy' },
      ],
      [
        'export-version',
        {
          action: 'export-version',
          campaignId: 'campaign',
          legacyId: 'legacy',
          serverVersion: 5,
        },
        'export_combat_log_archive_document_version',
        {
          p_campaign_id: 'campaign',
          p_legacy_id: 'legacy',
          p_server_version: 5,
        },
      ],
      [
        'compare-versions',
        {
          action: 'compare-versions',
          campaignId: 'campaign',
          legacyId: 'legacy',
          leftVersion: 1,
          rightVersion: 2,
        },
        'compare_combat_log_archive_document_versions',
        {
          p_campaign_id: 'campaign',
          p_legacy_id: 'legacy',
          p_left: 1,
          p_right: 2,
        },
      ],
      [
        'restore-version',
        {
          action: 'restore-version',
          mutationId: 'mutation',
          campaignId: 'campaign',
          expectedEpoch: 3,
          legacyId: 'legacy',
          sourceVersion: 1,
          expectedServerVersion: 4,
        },
        'restore_combat_log_archive_document_version',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_expected_epoch: 3,
          p_legacy_id: 'legacy',
          p_source_version: 1,
          p_expected_server_version: 4,
        },
      ],
      [
        'preview-enrollment',
        { action: 'preview-enrollment', campaignId: 'campaign' },
        'preview_combat_log_archive_device_enrollment',
        { p_campaign_id: 'campaign' },
      ],
      [
        'enroll-device',
        {
          action: 'enroll-device',
          mutationId: 'mutation',
          campaignId: 'campaign',
          deviceId: 'device',
          expectedEpoch: 1,
          previewFingerprint: 'preview',
        },
        'enroll_combat_log_archive_device',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_device_id: 'device',
          p_expected_epoch: 1,
          p_preview_fingerprint: 'preview',
          p_legacy_candidate_fingerprint: null,
        },
      ],
      [
        'remove-device',
        {
          action: 'remove-device',
          mutationId: 'mutation',
          campaignId: 'campaign',
          deviceId: 'device',
          expectedEpoch: 1,
        },
        'remove_combat_log_archive_device',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_device_id: 'device',
          p_expected_epoch: 1,
        },
      ],
      [
        'rollback',
        {
          action: 'rollback',
          mutationId: 'mutation',
          campaignId: 'campaign',
          expectedEpoch: 4,
          previewFingerprint: 'preview',
          currentGeneration: { combat_log_archive: 2 },
        },
        'rollback_combat_log_archive_family',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_expected_epoch: 4,
          p_preview_fingerprint: 'preview',
          p_current_generation: { combat_log_archive: 2 },
        },
      ],
    ];

    it('covers all twelve registered actions', () => {
      expect(cases).toHaveLength(12);
      expect(new Set(cases.map(([action]) => action)).size).toBe(12);
      expect(new Set(cases.map(([, , name]) => name)).size).toBe(12);
    });

    it.each(cases)(
      'forwards %s to its registered RPC with the exact p_* argument names',
      async (_action, body, name, args) => {
        enableFlag();
        const rpc = mockRpc({ ok: true });
        const response = await POST(request(body));
        expect(response.status).toBe(200);
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith(name, args);
        expect(Object.keys(rpc.mock.calls[0][1])).toEqual(Object.keys(args));
      }
    );
  });

  it('forwards an explicit legacy candidate fingerprint on enroll-device', async () => {
    enableFlag();
    const rpc = mockRpc({ enrolled: true });
    const response = await POST(
      request({
        action: 'enroll-device',
        mutationId: 'mutation',
        campaignId: 'campaign',
        deviceId: 'device',
        expectedEpoch: 1,
        previewFingerprint: 'preview',
        legacyCandidateFingerprint: 'legacy-candidate',
      })
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('enroll_combat_log_archive_device', {
      p_mutation_id: 'mutation',
      p_campaign_id: 'campaign',
      p_device_id: 'device',
      p_expected_epoch: 1,
      p_preview_fingerprint: 'preview',
      p_legacy_candidate_fingerprint: 'legacy-candidate',
    });
  });

  it('maps a 40001 serialization failure to a 409 reconcile conflict', async () => {
    enableFlag();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'could not serialize access' },
    });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archives changed; refresh and reconcile.',
    });
  });

  it('denies any other database error with 403', async () => {
    enableFlag();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive request was denied.',
    });
  });

  it('denies a database error that carries no pg code with 403', async () => {
    enableFlag();
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'network down' } });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive request was denied.',
    });
  });

  it('denies a non-Error rejection from the client with 403', async () => {
    enableFlag();
    const rpc = vi.fn().mockRejectedValue({ code: '40001' });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Combat log archive request was denied.',
    });
  });

  it('never leaks the raw database message to the caller', async () => {
    enableFlag();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for table private.x',
      },
    });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    const text = await response.text();
    expect(text).not.toContain('private.x');
    expect(text).toContain('Combat log archive request was denied.');
  });
});
