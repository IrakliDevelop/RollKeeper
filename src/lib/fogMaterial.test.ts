import { describe, expect, it } from 'vitest';
import {
  CLOUDY_AS_CUSTOM_MATERIAL,
  DEFAULT_CUSTOM_PROCEDURAL_MATERIAL,
  DEFAULT_CUSTOM_SOLID_MATERIAL,
  FOG_MATERIAL_BOUNDS,
  fogMaterialFingerprint,
  fogMaterialsEqual,
  normalizeHexColor,
  parseCustomFogMaterial,
  resolveCustomFogRendererOptions,
  resolveCustomPlayerFogStyle,
} from './fogMaterial';

const procedural = {
  v: 1,
  kind: 'procedural',
  baseColor: '#102030',
  noiseColor: '#A0B0C0',
  noiseOpacity: 0.4,
  scale: 300,
  detail: 3,
  seed: 1234,
} as const;

describe('normalizeHexColor', () => {
  it('accepts six-digit hex in any case and lowercases it', () => {
    expect(normalizeHexColor('#A0B0C0')).toBe('#a0b0c0');
    expect(normalizeHexColor('#a0b0c0')).toBe('#a0b0c0');
  });

  it('rejects every other CSS color form', () => {
    for (const bad of [
      '#abc',
      '#aabbccdd',
      'red',
      'rgba(0,0,0,0.5)',
      'url(x)',
      ' #a0b0c0',
      '',
      null,
      undefined,
      42,
    ]) {
      expect(normalizeHexColor(bad)).toBeNull();
    }
  });
});

describe('parseCustomFogMaterial', () => {
  it('returns a fresh normalized procedural material', () => {
    const parsed = parseCustomFogMaterial(procedural);
    expect(parsed).toEqual({ ...procedural, noiseColor: '#a0b0c0' });
    expect(parsed).not.toBe(procedural);
  });

  it('returns a fresh normalized solid material', () => {
    expect(
      parseCustomFogMaterial({ v: 1, kind: 'solid', color: '#FFEEDD' })
    ).toEqual({
      v: 1,
      kind: 'solid',
      color: '#ffeedd',
    });
  });

  it('rejects wrong version, kind, or missing fields', () => {
    expect(parseCustomFogMaterial({ ...procedural, v: 2 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, kind: 'noise' })).toBeNull();
    expect(parseCustomFogMaterial({ v: 1, kind: 'solid' })).toBeNull();
    expect(parseCustomFogMaterial(null)).toBeNull();
    expect(parseCustomFogMaterial('solid')).toBeNull();
  });

  it('rejects non-finite and out-of-bounds numbers instead of clamping', () => {
    expect(
      parseCustomFogMaterial({ ...procedural, noiseOpacity: 1.01 })
    ).toBeNull();
    expect(
      parseCustomFogMaterial({ ...procedural, noiseOpacity: Number.NaN })
    ).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, scale: 63 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, scale: 1025 })).toBeNull();
    expect(
      parseCustomFogMaterial({ ...procedural, scale: Infinity })
    ).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, detail: 5 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, detail: 2.5 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, seed: -1 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, seed: 65536 })).toBeNull();
    expect(parseCustomFogMaterial({ ...procedural, seed: 1.5 })).toBeNull();
  });

  it('accepts the exact bounds', () => {
    expect(
      parseCustomFogMaterial({
        ...procedural,
        noiseOpacity: 0,
        scale: 64,
        detail: 1,
        seed: 0,
      })
    ).not.toBeNull();
    expect(
      parseCustomFogMaterial({
        ...procedural,
        noiseOpacity: 1,
        scale: 1024,
        detail: 4,
        seed: 65535,
      })
    ).not.toBeNull();
    expect(FOG_MATERIAL_BOUNDS.scale).toEqual({ min: 64, max: 1024 });
  });

  it('drops unknown keys', () => {
    const parsed = parseCustomFogMaterial({
      ...procedural,
      url: 'x',
      filter: 'blur',
    });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!)).toEqual([
      'v',
      'kind',
      'baseColor',
      'noiseColor',
      'noiseOpacity',
      'scale',
      'detail',
      'seed',
    ]);
  });
});

describe('fingerprint and equality', () => {
  it('is independent of key order and object identity', () => {
    const reordered = {
      seed: 1234,
      detail: 3,
      scale: 300,
      noiseOpacity: 0.4,
      noiseColor: '#a0b0c0',
      baseColor: '#102030',
      kind: 'procedural',
      v: 1,
    } as const;
    const a = parseCustomFogMaterial(procedural)!;
    const b = parseCustomFogMaterial(reordered)!;
    expect(fogMaterialFingerprint(a)).toBe(fogMaterialFingerprint(b));
    expect(fogMaterialsEqual(a, b)).toBe(true);
    expect(fogMaterialsEqual(a, { ...a, seed: 1 } as typeof a)).toBe(false);
  });
});

describe('resolveCustomFogRendererOptions', () => {
  it('keeps the player fill opaque for procedural materials', () => {
    const options = resolveCustomFogRendererOptions(
      parseCustomFogMaterial(procedural)!
    );
    expect(options.playerStyle).toEqual({
      kind: 'procedural',
      backdrop: '#102030',
      tint: '#a0b0c0',
      opacity: 0.4,
      scale: 300,
      seed: 1234,
      detail: 3,
    });
    expect(options.editorStyle).toEqual({
      kind: 'procedural',
      backdrop: 'rgba(16, 32, 48, 0.5)',
      tint: '#a0b0c0',
      opacity: 0.4,
      scale: 300,
      seed: 1234,
      detail: 3,
    });
    expect(options.editorColor).toBeUndefined();
    expect(options.playerColor).toBeUndefined();
  });

  it('keeps the player fill opaque for solid materials', () => {
    const options = resolveCustomFogRendererOptions({
      v: 1,
      kind: 'solid',
      color: '#ffeedd',
    });
    expect(options.playerStyle).toEqual({ kind: 'solid', color: '#ffeedd' });
    expect(options.editorStyle).toEqual({
      kind: 'solid',
      color: 'rgba(255, 238, 221, 0.45)',
    });
  });

  it('exposes the player style alone for exports', () => {
    expect(
      resolveCustomPlayerFogStyle({ v: 1, kind: 'solid', color: '#ffeedd' })
    ).toEqual({
      kind: 'solid',
      color: '#ffeedd',
    });
  });
});

describe('default materials', () => {
  it('are valid under the parser', () => {
    expect(parseCustomFogMaterial(DEFAULT_CUSTOM_SOLID_MATERIAL)).toEqual(
      DEFAULT_CUSTOM_SOLID_MATERIAL
    );
    expect(parseCustomFogMaterial(DEFAULT_CUSTOM_PROCEDURAL_MATERIAL)).toEqual(
      DEFAULT_CUSTOM_PROCEDURAL_MATERIAL
    );
    expect(parseCustomFogMaterial(CLOUDY_AS_CUSTOM_MATERIAL)).toEqual(
      CLOUDY_AS_CUSTOM_MATERIAL
    );
  });
});
