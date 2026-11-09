import { describe, expect, it, vi } from 'vitest';

import { resolveVerifiedLocation } from './resourceKind';

const CODE = 'A1B2C3';
const ID = 'location-a';
const DETAIL_KEY = `campaign:${CODE}:location:${ID}`;
const REGISTRY_KEY = 'registry';
const MiB = 1024 * 1024;

const location = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Location A',
  mapImageUrl: 'https://example.test/map.png',
  updatedAt: '2026-10-03T00:00:00.000Z',
  ...overrides,
});

const registry = (overrides: Record<string, unknown> = {}) => ({
  v: 1,
  sceneId: 'scene-a',
  workspaceInstanceId: 'workspace-a',
  sourceMapId: 'map-a',
  contentRevision: 1,
  safeLabel: 'Scene A',
  registeredAt: 1,
  registryRevision: 1,
  deleted: false,
  roomId: '123e4567-e89b-42d3-a456-426614174000',
  ...overrides,
});

function clients(input: {
  detail?: unknown;
  list?: unknown;
  entries?: Record<string, unknown> | null;
}) {
  const get = vi.fn(async (key: string) =>
    key === DETAIL_KEY ? (input.detail ?? null) : (input.list ?? null)
  );
  const hgetall = vi.fn(async () => input.entries ?? null);
  return { get, hgetall };
}

async function resolve(input: {
  detail?: unknown;
  list?: unknown;
  entries?: Record<string, unknown> | null;
}) {
  const fake = clients(input);
  return {
    result: await resolveVerifiedLocation({
      redis: { get: fake.get },
      registryRedis: { hgetall: fake.hgetall },
      campaign: CODE,
      battleMapId: ID,
      registryKey: REGISTRY_KEY,
    }),
    ...fake,
  };
}

function exactJsonBytes(value: Record<string, unknown>, bytes: number) {
  const initial = JSON.stringify({ ...value, padding: '' });
  return JSON.stringify({
    ...value,
    padding: 'x'.repeat(bytes - Buffer.byteLength(initial)),
  });
}

