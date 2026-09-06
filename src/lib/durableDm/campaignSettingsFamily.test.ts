import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_SETTINGS_FAMILY_INVENTORY,
  buildCampaignSettingsManifest,
  buildCampaignSettingsWorkingCopyManifest,
  campaignSettingsPayloadFromCampaign,
  fingerprintCampaignSettingsPayload,
  fingerprintCampaignSettingsTombstone,
  projectCampaignSettingsForLegacyPlayers,
  registeredDurableDmFamilies,
} from './campaignSettingsFamily';

const envelope = (campaigns: unknown[]) =>
  JSON.stringify({
    state: { dmId: 'legacy-dm', campaigns },
    version: 1,
  });

describe('campaign_settings family boundary', () => {
  it('registers only the Slice 11A canary family', () => {
    expect(registeredDurableDmFamilies).toEqual(['campaign_settings']);
  });

  it('enumerates the exact local and Redis compatibility surface', () => {
    expect(CAMPAIGN_SETTINGS_FAMILY_INVENTORY).toEqual({
      family: 'campaign_settings',
      localStorageKeys: ['rollkeeper-dm-data'],
      persistenceVersions: { 'rollkeeper-dm-data': 1 },
      stableIdentity: 'campaign.code',
      excludedIdentityFields: ['code', 'name', 'createdAt'],
      excludedEnvelopeFields: ['dmId'],
      privateFields: [
        'bannerUrl',
        'playerColors',
        'dmDashboardUi',
        'fogPresets',
      ],
      playerVisibleFields: [
        'stackableInspiration',
        'customCounterLabel',
        'playerCounters',
      ],
      redisProjectionKinds: ['settings', 'counters'],
      crossFamilyReferences: ['dmDashboardUi.npcCollapsedGroupNames'],
    });
  });

  it('builds a deterministic count/ID/size/hash/version/reference manifest', async () => {
    const raw = envelope([
      {
        code: 'BBB222',
        name: 'Other',
        createdAt: '2026-01-02T00:00:00.000Z',
        stackableInspiration: false,
      },
      {
        code: 'AAA111',
        name: 'Canary',
        createdAt: '2026-01-01T00:00:00.000Z',
        stackableInspiration: true,
        customCounterLabel: null,
        playerCounters: { p2: 0, p1: 3 },
        bannerUrl: null,
        dmDashboardUi: {
          npcCollapsedGroupNames: ['Guards'],
          playersSectionOpen: false,
        },
      },
    ]);

    const first = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: raw,
    });
    const second = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: raw,
    });

    expect(first).toEqual(second);
    expect(first.recordCount).toBe(1);
    expect(first.records[0]).toMatchObject({
      legacyId: 'AAA111',
      schemaVersion: 1,
      references: [
        {
          family: 'npc',
          legacyId: 'Guards',
          path: 'dmDashboardUi.npcCollapsedGroupNames[0]',
        },
      ],
    });
    expect(first.records[0].payload).not.toHaveProperty('code');
    expect(first.records[0].payload).not.toHaveProperty('name');
    expect(first.records[0].payload).toHaveProperty('customCounterLabel', null);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rebuilds the exact cloud manifest from the IndexedDB working copy while preserving raw source evidence', async () => {
    const source = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: envelope([
        {
          code: 'AAA111',
          name: 'Canary',
          createdAt: 'now',
          stackableInspiration: true,
        },
      ]),
    });
    const working = await buildCampaignSettingsWorkingCopyManifest({
      source,
      payload: { stackableInspiration: false },
      schemaVersion: 1,
    });

    expect(working.rawCandidates).toEqual(source.rawCandidates);
    expect(working.records[0]).toMatchObject({
      legacyId: 'AAA111',
      payload: { stackableInspiration: false },
    });
    expect(working.records[0].payloadFingerprint).not.toBe(
      source.records[0].payloadFingerprint
    );
    expect(working.fingerprint).not.toBe(source.fingerprint);
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'future envelope',
      JSON.stringify({ state: { campaigns: [] }, version: 2 }),
    ],
    ['incomplete envelope', JSON.stringify({ state: {}, version: 1 })],
    [
      'duplicate campaign ID',
      envelope([
        { code: 'AAA111', name: 'One', createdAt: 'x' },
        { code: 'AAA111', name: 'Two', createdAt: 'y' },
      ]),
    ],
    [
      'unclassified field',
      envelope([
        { code: 'AAA111', name: 'One', createdAt: 'x', calendar: { day: 1 } },
      ]),
    ],
  ])('preserves and blocks %s candidates', async (_label, rawEnvelope) => {
    const manifest = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope,
    });
    expect(manifest.blockers.length).toBeGreaterThan(0);
    expect(manifest.rawCandidates.length).toBeGreaterThan(0);
  });

  it('uses an allowlist projection and omits every private field', () => {
    const projection = projectCampaignSettingsForLegacyPlayers({
      stackableInspiration: true,
      customCounterLabel: 'Momentum',
      playerCounters: { p1: 2 },
      bannerUrl: 'private-ref',
      playerColors: { p1: '#fff' },
      dmDashboardUi: { playersSectionOpen: false },
      fogPresets: [{ v: 1, id: 'fp_1', name: 'Secret Mist' }],
    });

    expect(projection).toEqual({
      codecVersion: 1,
      settings: { stackableInspiration: true },
      counters: { label: 'Momentum', counters: { p1: 2 } },
    });
    expect(JSON.stringify(projection)).not.toContain('private-ref');
    expect(JSON.stringify(projection)).not.toContain('dmDashboardUi');
    expect(JSON.stringify(projection)).not.toContain('fogPresets');
    expect(JSON.stringify(projection)).not.toContain('Secret Mist');
  });

  it('classifies fogPresets so a campaign with presets has no manifest blocker', async () => {
    const manifest = await buildCampaignSettingsManifest({
      campaignCode: 'PRESETS',
      rawEnvelope: envelope([
        {
          code: 'PRESETS',
          name: 'Preset campaign',
          createdAt: '2026-09-05T00:00:00.000Z',
          fogPresets: [
            {
              v: 1,
              id: 'fp_1',
              name: 'Mist',
              material: { v: 1, kind: 'solid', color: '#102030' },
              createdAt: '2026-09-05T00:00:00.000Z',
              updatedAt: '2026-09-05T00:00:00.000Z',
            },
          ],
        },
      ]),
    });
    expect(manifest.blockers).toEqual([]);
    expect(manifest.records[0].payload.fogPresets).toHaveLength(1);
  });

  it('extracts and fingerprints only canary fields, preserving explicit nulls', async () => {
    const payload = campaignSettingsPayloadFromCampaign({
      code: 'AAA111',
      name: 'Canary',
      createdAt: 'now',
      bannerUrl: undefined,
      customCounterLabel: 'Momentum',
      stackableInspiration: true,
    });
    expect(payload).toEqual({
      bannerUrl: undefined,
      customCounterLabel: 'Momentum',
      stackableInspiration: true,
    });
    expect(
      campaignSettingsPayloadFromCampaign(
        {
          code: 'AAA111',
          name: 'Canary',
          createdAt: 'now',
          bannerUrl: undefined,
          stackableInspiration: false,
        },
        { bannerUrl: null, playerColors: null }
      )
    ).toEqual({
      bannerUrl: null,
      playerColors: null,
      stackableInspiration: false,
    });
    await expect(
      fingerprintCampaignSettingsPayload({ playerCounters: { b: 2, a: 1 } })
    ).resolves.toBe(
      await fingerprintCampaignSettingsPayload({
        playerCounters: { a: 1, b: 2 },
      })
    );
    await expect(
      fingerprintCampaignSettingsTombstone('AAA111')
    ).resolves.toMatch(/^[a-f0-9]{64}$/u);
  });

  it('blocks missing campaigns and malformed envelopes while tolerating invalid reference members', async () => {
    const missing = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: envelope([
        { code: 'OTHER', name: 'Other', createdAt: 'now' },
      ]),
    });
    expect(missing.blockers).toEqual([
      expect.objectContaining({ kind: 'id-mismatch' }),
    ]);
    const primitive = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: 'null',
    });
    expect(primitive.blockers[0].kind).toBe('incomplete-envelope');
    const references = await buildCampaignSettingsManifest({
      campaignCode: 'AAA111',
      rawEnvelope: envelope([
        {
          code: 'AAA111',
          name: 'Canary',
          createdAt: 'now',
          dmDashboardUi: { npcCollapsedGroupNames: ['valid', 3] },
        },
      ]),
    });
    expect(references.records[0].references).toHaveLength(1);
    expect(
      projectCampaignSettingsForLegacyPlayers({
        playerCounters: { valid: 2, invalid: 'no' },
        customCounterLabel: null,
      })
    ).toEqual({
      codecVersion: 1,
      settings: { stackableInspiration: false },
      counters: { counters: { valid: 2 } },
    });
  });
});
