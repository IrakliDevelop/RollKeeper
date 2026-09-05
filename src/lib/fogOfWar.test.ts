import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downgradeFogAppearanceForGate,
  fogAppearanceFingerprint,
  isFogAppearanceV1,
  isFogOfWarEnabled,
  isFogPresetLibraryEnabled,
  isProceduralFogAppearanceEnabled,
  normalizeFogAppearance,
  normalizeFogAppearanceProjectionTimestamp,
  parseAppliedFogAppearance,
  parseBattleMapFogAppearanceProjection,
  parseFogAppearanceForClient,
  parseProjectedFogAppearance,
  toProjectedFogAppearance,
} from './fogOfWar';

describe('fog feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps both fog capabilities disabled by default', () => {
    vi.stubEnv('NEXT_PUBLIC_FOG_OF_WAR_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', '');

    expect(isFogOfWarEnabled()).toBe(false);
    expect(isProceduralFogAppearanceEnabled()).toBe(false);
  });

  it('enables procedural appearance only through its own exact flag', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    expect(isProceduralFogAppearanceEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'TRUE');
    expect(isProceduralFogAppearanceEnabled()).toBe(false);
  });

  it('enables the preset library only when both exact flags are true', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', 'true');
    expect(isFogPresetLibraryEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', '');
    expect(isFogPresetLibraryEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', 'TRUE');
    expect(isFogPresetLibraryEnabled()).toBe(false);
  });
});