describe('server-owned location resource resolution', () => {
  it.each([
    ['decoded detail', location()],
    ['one JSON detail decode', JSON.stringify(location())],
    [
      'exact identity field ceilings',
      location({
        name: 'n'.repeat(200),
        mapImageUrl: 'u'.repeat(8192),
        updatedAt: 't'.repeat(64),
      }),
    ],
  ])('accepts a valid %s', async (_label, detail) => {
    const { result } = await resolve({ detail });
    expect(result).toEqual({ status: 'verified' });
  });

  it.each([
    ['empty string', ''],
    ['json null', 'null'],
    ['scalar', '1'],
    ['array', '[]'],
    ['nested json string', JSON.stringify(JSON.stringify(location()))],
    ['malformed json', '{'],
    ['mismatched id', location({ id: 'other' })],
    ['invalid id', location({ id: 'bad/id' })],
    ['empty name', location({ name: '' })],
    ['long name', location({ name: 'x'.repeat(201) })],
    ['empty image', location({ mapImageUrl: '' })],
    ['long image', location({ mapImageUrl: 'x'.repeat(8193) })],
    ['long updatedAt', location({ updatedAt: 'x'.repeat(65) })],
  ])('rejects corrupt detail: %s without fallback', async (_label, detail) => {
    const { result, get } = await resolve({ detail, list: [location()] });
    expect(result).toEqual({ status: 'corrupt' });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('accepts the exact 20 MiB detail ceiling and rejects one byte over', async () => {
    const exact = exactJsonBytes(location(), 20 * MiB);
    expect(Buffer.byteLength(exact)).toBe(20 * MiB);
    await expect(resolve({ detail: exact })).resolves.toMatchObject({
      result: { status: 'verified' },
    });
    await expect(resolve({ detail: `${exact} ` })).resolves.toMatchObject({
      result: { status: 'corrupt' },
    });
  });

  it.each([
    ['decoded list', [location(), location({ id: 'other' })]],
    ['one JSON list decode', JSON.stringify([location()])],
  ])('uses a valid absent-detail fallback: %s', async (_label, list) => {
    const { result } = await resolve({ detail: null, list });
    expect(result).toEqual({ status: 'verified' });
  });

  it('accepts exactly 1000 valid fallback entries with one exact match', async () => {
    const list = [
      location(),
      ...Array.from({ length: 999 }, (_, index) =>
        location({ id: `other-${index}` })
      ),
    ];
    const { result } = await resolve({ detail: null, list });
    expect(result).toEqual({ status: 'verified' });
  });

  it.each([
    ['empty string', ''],
    ['object', {}],
    ['scalar string', '1'],
    ['nested string', JSON.stringify(JSON.stringify([location()]))],
    ['malformed string', '['],
    ['invalid unrelated entry', [location(), { id: 'other' }]],
    ['zero match', [location({ id: 'other' })]],
    ['duplicate match', [location(), location()]],
    [
      '1001 entries',
      Array.from({ length: 1001 }, (_, index) => location({ id: `x${index}` })),
    ],
  ])('rejects corrupt fallback: %s', async (_label, list) => {
    const { result } = await resolve({ detail: null, list });
    expect(result).toEqual({ status: 'corrupt' });
  });

  it('accepts the exact 1 MiB fallback ceiling and rejects one byte over', async () => {
    const initial = JSON.stringify([location({ padding: '' })]);
    const exact = JSON.stringify([
      location({ padding: 'x'.repeat(MiB - Buffer.byteLength(initial)) }),
    ]);
    expect(Buffer.byteLength(exact)).toBe(MiB);
    await expect(resolve({ detail: null, list: exact })).resolves.toMatchObject(
      {
        result: { status: 'verified' },
      }
    );
    await expect(
      resolve({ detail: null, list: `${exact} ` })
    ).resolves.toMatchObject({
      result: { status: 'corrupt' },
    });
  });

  it.each([
    [
      'one active collision',
      { 'scene-a': JSON.stringify(registry({ sourceMapId: ID })) },
    ],
    [
      'multiple active collisions',
      {
        'scene-a': JSON.stringify(registry({ sourceMapId: ID })),
        'scene-b': JSON.stringify(
          registry({
            sceneId: 'scene-b',
            sourceMapId: ID,
            roomId: '223e4567-e89b-42d3-a456-426614174000',
          })
        ),
      },
    ],
  ])('rejects %s', async (_label, entries) => {
    const { result } = await resolve({ detail: location(), entries });
    expect(result).toEqual({ status: 'collision' });
  });

  it('does not treat tombstoned source matches as collisions', async () => {
    const { result } = await resolve({
      detail: location(),
      entries: {
        'scene-a': JSON.stringify(registry({ sourceMapId: ID, deleted: true })),
      },
    });
    expect(result).toEqual({ status: 'verified' });
  });

  it('accepts the flat field/value HGETALL shape returned by raw Upstash Redis', async () => {
    const raw = JSON.stringify(registry({ sourceMapId: 'other-map' }));
    const result = await resolveVerifiedLocation({
      redis: { get: async () => location() },
      registryRedis: {
        hgetall: async () => ['scene-a', raw] as never,
      },
      campaign: CODE,
      battleMapId: ID,
      registryKey: REGISTRY_KEY,
    });
    expect(result).toEqual({ status: 'verified' });
  });

  it('detects collisions in the flat field/value HGETALL shape', async () => {
    const raw = JSON.stringify(registry({ sourceMapId: ID }));
    const result = await resolveVerifiedLocation({
      redis: { get: async () => location() },
      registryRedis: {
        hgetall: async () => ['scene-a', raw] as never,
      },
      campaign: CODE,
      battleMapId: ID,
      registryKey: REGISTRY_KEY,
    });
    expect(result).toEqual({ status: 'collision' });
  });

  it.each([
    ['odd field/value count', ['scene-a']],
    ['non-string field', [1, JSON.stringify(registry())]],
    [
      'duplicate field',
      [
        'scene-a',
        JSON.stringify(registry()),
        'scene-a',
        JSON.stringify(registry()),
      ],
    ],
  ])('rejects malformed flat HGETALL: %s', async (_label, rawRegistry) => {
    const result = await resolveVerifiedLocation({
      redis: { get: async () => location() },
      registryRedis: { hgetall: async () => rawRegistry as never },
      campaign: CODE,
      battleMapId: ID,
      registryKey: REGISTRY_KEY,
    });
    expect(result).toEqual({ status: 'corrupt' });
  });

  it.each([
    ['unknown field', { ...registry(), extra: true }],
    ['field mismatch', registry({ sceneId: 'other' })],
    ['wrong v', registry({ v: 2 })],
    ['invalid workspace', registry({ workspaceInstanceId: 'bad/id' })],
    ['invalid source', registry({ sourceMapId: 'bad/id' })],
    ['negative revision', registry({ contentRevision: -1 })],
    ['empty safe label', registry({ safeLabel: '' })],
    ['invalid room', registry({ roomId: 'not-uuid' })],
    ['nested encoding', JSON.stringify(registry())],
  ])('rejects corrupt registry entry: %s', async (_label, entry) => {
    const { result } = await resolve({
      detail: location(),
      entries: { 'scene-a': JSON.stringify(entry) },
    });
    expect(result).toEqual({ status: 'corrupt' });
  });

  it('enforces registry field and stored-entry ceilings', async () => {
    const oneHundred = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => {
        const sceneId = `scene-${index}`;
        return [
          sceneId,
          JSON.stringify(
            registry({
              sceneId,
              sourceMapId: null,
              roomId: `123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`,
            })
          ),
        ];
      })
    );
    await expect(
      resolve({ detail: location(), entries: oneHundred })
    ).resolves.toMatchObject({ result: { status: 'verified' } });
    await expect(
      resolve({
        detail: location(),
        entries: {
          ...oneHundred,
          overflow: JSON.stringify(registry({ sceneId: 'overflow' })),
        },
      })
    ).resolves.toMatchObject({ result: { status: 'corrupt' } });

    const raw = JSON.stringify(registry());
    const exact = `${raw}${' '.repeat(2048 - Buffer.byteLength(raw))}`;
    await expect(
      resolve({ detail: location(), entries: { 'scene-a': exact } })
    ).resolves.toMatchObject({ result: { status: 'verified' } });
    await expect(
      resolve({ detail: location(), entries: { 'scene-a': `${exact} ` } })
    ).resolves.toMatchObject({ result: { status: 'corrupt' } });
  });

  it('distinguishes failed detail, fallback, and registry reads as unavailable', async () => {
    const detail = clients({ detail: location() });
    detail.get.mockRejectedValueOnce(new Error('detail failed'));
    await expect(
      resolveVerifiedLocation({
        redis: { get: detail.get },
        registryRedis: { hgetall: detail.hgetall },
        campaign: CODE,
        battleMapId: ID,
        registryKey: REGISTRY_KEY,
      })
    ).resolves.toEqual({ status: 'unavailable' });

    const fallback = clients({ detail: null, list: [location()] });
    fallback.get
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('list failed'));
    await expect(
      resolveVerifiedLocation({
        redis: { get: fallback.get },
        registryRedis: { hgetall: fallback.hgetall },
        campaign: CODE,
        battleMapId: ID,
        registryKey: REGISTRY_KEY,
      })
    ).resolves.toEqual({ status: 'unavailable' });

    const registryFailure = clients({ detail: location() });
    registryFailure.hgetall.mockRejectedValueOnce(new Error('registry failed'));
    await expect(
      resolveVerifiedLocation({
        redis: { get: registryFailure.get },
        registryRedis: { hgetall: registryFailure.hgetall },
        campaign: CODE,
        battleMapId: ID,
        registryKey: REGISTRY_KEY,
      })
    ).resolves.toEqual({ status: 'unavailable' });
  });
});
