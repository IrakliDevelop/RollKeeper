import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isFogAppearanceV1,
  isFogOfWarEnabled,
  isFogPresetLibraryEnabled,
  isProceduralFogAppearanceEnabled,
  normalizeFogAppearance,
  normalizeFogAppearanceProjectionTimestamp,
  parseBattleMapFogAppearanceProjection,
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
