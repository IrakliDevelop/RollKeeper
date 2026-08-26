import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createClient,
}));

import { POST } from './route';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://rollkeeper.test/api/campaign-settings', {
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

describe('campaign settings API gate', () => {
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
    vi.stubEnv('SUPABASE_CAMPAIGN_SETTINGS_SYNC_ENABLED', 'true');
    const response = await POST(
      request({ action: 'history' }, { origin: 'http://attacker.test' })
    );
    expect(response.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('passes only the registered family to owner RPCs', async () => {
    vi.stubEnv('SUPABASE_CAMPAIGN_SETTINGS_SYNC_ENABLED', 'true');
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
    expect(rpc).toHaveBeenCalledWith('list_campaign_document_versions', {
      p_campaign_id: 'campaign',
      p_family: 'campaign_settings',
      p_legacy_id: 'legacy',
    });
  });
});
