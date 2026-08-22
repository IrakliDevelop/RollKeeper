import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeCampaignSettingsProjectionAuthority } from './campaignSettingsLegacyProjection';
import { createCampaignSettingsAwareDmStorage } from './campaignSettingsAwareStorage';

describe('campaign settings field-level persistence routing', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('delegates byte-for-byte when Slice 11A is disabled or unselected', () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      get length() {
        return backing.size;
      },
    } satisfies Storage;
    const value =
      '{"state":{"campaigns":[{"code":"ABC","stackableInspiration":true}]},"version":1}';
    createCampaignSettingsAwareDmStorage(storage).setItem(
      'rollkeeper-dm-data',
      value
    );
    expect(storage.getItem('rollkeeper-dm-data')).toBe(value);
  });

  it('keeps migrated fields frozen while unrelated legacy fields continue persisting', () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
      key: () => null,
      get length() {
        return backing.size;
      },
    } satisfies Storage;
    const before = JSON.stringify({
      state: {
        campaigns: [{ code: 'ABC', stackableInspiration: false, unrelated: 1 }],
      },
      version: 1,
    });
    storage.setItem('rollkeeper-dm-data', before);
    writeCampaignSettingsProjectionAuthority(storage, 'ABC', {
      version: 1,
      authority: 'indexedDB',
      epoch: 1,
      campaignId: 'cloud-a',
    });
    createCampaignSettingsAwareDmStorage(storage).setItem(
      'rollkeeper-dm-data',
      JSON.stringify({
        state: {
          campaigns: [
            { code: 'ABC', stackableInspiration: true, unrelated: 2 },
          ],
        },
        version: 1,
      })
    );
    expect(JSON.parse(storage.getItem('rollkeeper-dm-data')!)).toMatchObject({
      state: { campaigns: [{ stackableInspiration: false, unrelated: 2 }] },
    });
  });
});
