import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTokenInfoToggle } from '@/components/ui/campaign/token-overlay/useTokenInfoToggle';

describe('useTokenInfoToggle', () => {
  beforeEach(() => localStorage.clear());

  it('defaults ON and persists toggles', () => {
    const { result } = renderHook(() => useTokenInfoToggle('test-key'));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('test-key')).toBe('false');
  });

  it('restores a persisted OFF state', () => {
    localStorage.setItem('test-key', 'false');
    const { result } = renderHook(() => useTokenInfoToggle('test-key'));
    expect(result.current[0]).toBe(false);
  });
});
