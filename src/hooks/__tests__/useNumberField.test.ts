import type * as React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useNumberField,
  type UseNumberFieldOptions,
} from '@/hooks/useNumberField';

afterEach(cleanup);

const typed = (raw: string) =>
  ({ target: { value: raw } }) as React.ChangeEvent<HTMLInputElement>;

function setup(options: Partial<UseNumberFieldOptions> = {}) {
  const onChange = vi.fn();
  const view = renderHook(
    (props: Partial<UseNumberFieldOptions>) =>
      useNumberField({ value: 12, onChange, ...options, ...props }),
    { initialProps: {} }
  );
  return { onChange, ...view };
}

describe('useNumberField live mode (default)', () => {
  it('still sends every valid keystroke', () => {
    const { result, onChange } = setup();
    act(() => result.current.onChange(typed('15')));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('sends a keystroke even when the number repeats', () => {
    const { result, onChange } = setup({ value: 5 });
    act(() => result.current.onChange(typed('05')));
    act(() => result.current.onChange(typed('5')));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('steps from the typed value and sends the result', () => {
    const { result, onChange } = setup({ max: 20 });
    act(() => result.current.step(10));
    expect(result.current.value).toBe('20');
    expect(onChange).toHaveBeenLastCalledWith(20);
  });
});

describe('useNumberField draft mode (live: false)', () => {
  it('keeps typing as a draft until commit', () => {
    const { result, onChange } = setup({ live: false });
    act(() => result.current.onChange(typed('15')));
    expect(result.current.value).toBe('15');
    expect(onChange).not.toHaveBeenCalled();

    let committed: number | undefined;
    act(() => {
      committed = result.current.commit();
    });
    expect(committed).toBe(15);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(15);
  });

  it('clamps on commit', () => {
    const { result, onChange } = setup({ live: false, min: 1, max: 30 });
    act(() => result.current.onChange(typed('45')));
    act(() => {
      result.current.commit();
    });
    expect(result.current.value).toBe('30');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(30);
  });

  it('commits on blur', () => {
    const { result, onChange } = setup({ live: false });
    act(() => result.current.onChange(typed('9')));
    act(() => result.current.onBlur());
    expect(onChange).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('throws the draft away on cancel', () => {
    const { result, onChange } = setup({ live: false });
    act(() => result.current.onChange(typed('99')));
    act(() => result.current.cancel());
    expect(result.current.value).toBe('12');
    act(() => result.current.onBlur());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps the draft by 1 and 10 within the bounds, sending nothing', () => {
    const { result, onChange } = setup({ live: false, min: 0, max: 15 });
    act(() => result.current.step(1));
    expect(result.current.value).toBe('13');
    act(() => result.current.step(10));
    expect(result.current.value).toBe('15');
    act(() => result.current.step(-10));
    expect(result.current.value).toBe('5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a step made in the same handler', () => {
    const { result, onChange } = setup({ live: false });
    act(() => {
      result.current.step(1);
      result.current.commit();
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(13);
  });

  it('reports the draft against min and max', () => {
    const { result } = setup({ live: false, min: 1, max: 30 });
    expect(result.current.validity).toBe('valid');
    act(() => result.current.onChange(typed('')));
    expect(result.current.validity).toBe('empty');
    act(() => result.current.onChange(typed('-')));
    expect(result.current.validity).toBe('empty');
    act(() => result.current.onChange(typed('0')));
    expect(result.current.validity).toBe('below');
    act(() => result.current.onChange(typed('31')));
    expect(result.current.validity).toBe('above');
  });

  it('follows a new value while there is no draft', () => {
    const { result, rerender } = setup({ live: false });
    rerender({ value: 14 });
    expect(result.current.value).toBe('14');
  });

  it('keeps a draft when the value changes underneath it', () => {
    const { result, rerender, onChange } = setup({ live: false });
    act(() => result.current.onChange(typed('20')));
    rerender({ value: 14 });
    expect(result.current.value).toBe('20');
    act(() => {
      result.current.commit();
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(20);
  });

  it('sends a retyped draft that matches the old value after the value changed', () => {
    const { result, rerender, onChange } = setup({ live: false, value: 15 });
    act(() => result.current.onChange(typed('17')));
    rerender({ value: 20 });
    act(() => result.current.onChange(typed('15')));
    act(() => {
      result.current.commit();
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(15);
  });

  it('exposes the typed number as the draft', () => {
    const { result } = setup({ live: false });
    expect(result.current.draft).toBe(12);
    act(() => result.current.onChange(typed('-')));
    expect(result.current.draft).toBeUndefined();
    act(() => result.current.onChange(typed('-4')));
    expect(result.current.draft).toBe(-4);
  });
});
