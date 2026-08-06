import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useToast } from './Toast';

describe('useToast semantic icons', () => {
  it('stores attack and detail icons separately from display text', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showAttackRoll('Longsword', 20, 5, true, '1d8 + 3');
    });

    expect(result.current.toasts[0]).toMatchObject({
      icon: 'criticalSuccess',
      title: 'Longsword — CRITICAL!',
      details: [
        { icon: 'damage', text: 'Damage: 1d8 + 3' },
        {
          icon: 'criticalSuccess',
          text: "Don't forget to double the damage dice!",
        },
      ],
    });
  });

  it('uses distinct canonical icons for short and long rests', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showShortRest();
      result.current.showLongRest();
    });

    expect(
      result.current.toasts.map(({ icon, title }) => ({ icon, title }))
    ).toEqual([
      { icon: 'restShort', title: 'Short Rest Complete' },
      { icon: 'restLong', title: 'Long Rest Complete' },
    ]);
  });
});
