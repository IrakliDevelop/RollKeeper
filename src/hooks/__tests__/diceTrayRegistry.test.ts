import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiceTray } from 'pollyroll/render';
import {
  acquireDiceTray,
  applyDiceAppearance,
  getDiceTrayEntry,
  releaseDiceTray,
} from '../diceTrayRegistry';

vi.mock('pollyroll/render', () => ({
  createDiceTray: vi.fn(() => ({
    supported: true,
    dispose: vi.fn(),
    setSound: vi.fn(),
    setSkin: vi.fn(),
    setDieScale: vi.fn(),
    clear: vi.fn(),
    resize: vi.fn(),
    playRoll: vi.fn(),
  })),
}));
afterEach(() => {
  while (getDiceTrayEntry('shared-dice')) releaseDiceTray('shared-dice');
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
function target() {
  const element = document.createElement('div');
  element.id = 'shared-dice';
  document.body.appendChild(element);
}
describe('shared dice tray preferences', () => {
  it('adopts character options even when a child button created the tray first', () => {
    target();
    const first = acquireDiceTray('shared-dice', undefined, 1.35);
    const second = acquireDiceTray('shared-dice', 'oak', 1.5, {
      shadows: false,
      reducedMotion: 'always',
      labels: { dc: ['T', 'H'] },
    });
    expect(first?.dispose).toHaveBeenCalledOnce();
    expect(second).not.toBe(first);
    expect(createDiceTray).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        skin: 'oak',
        shadows: false,
        reducedMotion: 'always',
        labels: { dc: ['T', 'H'] },
      })
    );
    releaseDiceTray('shared-dice');
    expect(second?.dispose).not.toHaveBeenCalled();
    releaseDiceTray('shared-dice');
    expect(second?.dispose).toHaveBeenCalledOnce();
  });
  it('keeps the tray when only appearance or volume changes and does not let default buttons mute it', () => {
    target();
    const tray = acquireDiceTray('shared-dice', 'classic', 1.35, {
      sound: 0.5,
    });
    acquireDiceTray('shared-dice', undefined, 1.35);
    applyDiceAppearance('shared-dice', 'ruby', 1.8, { sound: 0.7 });
    applyDiceAppearance('shared-dice', undefined, undefined);
    expect(createDiceTray).toHaveBeenCalledOnce();
    expect(tray?.setSound).toHaveBeenCalledTimes(1);
    expect(tray?.setSound).toHaveBeenLastCalledWith(0.7);
    expect(tray?.setSkin).toHaveBeenCalledWith('ruby');
    expect(tray?.setDieScale).toHaveBeenCalledWith(1.8);
  });
});
