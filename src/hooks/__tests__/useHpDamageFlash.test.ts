import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  useHpDamageFlash,
  type HpDamageFlashInput,
} from '@/hooks/useHpDamageFlash';

afterEach(cleanup);

function setup(initial: HpDamageFlashInput) {
  return renderHook(props => useHpDamageFlash(props), {
    initialProps: initial,
  });
}

describe('useHpDamageFlash', () => {
  it('does not flash on the first value', () => {
    const { result } = setup({ id: 'a', current: 31, max: 42 });
    expect(result.current).toBe(0);
  });

  it('flashes when current drops', () => {
    const { result, rerender } = setup({ id: 'a', current: 42, max: 42 });
    rerender({ id: 'a', current: 31, max: 42 });
    expect(result.current).toBe(1);
  });

  it('does not flash on healing', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    rerender({ id: 'a', current: 42, max: 42 });
    expect(result.current).toBe(0);
  });

  it('does not flash when nothing changed', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    rerender({ id: 'a', current: 31, max: 42 });
    expect(result.current).toBe(0);
  });

  it('does not flash when max changes with current', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    rerender({ id: 'a', current: 20, max: 30 });
    expect(result.current).toBe(0);
    // The new values are the baseline for the next hit.
    rerender({ id: 'a', current: 15, max: 30 });
    expect(result.current).toBe(1);
  });

  it('does not flash across a character switch', () => {
    const { result, rerender } = setup({ id: 'a', current: 42, max: 42 });
    rerender({ id: 'b', current: 10, max: 42 });
    expect(result.current).toBe(0);
    rerender({ id: 'b', current: 5, max: 42 });
    expect(result.current).toBe(1);
  });

  it('counts each hit', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    rerender({ id: 'a', current: 20, max: 42 });
    rerender({ id: 'a', current: 10, max: 42 });
    expect(result.current).toBe(2);
  });

  it('counts each hit once under StrictMode', () => {
    const { result, rerender } = renderHook(props => useHpDamageFlash(props), {
      initialProps: { id: 'a', current: 31, max: 42 },
      wrapper: StrictMode,
    });
    rerender({ id: 'a', current: 20, max: 42 });
    rerender({ id: 'a', current: 10, max: 42 });
    expect(result.current).toBe(2);
  });

  it('settles on a NaN value instead of re-rendering forever', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    expect(() => rerender({ id: 'a', current: NaN, max: 42 })).not.toThrow();
    expect(() => rerender({ id: 'a', current: NaN, max: 42 })).not.toThrow();
    expect(result.current).toBe(0);
  });

  it('keeps the count through a heal', () => {
    const { result, rerender } = setup({ id: 'a', current: 31, max: 42 });
    rerender({ id: 'a', current: 20, max: 42 });
    rerender({ id: 'a', current: 30, max: 42 });
    expect(result.current).toBe(1);
  });
});
