import { describe, expect, it, vi } from 'vitest';

import { AutomaticCharacterSyncCoordinator } from './automaticCharacterSyncCoordinator';

describe('AutomaticCharacterSyncCoordinator', () => {
  it('does not start worker or pull activity for a non-participating account', async () => {
    const runOnce = vi.fn();
    const pull = vi.fn();
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => false,
      runOnce,
      pull,
      events: new EventTarget(),
    });

    await coordinator.start();
    expect(runOnce).not.toHaveBeenCalled();
    expect(pull).not.toHaveBeenCalled();
  });

  it('pulls at startup, focus, reconnect, manual refresh, successful push, and invalidation', async () => {
    const events = new EventTarget();
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce('synced')
      .mockResolvedValue('idle');
    const pull = vi.fn().mockResolvedValue(undefined);
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull,
      events,
    });

    await coordinator.start();
    events.dispatchEvent(new Event('focus'));
    events.dispatchEvent(new Event('online'));
    events.dispatchEvent(new Event('automatic-sync-invalidation'));
    await coordinator.manualRefresh();
    await coordinator.settle();

    expect(pull.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining([
        'startup',
        'successful-push',
        'focus',
        'reconnect',
        'invalidation',
        'manual-refresh',
      ])
    );
  });

  it('discovers durable work without BroadcastChannel and retries after writer failover', async () => {
    const runOnce = vi
      .fn()
      .mockRejectedValueOnce(new Error('writer closed'))
      .mockResolvedValueOnce('synced')
      .mockResolvedValue('idle');
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull: vi.fn(),
      events: new EventTarget(),
      broadcastChannel: null,
    });

    await coordinator.start();
    await coordinator.wake();
    await coordinator.settle();
    expect(runOnce).toHaveBeenCalledTimes(3);
  });

  it('stops all activity on account switch and leaves durable work untouched', async () => {
    const events = new EventTarget();
    const runOnce = vi.fn().mockResolvedValue('idle');
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull: vi.fn(),
      events,
    });
    await coordinator.start();
    const calls = runOnce.mock.calls.length;
    coordinator.stop();
    events.dispatchEvent(new Event('online'));
    await coordinator.settle();
    expect(runOnce).toHaveBeenCalledTimes(calls);
  });

  it('is inert while disabled or stopped and ignores duplicate starts', async () => {
    const runOnce = vi.fn().mockResolvedValue('idle');
    const pull = vi.fn();
    const disabled = new AutomaticCharacterSyncCoordinator({
      featureEnabled: false,
      hasParticipants: async () => true,
      runOnce,
      pull,
      events: new EventTarget(),
    });
    await disabled.start();
    await disabled.wake();
    await disabled.manualRefresh();
    disabled.stop();
    expect(runOnce).not.toHaveBeenCalled();
    expect(pull).not.toHaveBeenCalled();

    const active = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull,
      events: new EventTarget(),
    });
    await active.start();
    await active.start();
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('uses BroadcastChannel only as a wake signal and closes it on stop', async () => {
    let listener: (() => void) | undefined;
    const channel = {
      addEventListener: vi.fn((_type: 'message', next: () => void) => {
        listener = next;
      }),
      removeEventListener: vi.fn(),
      close: vi.fn(),
    };
    const runOnce = vi.fn().mockResolvedValue('idle');
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull: vi.fn(),
      events: new EventTarget(),
      broadcastChannel: channel,
    });
    await coordinator.start();
    listener?.();
    await vi.waitFor(() => expect(runOnce).toHaveBeenCalledTimes(2));
    await coordinator.settle();
    coordinator.stop();
    expect(channel.removeEventListener).toHaveBeenCalledOnce();
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it('continues past one conflicted aggregate and stops on non-runnable outcomes', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce('conflict')
      .mockResolvedValueOnce('failed');
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants: async () => true,
      runOnce,
      pull: vi.fn(),
      events: new EventTarget(),
    });
    await coordinator.start();
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it('rechecks participation before event-driven pulls and manual refresh', async () => {
    const events = new EventTarget();
    const pull = vi.fn();
    const hasParticipants = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(false);
    const coordinator = new AutomaticCharacterSyncCoordinator({
      featureEnabled: true,
      hasParticipants,
      runOnce: vi.fn(),
      pull,
      events,
    });
    await coordinator.start();
    events.dispatchEvent(new Event('focus'));
    await coordinator.manualRefresh();
    await coordinator.settle();
    expect(pull).not.toHaveBeenCalled();
  });
});
