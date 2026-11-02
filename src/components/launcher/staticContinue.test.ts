import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONTINUE_SLOT_ID,
  CONTINUE_TEMPLATE_ID,
  pickLastCharacter,
  staticContinueScript,
} from './staticContinue';

const stored = (characters: unknown[]) =>
  JSON.stringify({ state: { characters }, version: 1 });

describe('pickLastCharacter', () => {
  it('picks the most recently played character that is not archived', () => {
    const raw = stored([
      {
        id: 'a',
        name: 'Asteroth Nightveil',
        lastPlayed: '2026-10-01T00:00:00Z',
      },
      { id: 'e', name: 'Eric Ravenshaw', lastPlayed: '2026-10-20T00:00:00Z' },
      {
        id: 'o',
        name: 'Odette Clermont',
        lastPlayed: '2026-10-30T00:00:00Z',
        isArchived: true,
      },
    ]);
    expect(pickLastCharacter(raw)).toEqual({ id: 'e', name: 'Eric Ravenshaw' });
  });

  it('returns null for missing, empty or malformed data', () => {
    expect(pickLastCharacter(null)).toBeNull();
    expect(pickLastCharacter(stored([]))).toBeNull();
    expect(pickLastCharacter('{not json')).toBeNull();
    expect(pickLastCharacter(JSON.stringify({ state: {} }))).toBeNull();
    expect(pickLastCharacter(stored([{ id: 3, name: null }]))).toBeNull();
  });
});

describe('staticContinueScript', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <header><span id="${CONTINUE_SLOT_ID}" hidden></span></header>
      <template id="${CONTINUE_TEMPLATE_ID}"><a class="btn" href="/player">Open 's sheet</a></template>`;
  });
  afterEach(() => localStorage.clear());

  const run = () => new Function(staticContinueScript)();

  it('replaces the placeholder with a link to the last character', () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      stored([{ id: 'c 1', name: 'Eric Ravenshaw', lastPlayed: '2026-10-20' }])
    );
    run();
    const link = document.querySelector('header a');
    expect(link).toHaveAttribute('href', '/player/characters/c%201');
    expect(link).toHaveTextContent("Open Eric Ravenshaw's sheet");
    expect(link).toHaveClass('btn');
    expect(document.getElementById(CONTINUE_SLOT_ID)).toBeNull();
  });

  it('leaves the placeholder hidden with no characters', () => {
    run();
    expect(document.querySelector('header a')).toBeNull();
    expect(document.getElementById(CONTINUE_SLOT_ID)).toHaveAttribute('hidden');
  });

  it('leaves the link out on a device that moved characters to IndexedDB', () => {
    localStorage.setItem(
      'rollkeeper-player-data',
      stored([{ id: 'e', name: 'Eric Ravenshaw', lastPlayed: '2026-10-20' }])
    );
    localStorage.setItem(
      'rollkeeper:indexeddb-selection:guest:character',
      '{}'
    );
    run();
    expect(document.querySelector('header a')).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      expect(run).not.toThrow();
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });
});
