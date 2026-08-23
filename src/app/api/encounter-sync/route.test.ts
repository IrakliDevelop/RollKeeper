import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createClient,
}));

import { POST } from './route';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://rollkeeper.test/api/encounter-sync', {
    method: 'POST',
    headers: {
      host: 'rollkeeper.test',
      origin: 'http://rollkeeper.test',
      'content-type': 'application/json',
      'x-rollkeeper-csrf': '1',
      ...headers,
    },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

describe('encounter API gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('is default-off before body, database, or cookie/session access', async () => {
    const response = await POST(request({ action: 'history' }));
    expect(response.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('enforces exact Origin and CSRF before database access', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const response = await POST(
      request({ action: 'history' }, { origin: 'http://attacker.test' })
    );
    expect(response.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('passes only the registered family to owner RPCs', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { versions: [] }, error: null });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({
        action: 'history',
        campaignId: 'campaign',
        legacyId: 'legacy',
        family: 'npc',
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(rpc).toHaveBeenCalledWith('list_encounter_document_versions', {
      p_campaign_id: 'campaign',
      p_legacy_id: 'legacy',
    });
  });

  it('rejects projection and drain actions without touching the database', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createClient.mockResolvedValue({ rpc });
    for (const action of [
      'projection-status',
      'projection-incidents',
      'replay-projection',
      'drain-projection',
    ]) {
      const response = await POST(request({ action, campaignId: 'campaign' }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'Unknown encounter action',
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires an action string', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi.fn();
    createClient.mockResolvedValue({ rpc });
    const response = await POST(request({ campaignId: 'campaign' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Encounter action is required',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps rollback to the family rollback RPC arguments', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { rolledBack: true }, error: null });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({
        action: 'rollback',
        mutationId: 'mutation',
        campaignId: 'campaign',
        expectedEpoch: 4,
        previewFingerprint: 'preview',
        currentGeneration: { encounter_definition: 2 },
      })
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('rollback_encounter_family', {
      p_mutation_id: 'mutation',
      p_campaign_id: 'campaign',
      p_expected_epoch: 4,
      p_preview_fingerprint: 'preview',
      p_current_generation: { encounter_definition: 2 },
    });
  });

  it('maps serialization failures to a reconcile conflict', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
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
      error: 'Encounters changed; refresh and reconcile.',
    });
  });

  it('denies other database errors', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    createClient.mockResolvedValue({ rpc });
    const response = await POST(
      request({ action: 'history', campaignId: 'campaign', legacyId: 'legacy' })
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Encounter request was denied.',
    });
  });

  it('maps every supported action to its registered RPC', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    createClient.mockResolvedValue({ rpc });
    const cases: Array<
      [Record<string, unknown>, string, Record<string, unknown>]
    > = [
      [
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
        'begin_encounter_staging',
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
        {
          action: 'stage-items',
          mutationId: 'mutation',
          runId: 'run',
          items: [{ legacyId: 'a' }],
        },
        'stage_encounter_items',
        {
          p_mutation_id: 'mutation',
          p_run_id: 'run',
          p_items: [{ legacyId: 'a' }],
        },
      ],
      [
        {
          action: 'confirm-cutover',
          mutationId: 'mutation',
          runId: 'run',
          manifestFingerprint: 'manifest',
          expectedEpoch: 2,
        },
        'confirm_encounter_cutover',
        {
          p_mutation_id: 'mutation',
          p_run_id: 'run',
          p_manifest_fingerprint: 'manifest',
          p_expected_epoch: 2,
        },
      ],
      [
        {
          action: 'put',
          mutationId: 'mutation',
          campaignId: 'campaign',
          expectedEpoch: 2,
          legacyId: 'legacy',
          operation: 'create',
          expectedServerVersion: 0,
          schemaVersion: 2,
          payload: { name: 'Goblin Ambush' },
          payloadFingerprint: 'fingerprint',
        },
        'put_encounter_document',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_expected_epoch: 2,
          p_legacy_id: 'legacy',
          p_operation: 'create',
          p_expected_server_version: 0,
          p_schema_version: 2,
          p_payload: { name: 'Goblin Ambush' },
          p_payload_fingerprint: 'fingerprint',
        },
      ],
      [
        {
          action: 'export-version',
          campaignId: 'campaign',
          legacyId: 'legacy',
          serverVersion: 5,
        },
        'export_encounter_document_version',
        {
          p_campaign_id: 'campaign',
          p_legacy_id: 'legacy',
          p_server_version: 5,
        },
      ],
      [
        {
          action: 'compare-versions',
          campaignId: 'campaign',
          legacyId: 'legacy',
          leftVersion: 1,
          rightVersion: 2,
        },
        'compare_encounter_document_versions',
        {
          p_campaign_id: 'campaign',
          p_legacy_id: 'legacy',
          p_left: 1,
          p_right: 2,
        },
      ],
      [
        {
          action: 'restore-version',
          mutationId: 'mutation',
          campaignId: 'campaign',
          expectedEpoch: 3,
          legacyId: 'legacy',
          sourceVersion: 1,
          expectedServerVersion: 4,
        },
        'restore_encounter_document_version',
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
        { action: 'preview-enrollment', campaignId: 'campaign' },
        'preview_encounter_device_enrollment',
        { p_campaign_id: 'campaign' },
      ],
      [
        {
          action: 'enroll-device',
          mutationId: 'mutation',
          campaignId: 'campaign',
          deviceId: 'device',
          expectedEpoch: 1,
          previewFingerprint: 'preview',
        },
        'enroll_encounter_device',
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
        {
          action: 'remove-device',
          mutationId: 'mutation',
          campaignId: 'campaign',
          deviceId: 'device',
          expectedEpoch: 1,
        },
        'remove_encounter_device',
        {
          p_mutation_id: 'mutation',
          p_campaign_id: 'campaign',
          p_device_id: 'device',
          p_expected_epoch: 1,
        },
      ],
    ];
    for (const [body, name, args] of cases) {
      rpc.mockClear();
      const response = await POST(request(body));
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith(name, args);
    }
  });

  it('rejects unknown actions', async () => {
    vi.stubEnv('SUPABASE_ENCOUNTER_SYNC_ENABLED', 'true');
    const rpc = vi.fn();
    createClient.mockResolvedValue({ rpc });
    const response = await POST(request({ action: 'delete-encounter' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown encounter action',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
