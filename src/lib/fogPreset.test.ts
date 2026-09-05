import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FOG_PRESET_LIMITS,
  RESERVED_FOG_PRESET_NAMES,
  canAddFogPreset,
  findFogPresetNameConflict,
  generateFogPresetId,
  normalizeFogPresetName,
  parseFogPreset,
  parseFogPresetLibrary,
  sortFogPresetsForDisplay,
} from './fogPreset';
import type { FogPresetV1 } from '@/types/fogMaterial';

const material = { v: 1, kind: 'solid', color: '#102030' } as const;

function preset(
  id: string,
  name: string,
  createdAt = '2026-09-05T00:00:00.000Z'
): FogPresetV1 {
  return { v: 1, id, name, material, createdAt, updatedAt: createdAt };
}

afterEach(() => vi.unstubAllGlobals());

describe('normalizeFogPresetName', () => {
  it('trims and bounds by code points', () => {
    expect(normalizeFogPresetName('  Poison Mist ')).toBe('Poison Mist');
    expect(normalizeFogPresetName('   ')).toBeNull();
    expect(normalizeFogPresetName('x'.repeat(60))).toBe('x'.repeat(60));
    expect(normalizeFogPresetName('x'.repeat(61))).toBeNull();
    expect(normalizeFogPresetName('🌫️'.repeat(30))).not.toBeNull();
    expect(normalizeFogPresetName(42)).toBeNull();
  });
});

describe('parseFogPreset', () => {
  it('returns a fresh normalized preset', () => {
    const raw = preset('fp_1', ' Mist ');
    const parsed = parseFogPreset({ ...raw, extra: true });
    expect(parsed).toEqual({ ...raw, name: 'Mist' });
    expect(parsed).not.toBe(raw);
    expect(parsed!.material).not.toBe(raw.material);
  });

  it('rejects bad version, id, name, material, or timestamps', () => {
    expect(parseFogPreset({ ...preset('fp_1', 'A'), v: 2 })).toBeNull();
    expect(parseFogPreset(preset('', 'A'))).toBeNull();
    expect(parseFogPreset(preset('solid', 'A'))).toBeNull();
    expect(parseFogPreset(preset('cloudy', 'A'))).toBeNull();
    expect(parseFogPreset(preset('x'.repeat(65), 'A'))).toBeNull();
    expect(parseFogPreset(preset('fp_ü', 'A'))).toBeNull();
    expect(parseFogPreset(preset('fp_1', ''))).toBeNull();
    expect(
      parseFogPreset({
        ...preset('fp_1', 'A'),
        material: { v: 1, kind: 'solid', color: 'red' },
      })
    ).toBeNull();
    expect(
      parseFogPreset({ ...preset('fp_1', 'A'), createdAt: 'yesterday' })
    ).toBeNull();
    expect(parseFogPreset({ ...preset('fp_1', 'A'), updatedAt: 7 })).toBeNull();
  });
});

describe('parseFogPresetLibrary', () => {
  it('skips invalid records, drops duplicate ids, keeps storage order, and caps at the limit', () => {
    const many = Array.from({ length: 55 }, (_, i) =>
      preset(`fp_${i}`, `P${i}`)
    );
    const library = parseFogPresetLibrary([
      preset('fp_b', 'B'),
      { broken: true },
      preset('fp_a', 'A'),
      preset('fp_b', 'B again'),
      ...many,
    ]);
    expect(library.map(p => p.id).slice(0, 2)).toEqual(['fp_b', 'fp_a']);
    expect(library).toHaveLength(FOG_PRESET_LIMITS.maxPresets);
  });

  it('returns an empty library for non-arrays', () => {
    expect(parseFogPresetLibrary(undefined)).toEqual([]);
    expect(parseFogPresetLibrary({})).toEqual([]);
  });
});

describe('ids and limits', () => {
  it('prefixes generated ids and stays inside the length bound', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(generateFogPresetId()).toBe(
      'fp_123e4567-e89b-12d3-a456-426614174000'
    );
    expect(generateFogPresetId().length).toBeLessThanOrEqual(
      FOG_PRESET_LIMITS.maxIdLength
    );
  });

  it('falls back when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const id = generateFogPresetId();
    expect(id.startsWith('fp_')).toBe(true);
    expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
    expect(id.length).toBeLessThanOrEqual(FOG_PRESET_LIMITS.maxIdLength);
  });

  it('refuses additions at the cap', () => {
    const full = Array.from({ length: 50 }, (_, i) =>
      preset(`fp_${i}`, `P${i}`)
    );
    expect(canAddFogPreset(full)).toBe(false);
    expect(canAddFogPreset(full.slice(1))).toBe(true);
  });
});

describe('findFogPresetNameConflict', () => {
  const library = [preset('fp_1', 'Poison Mist'), preset('fp_2', 'Blizzard')];

  it('rejects reserved names case-insensitively', () => {
    expect(RESERVED_FOG_PRESET_NAMES).toEqual([
      'solid (classic)',
      'solid',
      'cloudy',
    ]);
    expect(findFogPresetNameConflict(library, ' CLOUDY ')).toBe('reserved');
    expect(findFogPresetNameConflict(library, 'Solid (Classic)')).toBe(
      'reserved'
    );
  });

  it('rejects duplicates except for the preset being renamed', () => {
    expect(findFogPresetNameConflict(library, 'poison mist')).toBe('duplicate');
    expect(
      findFogPresetNameConflict(library, 'poison mist', 'fp_1')
    ).toBeNull();
    expect(findFogPresetNameConflict(library, 'Ethereal')).toBeNull();
  });
});

describe('sortFogPresetsForDisplay', () => {
  it('sorts by name case-insensitively without mutating storage order', () => {
    const library = [
      preset('fp_1', 'zeta'),
      preset('fp_2', 'Alpha'),
      preset('fp_3', 'beta'),
    ];
    expect(sortFogPresetsForDisplay(library).map(p => p.name)).toEqual([
      'Alpha',
      'beta',
      'zeta',
    ]);
    expect(library.map(p => p.name)).toEqual(['zeta', 'Alpha', 'beta']);
  });
});
