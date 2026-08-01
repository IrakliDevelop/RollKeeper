import { describe, it, expect, beforeEach } from 'vitest';

import {
  characterEnvelopeKey,
  armCanonicalPersistence,
  readCharacterEnvelope,
  pickFresherCharacter,
  createPerCharacterStorage,
} from '@/lib/characterCanonicalStorage';
import { STORAGE_KEY } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const char = (id: string, revision: number, extra: object = {}) =>
  ({ id, revision, name: `c-${id}`, ...extra }) as unknown as CharacterState;

const persistJson = (character: object, intentWatermarks: object = {}) =>
  JSON.stringify({ state: { character, intentWatermarks }, version: 0 });

beforeEach(() => {
  window.localStorage.clear();
  armCanonicalPersistence('');
});

describe('readCharacterEnvelope', () => {
  it('reads the per-character envelope', () => {
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 3), { t1: { seq: 2, lastSeen: 1 } })
    );
    const env = readCharacterEnvelope('a');
    expect(env?.character.revision).toBe(3);
    expect(env?.intentWatermarks).toEqual({ t1: { seq: 2, lastSeen: 1 } });
  });

  it('falls back to the legacy slot only when the id matches', () => {
    window.localStorage.setItem(STORAGE_KEY, persistJson(char('a', 5)));
    expect(readCharacterEnvelope('a')?.character.revision).toBe(5);
    expect(readCharacterEnvelope('b')).toBeNull();
  });

  it('prefers the envelope over the legacy slot', () => {
    window.localStorage.setItem(STORAGE_KEY, persistJson(char('a', 9)));
    window.localStorage.setItem(
      characterEnvelopeKey('a'),
      persistJson(char('a', 2))
    );
    expect(readCharacterEnvelope('a')?.character.revision).toBe(2);
  });
});

describe('pickFresherCharacter', () => {
  it('arbitrates by freshness, envelope wins ties', () => {
    const env = {
      character: char('a', 3),
      intentWatermarks: {},
    };
    expect(pickFresherCharacter(env, char('a', 4))?.revision).toBe(4);
    expect(pickFresherCharacter(env, char('a', 3))?.revision).toBe(3); // tie → envelope
    expect(pickFresherCharacter(env, char('a', 2))).toBe(env.character);
    expect(pickFresherCharacter(null, char('a', 1))?.id).toBe('a');
    expect(pickFresherCharacter(env, null)).toBe(env.character);
  });
});

describe('createPerCharacterStorage', () => {
  it('getItem always null (boot empty); removeItem is a no-op', () => {
    const storage = createPerCharacterStorage();
    expect(storage.getItem('whatever')).toBeNull();
    storage.removeItem('whatever');
  });

  it('setItem writes to the armed character key only', () => {
    const storage = createPerCharacterStorage();
    storage.setItem('ignored-name', persistJson(char('a', 1)));
    expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toBeNull();

    armCanonicalPersistence('a');
    storage.setItem('ignored-name', persistJson(char('a', 1)));
    expect(window.localStorage.getItem(characterEnvelopeKey('a'))).toContain(
      '"revision":1'
    );

    // Boot default / other character never writes while 'a' is armed.
    storage.setItem('ignored-name', persistJson(char('boot-default', 0)));
    expect(
      window.localStorage.getItem(characterEnvelopeKey('boot-default'))
    ).toBeNull();
  });

  it('A and B envelopes are independent', () => {
    const storage = createPerCharacterStorage();
    armCanonicalPersistence('a');
    storage.setItem('n', persistJson(char('a', 1)));
    armCanonicalPersistence('b');
    storage.setItem('n', persistJson(char('b', 7)));
    expect(readCharacterEnvelope('a')?.character.revision).toBe(1);
    expect(readCharacterEnvelope('b')?.character.revision).toBe(7);
  });
});
