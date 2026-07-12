import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTokenInfoMode } from '@/components/ui/campaign/token-overlay/useTokenInfoToggle';

describe('useTokenInfoMode', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to compact and cycles compact -> off -> full -> compact', () => {
    const { result } = renderHook(() => useTokenInfoMode('test-key'));
    expect(result.current[0]).toBe('compact');
    act(() => result.current[1]());
    expect(result.current[0]).toBe('off');
    expect(localStorage.getItem('test-key')).toBe('off');
    act(() => result.current[1]());
    expect(result.current[0]).toBe('full');
    expect(localStorage.getItem('test-key')).toBe('full');
    act(() => result.current[1]());
    expect(result.current[0]).toBe('compact');
    expect(localStorage.getItem('test-key')).toBe('compact');
  });

  it('migrates legacy boolean strings to modes', () => {
    localStorage.setItem('test-key', 'false');
    const offResult = renderHook(() => useTokenInfoMode('test-key'));
    expect(offResult.result.current[0]).toBe('off');

    localStorage.setItem('test-key-2', 'true');
    const onResult = renderHook(() => useTokenInfoMode('test-key-2'));
    expect(onResult.result.current[0]).toBe('full');
  });

  it('passes already-valid mode strings through unchanged', () => {
    localStorage.setItem('test-key', 'compact');
    const { result } = renderHook(() => useTokenInfoMode('test-key'));
    expect(result.current[0]).toBe('compact');
  });

  it('falls back to compact for corrupt/unknown stored values', () => {
    localStorage.setItem('test-key', 'garbage');
    const { result } = renderHook(() => useTokenInfoMode('test-key'));
    expect(result.current[0]).toBe('compact');
  });
});
