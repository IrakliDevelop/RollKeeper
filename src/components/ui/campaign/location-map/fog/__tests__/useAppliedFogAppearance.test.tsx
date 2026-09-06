import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppliedFogAppearance } from '../useAppliedFogAppearance';

afterEach(() => vi.unstubAllEnvs());

describe('useAppliedFogAppearance', () => {
  it('returns solid when disabled regardless of the stored value', () => {
    const { result } = renderHook(() =>
      useAppliedFogAppearance('cloudy', false)
    );
    expect(result.current).toEqual({
      appearance: 'solid',
      fingerprint: 'solid',
    });
  });

  it('keeps the same object across re-renders while the raw value is unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_FOG_PRESET_LIBRARY_ENABLED', 'true');
    const raw = {
      v: 2,
      kind: 'custom',
      material: { v: 1, kind: 'solid', color: '#ff0000' },
    };
    const { result, rerender } = renderHook(
      ({ value }) => useAppliedFogAppearance(value, true),
      {
        initialProps: { value: raw as unknown },
      }
    );
    const first = result.current.appearance;
    rerender({ value: raw });
    expect(result.current.appearance).toBe(first);
    expect(result.current.fingerprint).toBe(
      'custom:' + JSON.stringify({ color: '#ff0000', kind: 'solid', v: 1 })
    );
  });
});
