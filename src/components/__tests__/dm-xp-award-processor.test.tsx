import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDmXpAwardProcessor } from '@/hooks/useDmXpAwardProcessor';
import type { DmXpAward, DmXpAwardEnvelope } from '@/types/sharedState';

function makeEnvelope(
  id: string,
  overrides: Partial<DmXpAward> = {}
): DmXpAwardEnvelope {
  const award: DmXpAward = {
    id,
    mode: 'add',
    amount: 100,
    awardedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
  return { award, receipt: JSON.stringify(award) };
}

describe('useDmXpAwardProcessor', () => {
  it('applies awards in order, acks each, and notifies applied ones', async () => {
    const calls: string[] = [];
    const applyDmXpAward = vi.fn((award: DmXpAward) => {
      calls.push(`apply:${award.id}`);
      return { status: 'applied' as const, becamePending: award.id === 'b' };
    });
    const acknowledgeXpAward = vi.fn(async (receipt: string) => {
      calls.push(`ack:${(JSON.parse(receipt) as DmXpAward).id}`);
    });
    const onApplied = vi.fn();

    renderHook(() =>
      useDmXpAwardProcessor({
        xpAwards: [
          makeEnvelope('a', { mode: 'set', amount: 900 }),
          makeEnvelope('b'),
        ],
        applyDmXpAward,
        acknowledgeXpAward,
        onApplied,
      })
    );

    await waitFor(() => expect(acknowledgeXpAward).toHaveBeenCalledTimes(2));
    expect(calls).toEqual(['apply:a', 'ack:a', 'apply:b', 'ack:b']);
    expect(onApplied).toHaveBeenCalledTimes(2);
    expect(onApplied).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'a' }),
      false
    );
    expect(onApplied).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'b' }),
      true
    );
  });

  it('duplicate awards ack silently without notifying', async () => {
    const applyDmXpAward = vi.fn(() => ({
      status: 'duplicate' as const,
      becamePending: false,
    }));
    const acknowledgeXpAward = vi.fn(async () => {});
    const onApplied = vi.fn();

    renderHook(() =>
      useDmXpAwardProcessor({
        xpAwards: [makeEnvelope('dup')],
        applyDmXpAward,
        acknowledgeXpAward,
        onApplied,
      })
    );

    await waitFor(() => expect(acknowledgeXpAward).toHaveBeenCalledTimes(1));
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('stops the cycle when an ack fails; earlier awards stay processed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const applyDmXpAward = vi.fn(() => ({
      status: 'applied' as const,
      becamePending: false,
    }));
    const acknowledgeXpAward = vi.fn(async (_receipt: string) => {});
    acknowledgeXpAward
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'));
    const onApplied = vi.fn();

    renderHook(() =>
      useDmXpAwardProcessor({
        xpAwards: [makeEnvelope('a'), makeEnvelope('b'), makeEnvelope('c')],
        applyDmXpAward,
        acknowledgeXpAward,
        onApplied,
      })
    );

    await waitFor(() => expect(acknowledgeXpAward).toHaveBeenCalledTimes(2));
    // 'c' is never attempted this cycle
    expect(applyDmXpAward).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('single-flight: a re-render with the same pending list does not double-process', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const applyDmXpAward = vi.fn(() => ({
      status: 'applied' as const,
      becamePending: false,
    }));
    const acknowledgeXpAward = vi.fn(async () => {
      await gate;
    });
    const onApplied = vi.fn();
    const xpAwards = [makeEnvelope('slow')];

    const { rerender } = renderHook(props => useDmXpAwardProcessor(props), {
      initialProps: {
        xpAwards,
        applyDmXpAward,
        acknowledgeXpAward,
        onApplied,
      },
    });
    // Second effect run while the first is still awaiting the ack
    rerender({
      xpAwards: [...xpAwards],
      applyDmXpAward,
      acknowledgeXpAward,
      onApplied,
    });
    release();
    await waitFor(() => expect(acknowledgeXpAward).toHaveBeenCalledTimes(1));
    expect(applyDmXpAward).toHaveBeenCalledTimes(1);
  });

  it('onApplied fires before ack, so ack failure does not prevent notification', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const applyDmXpAward = vi.fn(() => ({
      status: 'applied' as const,
      becamePending: false,
    }));
    const acknowledgeXpAward = vi.fn(async () => {
      throw new Error('network error');
    });
    const onApplied = vi.fn();

    renderHook(() =>
      useDmXpAwardProcessor({
        xpAwards: [makeEnvelope('a')],
        applyDmXpAward,
        acknowledgeXpAward,
        onApplied,
      })
    );

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    // onApplied fires for the applied award even though ack failed
    expect(onApplied).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'a' }),
      false
    );
    // ack was attempted and failed
    expect(acknowledgeXpAward).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