describe('battle-map fog appearance projection', () => {
  it('accepts only the supported appearance ids', () => {
    expect(isFogAppearanceV1('solid')).toBe(true);
    expect(isFogAppearanceV1('cloudy')).toBe(true);
    expect(isFogAppearanceV1('misty')).toBe(false);
    expect(isFogAppearanceV1(null)).toBe(false);
    expect(normalizeFogAppearance('cloudy')).toBe('cloudy');
    expect(normalizeFogAppearance('misty')).toBe('solid');
    expect(
      normalizeFogAppearanceProjectionTimestamp('2026-09-05T00:00:00.000Z')
    ).toBe('2026-09-05T00:00:00.000Z');
    expect(normalizeFogAppearanceProjectionTimestamp('later')).toBeNull();
  });

  it('accepts a complete v1 projection', () => {
    expect(
      parseBattleMapFogAppearanceProjection({
        v: 1,
        appearance: 'cloudy',
        updatedAt: '2026-09-05T00:00:00.000Z',
      })
    ).toEqual({
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
  });

  it.each([
    null,
    {},
    { v: 2, appearance: 'cloudy', updatedAt: 'now' },
    { v: 1, appearance: 'misty', updatedAt: 'now' },
    { v: 1, appearance: 'cloudy' },
    { v: 1, appearance: 'cloudy', updatedAt: '' },
    { v: 1, appearance: 'cloudy', updatedAt: 'later' },
  ])('rejects malformed or future projections: %j', value => {
    expect(parseBattleMapFogAppearanceProjection(value)).toBeNull();
  });
});

describe('applied and projected fog appearance', () => {
  const material = { v: 1, kind: 'solid', color: '#102030' } as const;
  const applied = {
    v: 2,
    kind: 'custom',
    sourcePresetId: 'fp_1',
    material,
  } as const;

  it('keeps legacy strings and parses V2 snapshots freshly', () => {
    expect(parseAppliedFogAppearance('cloudy')).toBe('cloudy');
    const parsed = parseAppliedFogAppearance({ ...applied, extra: 1 });
    expect(parsed).toEqual(applied);
    expect(parsed).not.toBe(applied);
  });

  it('fails closed to solid for malformed snapshots', () => {
    expect(parseAppliedFogAppearance({ ...applied, v: 3 })).toBe('solid');
    expect(parseAppliedFogAppearance({ ...applied, kind: 'preset' })).toBe(
      'solid'
    );
    expect(
      parseAppliedFogAppearance({
        ...applied,
        material: { v: 1, kind: 'solid', color: 'red' },
      })
    ).toBe('solid');
    expect(parseAppliedFogAppearance({ ...applied, sourcePresetId: 42 })).toBe(
      'solid'
    );
    expect(
      parseAppliedFogAppearance({ ...applied, sourcePresetId: 'x'.repeat(65) })
    ).toBe('solid');
    expect(parseAppliedFogAppearance('misty')).toBe('solid');
    expect(parseAppliedFogAppearance(undefined)).toBe('solid');
  });

  it('allows an applied snapshot without a source id', () => {
    const { sourcePresetId: _omit, ...orphan } = applied;
    expect(parseAppliedFogAppearance(orphan)).toEqual(orphan);
  });

  it('strips the source id when projecting and rejects it when parsing projections', () => {
    expect(toProjectedFogAppearance(applied)).toEqual({
      v: 2,
      kind: 'custom',
      material,
    });
    expect(toProjectedFogAppearance('cloudy')).toBe('cloudy');
    expect(
      parseProjectedFogAppearance({ v: 2, kind: 'custom', material })
    ).toEqual({
      v: 2,
      kind: 'custom',
      material,
    });
    expect(JSON.stringify(parseProjectedFogAppearance(applied))).not.toContain(
      'fp_1'
    );
  });

  it('downgrades custom values to solid while the library gate is off', () => {
    expect(downgradeFogAppearanceForGate(applied, false)).toBe('solid');
    expect(downgradeFogAppearanceForGate('cloudy', false)).toBe('cloudy');
    expect(downgradeFogAppearanceForGate(applied, true)).toBe(applied);
  });

  it('parses for clients using the gate', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', '');
    expect(parseFogAppearanceForClient(applied)).toBe('solid');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', 'true');
    expect(parseFogAppearanceForClient(applied)).toEqual(applied);
    vi.unstubAllEnvs();
  });

  it('fingerprints by material, not identity or source id', () => {
    expect(fogAppearanceFingerprint('solid')).toBe('solid');
    expect(fogAppearanceFingerprint(applied)).toBe(
      fogAppearanceFingerprint({
        v: 2,
        kind: 'custom',
        material: { ...material },
      })
    );
    expect(fogAppearanceFingerprint(applied)).not.toBe(
      fogAppearanceFingerprint('solid')
    );
  });
});

describe('projection records V1 and V2', () => {
  const updatedAt = '2026-09-05T10:00:00.000Z';
  const material = {
    v: 1,
    kind: 'procedural',
    baseColor: '#000000',
    noiseColor: '#ffffff',
    noiseOpacity: 0.5,
    scale: 128,
    detail: 2,
    seed: 9,
  } as const;

  it('still accepts V1 records', () => {
    expect(
      parseBattleMapFogAppearanceProjection({
        v: 1,
        appearance: 'cloudy',
        updatedAt,
      })
    ).toEqual({
      v: 1,
      appearance: 'cloudy',
      updatedAt,
    });
  });

  it('accepts V2 records with a projected custom appearance and drops unknown keys', () => {
    const record = parseBattleMapFogAppearanceProjection(
      JSON.stringify({
        v: 2,
        appearance: { v: 2, kind: 'custom', material, sourcePresetId: 'fp_1' },
        updatedAt,
        extra: 1,
      })
    );
    expect(record).toEqual({
      v: 2,
      appearance: { v: 2, kind: 'custom', material },
      updatedAt,
    });
  });

  it('rejects V2 records with legacy strings or invalid materials', () => {
    expect(
      parseBattleMapFogAppearanceProjection({
        v: 2,
        appearance: 'cloudy',
        updatedAt,
      })
    ).toBeNull();
    expect(
      parseBattleMapFogAppearanceProjection({
        v: 2,
        appearance: { v: 2, kind: 'custom', material: {} },
        updatedAt,
      })
    ).toBeNull();
    expect(
      parseBattleMapFogAppearanceProjection({
        v: 3,
        appearance: 'solid',
        updatedAt,
      })
    ).toBeNull();
  });
});
