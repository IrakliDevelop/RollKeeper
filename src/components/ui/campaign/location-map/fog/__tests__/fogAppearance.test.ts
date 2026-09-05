import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUDY_PRESET,
  parseFogAppearance,
  resolveFogRendererOptions,
  resolvePlayerFogStyle,
} from '../fogAppearance';

describe('parseFogAppearance', () => {
  it('returns solid for undefined', () => {
    expect(parseFogAppearance(undefined)).toBe('solid');
  });

  it('returns solid for null', () => {
    expect(parseFogAppearance(null)).toBe('solid');
  });

  it('returns solid for empty string', () => {
    expect(parseFogAppearance('')).toBe('solid');
  });

  it('returns solid for unknown string value', () => {
    expect(parseFogAppearance('misty')).toBe('solid');
  });

  it('returns solid for numeric input', () => {
    expect(parseFogAppearance(42)).toBe('solid');
  });

  it('returns solid for boolean input', () => {
    expect(parseFogAppearance(true)).toBe('solid');
  });

  it('returns solid for object input', () => {
    expect(parseFogAppearance({ kind: 'cloudy' })).toBe('solid');
  });

  it('accepts solid', () => {
    expect(parseFogAppearance('solid')).toBe('solid');
  });

  it('accepts cloudy', () => {
    expect(parseFogAppearance('cloudy')).toBe('cloudy');
  });
});

describe('resolveFogRendererOptions', () => {
  it('returns empty options for solid', () => {
    expect(resolveFogRendererOptions('solid')).toEqual({});
  });

  it('fails closed to solid for malformed and unknown values', () => {
    expect(resolveFogRendererOptions('misty')).toEqual({});
    expect(resolveFogRendererOptions({ kind: 'cloudy' })).toEqual({});
  });

  it('returns procedural styles for cloudy', () => {
    const options = resolveFogRendererOptions('cloudy');
    expect(options.editorStyle).toBeDefined();
    expect(options.playerStyle).toBeDefined();
    expect(options.editorStyle!.kind).toBe('procedural');
    expect(options.playerStyle!.kind).toBe('procedural');
  });

  it('cloudy editor style has contrasting backdrop and tint', () => {
    const options = resolveFogRendererOptions('cloudy');
    const editor = options.editorStyle!;
    expect(editor.kind).toBe('procedural');
    if (editor.kind === 'procedural') {
      expect(editor.backdrop).toBeTruthy();
      expect(editor.tint).toBeTruthy();
      expect(editor.backdrop).not.toBe(editor.tint);
    }
  });

  it('cloudy player style has opaque backdrop', () => {
    const options = resolveFogRendererOptions('cloudy');
    const player = options.playerStyle!;
    expect(player.kind).toBe('procedural');
    if (player.kind === 'procedural') {
      expect(player.backdrop).toBeTruthy();
      expect(player.tint).toBeTruthy();
      expect(player.backdrop).not.toBe(player.tint);
    }
  });

  it('cloudy preset uses a fixed seed', () => {
    const options = resolveFogRendererOptions('cloudy');
    const editor = options.editorStyle!;
    const player = options.playerStyle!;
    if (editor.kind === 'procedural' && player.kind === 'procedural') {
      expect(editor.seed).toBe(player.seed);
      expect(typeof editor.seed).toBe('number');
    }
  });

  it('returns the same object reference for repeated cloudy calls', () => {
    const a = resolveFogRendererOptions('cloudy');
    const b = resolveFogRendererOptions('cloudy');
    expect(a).toBe(b);
  });

  it('returns the same object reference for repeated solid calls', () => {
    const a = resolveFogRendererOptions('solid');
    const b = resolveFogRendererOptions('solid');
    expect(a).toBe(b);
  });
});

const customSolid = {
  v: 2,
  kind: 'custom',
  material: { v: 1, kind: 'solid', color: '#ff0000' },
} as const;

describe('custom appearances', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('resolves to solid while the library gate is off', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', '');
    expect(parseFogAppearance(customSolid)).toBe('solid');
    expect(resolveFogRendererOptions(customSolid)).toEqual({});
  });

  it('resolves custom materials while the gate is on', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', 'true');
    expect(parseFogAppearance(customSolid)).toEqual(customSolid);
    expect(resolveFogRendererOptions(customSolid).playerStyle).toEqual({
      kind: 'solid',
      color: '#ff0000',
    });
  });
});

describe('resolvePlayerFogStyle', () => {
  it('matches the renderer defaults for legacy values', () => {
    expect(resolvePlayerFogStyle('solid')).toEqual({
      kind: 'solid',
      color: '#0b1020',
    });
    expect(resolvePlayerFogStyle(undefined)).toEqual({
      kind: 'solid',
      color: '#0b1020',
    });
    expect(resolvePlayerFogStyle('cloudy')).toEqual(CLOUDY_PRESET.playerStyle);
  });
});
