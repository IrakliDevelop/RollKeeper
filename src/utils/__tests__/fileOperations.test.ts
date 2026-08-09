import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCharacter } from './test-utils';
import { exportCharacterStateToFile } from '../fileOperations';

describe('exportCharacterStateToFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads a player-compatible character export', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'));

    const character = makeCharacter({ name: 'Recovered Hero' });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    exportCharacterStateToFile(character);

    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe('recovered_hero_2026-08-09.json');

    const encodedJson = link.href.split(',')[1];
    const exported = JSON.parse(decodeURIComponent(encodedJson));
    expect(exported).toEqual({
      version: '1.0.0',
      exportDate: '2026-08-09T12:00:00.000Z',
      character,
    });
  });
});
