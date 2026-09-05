import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDmStore } from '@/store/dmStore';
import type { FogPresetV1 } from '@/types/fogMaterial';

function preset(id: string, name: string): FogPresetV1 {
  return {
    v: 1,
    id,
    name,
    material: { v: 1, kind: 'solid', color: '#102030' },
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  };
}

const CODE = 'PRESETS';

beforeEach(() => {
  useDmStore.setState({
    campaigns: [
      { code: CODE, name: 'C', createdAt: '2026-09-05T00:00:00.000Z' },
    ],
  });
});

function presets(): FogPresetV1[] | undefined {
  return useDmStore.getState().getCampaign(CODE)?.fogPresets;
}

describe('fog preset store actions', () => {
  it('appends new presets in creation order and replaces by id', () => {
    const { upsertFogPreset } = useDmStore.getState();
    upsertFogPreset(CODE, preset('fp_b', 'B'));
    upsertFogPreset(CODE, preset('fp_a', 'A'));
    upsertFogPreset(CODE, {
      ...preset('fp_b', 'B renamed'),
      updatedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(presets()!.map(p => [p.id, p.name])).toEqual([
      ['fp_b', 'B renamed'],
      ['fp_a', 'A'],
    ]);
  });

  it('removes presets and drops the field when the library is empty', () => {
    const { upsertFogPreset, removeFogPreset } = useDmStore.getState();
    upsertFogPreset(CODE, preset('fp_a', 'A'));
    removeFogPreset(CODE, 'fp_a');
    expect(presets()).toBeUndefined();
    expect('fogPresets' in useDmStore.getState().getCampaign(CODE)!).toBe(
      false
    );
  });

  it('ignores appends past the cap but still allows replacement', () => {
    const { upsertFogPreset } = useDmStore.getState();
    for (let i = 0; i < 50; i += 1)
      upsertFogPreset(CODE, preset(`fp_${i}`, `P${i}`));
    upsertFogPreset(CODE, preset('fp_overflow', 'Overflow'));
    expect(presets()).toHaveLength(50);
    upsertFogPreset(CODE, preset('fp_0', 'Replaced'));
    expect(presets()![0].name).toBe('Replaced');
  });

  it('does not touch other campaigns or store the caller object', () => {
    useDmStore.setState({
      campaigns: [
        { code: CODE, name: 'C', createdAt: '2026-09-05T00:00:00.000Z' },
        { code: 'OTHER', name: 'O', createdAt: '2026-09-05T00:00:00.000Z' },
      ],
    });
    const input = preset('fp_a', 'A');
    useDmStore.getState().upsertFogPreset(CODE, input);
    expect(
      useDmStore.getState().getCampaign('OTHER')!.fogPresets
    ).toBeUndefined();
    expect(presets()![0]).not.toBe(input);
    expect(presets()![0]).toEqual(input);
  });
});
