import { describe, expect, it } from 'vitest';
import { resolveCustomFogRendererOptions } from '@/lib/fogMaterial';
import { resolvePlayerFogStyle } from '@/components/ui/campaign/location-map/fog';
import type { CustomFogMaterialV1 } from '@/types/fogMaterial';

const cases: CustomFogMaterialV1[] = [
  { v: 1, kind: 'solid', color: '#ffffff' },
  { v: 1, kind: 'solid', color: '#000000' },
  {
    v: 1,
    kind: 'procedural',
    baseColor: '#ffffff',
    noiseColor: '#000000',
    noiseOpacity: 0,
    scale: 64,
    detail: 1,
    seed: 0,
  },
  {
    v: 1,
    kind: 'procedural',
    baseColor: '#000000',
    noiseColor: '#ffffff',
    noiseOpacity: 1,
    scale: 1024,
    detail: 4,
    seed: 65535,
  },
];

describe('player safety for every accepted material', () => {
  it('never emits a translucent player backdrop or color', () => {
    for (const material of cases) {
      const options = resolveCustomFogRendererOptions(material);
      const player = options.playerStyle!;
      const opaque =
        player.kind === 'procedural' ? player.backdrop : player.color;
      expect(opaque).toMatch(/^#[0-9a-f]{6}$/);
      const editor = options.editorStyle!;
      const translucent =
        editor.kind === 'procedural' ? editor.backdrop : editor.color;
      expect(translucent).toMatch(/^rgba\(/);
    }
  });

  it('keeps legacy exports byte-identical by resolving the same explicit styles', () => {
    expect(resolvePlayerFogStyle('solid')).toEqual({
      kind: 'solid',
      color: '#0b1020',
    });
    expect(resolvePlayerFogStyle('cloudy')).toMatchObject({
      kind: 'procedural',
      backdrop: '#0b1020',
    });
  });
});
