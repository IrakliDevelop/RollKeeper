import { describe, expect, it, vi } from 'vitest';

import { TableAccessBatcher } from './authority-access.js';

const claim = {
  v: 1,
  campaign: 'ABC123',
  resourceKind: 'scene',
  sceneId: 'scene-a',
  room: '123e4567-e89b-42d3-a456-426614174000',
  epoch: '223e4567-e89b-42d3-a456-426614174000',
  role: 'player',
  playerPrincipal: 'player-a',
  roomGeneration: '323e4567-e89b-42d3-a456-426614174000',
} as const;

describe('TableAccessBatcher', () => {
  it('freezes one campaign batch and does not reuse its answer', async () => {
    const evalRedis = vi
      .fn()
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([1]);
    const batcher = new TableAccessBatcher({ eval: evalRedis }, 0);
    const first = batcher.authorizeClaim(claim, Date.now() + 1_000);
    const second = batcher.authorizeClaim(
      { ...claim, sceneId: 'scene-b' },
      Date.now() + 1_000
    );
    expect(await Promise.all([first, second])).toEqual([true, false]);
    expect(evalRedis).toHaveBeenCalledTimes(1);
    expect(await batcher.authorizeClaim(claim, Date.now() + 1_000)).toBe(true);
    expect(evalRedis).toHaveBeenCalledTimes(2);
  });

  it('fails closed on expiry and Redis errors while leaving legacy unguarded', async () => {
    const evalRedis = vi.fn().mockRejectedValue(new Error('offline'));
    const batcher = new TableAccessBatcher({ eval: evalRedis }, 0);
    expect(await batcher.authorizeClaim(undefined)).toBe(true);
    expect(await batcher.authorizeClaim(claim, Date.now() - 1)).toBe(false);
    expect(await batcher.authorizeClaim(claim, Date.now() + 1_000)).toBe(false);
  });

  it('fails a delayed control read closed after one second', async () => {
    vi.useFakeTimers();
    try {
      const evalRedis = vi.fn(
        () =>
          new Promise<unknown>(resolve => setTimeout(() => resolve([1]), 5_000))
      );
      const batcher = new TableAccessBatcher({ eval: evalRedis }, 0);
      let answer: boolean | undefined;
      void batcher
        .authorizeClaim(claim, Date.now() + 10_000)
        .then(value => (answer = value));
      await vi.advanceTimersByTimeAsync(999);
      expect(answer).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(answer).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors the frame deadline and abort signal before the one-second cap', async () => {
    vi.useFakeTimers();
    try {
      const evalRedis = vi.fn(() => new Promise<unknown>(() => {}));
      const batcher = new TableAccessBatcher({ eval: evalRedis }, 0);
      let deadlineAnswer: boolean | undefined;
      void batcher
        .authorizeFrame({
          authContext: claim,
          expiresAt: Date.now() + 10_000,
          deadlineAt: Date.now() + 40,
          signal: new AbortController().signal,
        } as never)
        .then(value => (deadlineAnswer = value));
      await vi.advanceTimersByTimeAsync(39);
      expect(deadlineAnswer).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(deadlineAnswer).toBe(false);

      const controller = new AbortController();
      let abortAnswer: boolean | undefined;
      void batcher
        .authorizeFrame({
          authContext: claim,
          expiresAt: Date.now() + 10_000,
          deadlineAt: Date.now() + 5_000,
          signal: controller.signal,
        } as never)
        .then(value => (abortAnswer = value));
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);
      expect(abortAnswer).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
