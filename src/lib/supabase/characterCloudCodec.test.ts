import { describe, expect, it } from 'vitest';

import {
  MAX_CHARACTER_CLOUD_PAYLOAD_BYTES,
  decodeCharacterCloudRow,
  encodeCharacterCloudPayload,
  fingerprintCharacterPayload,
  planCharacterRestore,
} from './characterCloudCodec';

const cloudRow = (payload: unknown, schemaVersion = 1) => ({
  id: 'a0000000-0000-4000-8000-000000000001',
  legacy_client_id: 'legacy-a',
  name: 'Aria',
  payload,
  schema_version: schemaVersion,
  client_revision: 7,
  server_version: 3,
  deleted_at: null,
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
});

describe('character cloud passthrough codec', () => {
  it('preserves unknown fields and explicit null values byte-for-value semantically', async () => {
    const historical = {
      id: 'legacy-a',
      name: 'Aria',
      race: 'Elf',
      class: 'Wizard',
      level: 4,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      lastPlayed: '2024-01-03T00:00:00.000Z',
      characterData: {
        id: 'legacy-a',
        name: 'Aria',
        avatar: null,
        futureNestedField: { explicitNull: null, value: 12 },
      },
      tags: [],
      isArchived: false,
      unknownTopLevel: null,
    };

    const encoded = encodeCharacterCloudPayload(historical);
    const decoded = await decodeCharacterCloudRow(cloudRow(encoded));

    expect(decoded.rawPayload).toEqual(historical);
    expect(decoded.localCharacter).toEqual(historical);
    expect(decoded.rawPayload).toHaveProperty('unknownTopLevel', null);
    expect(decoded.rawPayload).toHaveProperty(
      'characterData.futureNestedField.explicitNull',
      null
    );
  });

  it.each([
    { state: { id: 'legacy-a', name: 'Zustand Hero', unknown: null } },
    { character: { id: 'legacy-a', name: 'Export Hero', unknown: null } },
    { id: 'legacy-a', name: 'Raw Hero', unknown: null },
  ])('decodes a supported historical character shape', async payload => {
    const decoded = await decodeCharacterCloudRow(cloudRow(payload));

    expect(decoded.localCharacter).not.toBeNull();
    expect(decoded.localCharacter!.id).toBe('legacy-a');
    expect(decoded.localCharacter!.characterData).toHaveProperty(
      'unknown',
      null
    );
    expect(decoded.rawPayload).toEqual(payload);
  });

  it('uses a canonical fingerprint independent of object key order', async () => {
    await expect(
      fingerprintCharacterPayload({ b: 2, a: { d: null, c: 1 } })
    ).resolves.toBe(
      await fingerprintCharacterPayload({ a: { c: 1, d: null }, b: 2 })
    );
  });

  it('rejects malformed, oversized, and embedded base64 media payloads', () => {
    expect(() => encodeCharacterCloudPayload(null)).toThrow(
      'Character payload must be an object'
    );
    expect(() =>
      encodeCharacterCloudPayload({
        id: 'legacy-a',
        name: 'Aria',
        portrait: 'data:image/png;base64,AAAA',
      })
    ).toThrow('Base64 media is not allowed in cloud character payloads');
    expect(() =>
      encodeCharacterCloudPayload({
        id: 'legacy-a',
        name: 'Aria',
        notes: 'x'.repeat(MAX_CHARACTER_CLOUD_PAYLOAD_BYTES + 1),
      })
    ).toThrow('Character payload is too large for cloud backup');
  });

  it('quarantines future cloud schemas without creating an active character', async () => {
    const decoded = await decodeCharacterCloudRow(
      cloudRow({ id: 'legacy-a', name: 'Future' }, 99)
    );

    expect(decoded.status).toBe('quarantined');
    expect(decoded.localCharacter).toBeNull();
    expect(decoded.quarantineReason).toMatch(/future schema/i);
  });

  it.each([
    ['not-an-object', /object/i],
    [{ id: 'legacy-a', portrait: 'data:image/png;base64,AAAA' }, /base64/i],
  ])(
    'quarantines invalid cloud payloads while retaining raw recovery data',
    async (payload, reason) => {
      const decoded = await decodeCharacterCloudRow(cloudRow(payload));

      expect(decoded.status).toBe('quarantined');
      expect(decoded.localCharacter).toBeNull();
      expect(decoded.rawPayload).toEqual(payload);
      expect(decoded.quarantineReason).toMatch(reason);
    }
  );
});

describe('character cloud restore arbitration', () => {
  it('restores an absent ID with its original ID and cloud link', async () => {
    const decoded = await decodeCharacterCloudRow(
      cloudRow({ id: 'legacy-a', name: 'Aria' })
    );

    const plan = await planCharacterRestore(
      decoded,
      [],
      'original',
      () => 'copy-id'
    );

    expect(plan.kind).toBe('restore-original');
    expect(plan.character?.id).toBe('legacy-a');
    expect(plan.attachCloudLink).toBe(true);
  });

  it('attaches a link without a duplicate when the local record is identical', async () => {
    const local = encodeCharacterCloudPayload({ id: 'legacy-a', name: 'Aria' });
    const decoded = await decodeCharacterCloudRow(cloudRow(local));

    const plan = await planCharacterRestore(
      decoded,
      [{ id: 'legacy-a', name: 'Aria' }],
      'original',
      () => 'copy-id'
    );

    expect(plan.kind).toBe('attach-link');
    expect(plan.character).toBeNull();
    expect(plan.attachCloudLink).toBe(true);
  });

  it('keeps a colliding local record and restores cloud data as an unsynced copy', async () => {
    const decoded = await decodeCharacterCloudRow(
      cloudRow({ id: 'legacy-a', name: 'Cloud Aria', unknown: null })
    );
    const local = { id: 'legacy-a', name: 'Local Aria', localOnly: true };

    const plan = await planCharacterRestore(
      decoded,
      [local],
      'original',
      () => 'copy-id'
    );

    expect(plan.kind).toBe('restore-copy');
    expect(plan.character?.id).toBe('copy-id');
    expect(plan.character?.characterData.id).toBe('copy-id');
    expect(plan.attachCloudLink).toBe(false);
    expect(local).toEqual({
      id: 'legacy-a',
      name: 'Local Aria',
      localOnly: true,
    });
  });
});
