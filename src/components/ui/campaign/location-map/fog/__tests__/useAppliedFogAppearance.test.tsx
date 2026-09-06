import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppliedFogAppearance } from '../useAppliedFogAppearance';

describe('useAppliedFogAppearance', () => {
  it('parses the stored value', () => {
    const { result } = renderHook(() => useAppliedFogAppearance('cloudy'));
    expect(result.current).toEqual({
      appearance: 'cloudy',
      fingerprint: 'cloudy',
    });
  });

  it('falls back to solid for a malformed stored value', () => {
    const { result } = renderHook(() => useAppliedFogAppearance('misty'));
    expect(result.current).toEqual({
      appearance: 'solid',
      fingerprint: 'solid',
    });
  });

  it('keeps the same object across re-renders while the raw value is unchanged', () => {
    const raw = {
      v: 2,
      kind: 'custom',
      material: { v: 1, kind: 'solid', color: '#ff0000' },
    };
    const { result, rerender } = renderHook(
      ({ value }) => useAppliedFogAppearance(value),
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
