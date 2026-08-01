import type { StateStorage } from 'zustand/middleware';

import { isStrictlyFresher } from '@/lib/characterFreshness';
import { CHARACTER_ENVELOPE_KEY_PREFIX, STORAGE_KEY } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

export interface IntentWatermark {
  seq: number;
  lastSeen: number;
}

export interface CharacterEnvelope {
  character: CharacterState;
  intentWatermarks: Record<string, IntentWatermark>;
}

export const characterEnvelopeKey = (characterId: string): string =>
  `${CHARACTER_ENVELOPE_KEY_PREFIX}${characterId}`;

/** The boot-default character carries a random generated id; without a
 * guard, every UI-flag set would persist junk envelopes under that id.
 * Persistence is armed by the explicit load paths (loadCharacterState /
 * loadCharacter / importCharacter / resetCharacter) with the id they load. */
let armedCharacterId = '';
export function armCanonicalPersistence(characterId: string): void {
  armedCharacterId = characterId;
}

interface PersistedShape {
  state?: {
    character?: CharacterState;
    intentWatermarks?: Record<string, IntentWatermark>;
  };
  version?: number;
}

function parseEnvelope(raw: string | null): CharacterEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedShape | null;
    const character = parsed?.state?.character;
    if (!character || typeof character.id !== 'string') return null;
    return {
      character,
      intentWatermarks: parsed?.state?.intentWatermarks ?? {},
    };
  } catch {
    return null;
  }
}

/** Canonical read for one character: per-character envelope, falling back
 * to the legacy single-slot key when it holds the SAME character
 * (read-only migration — the legacy key is never written here). */
export function readCharacterEnvelope(
  characterId: string
): CharacterEnvelope | null {
  if (typeof window === 'undefined' || !characterId) return null;
  const envelope = parseEnvelope(
    window.localStorage.getItem(characterEnvelopeKey(characterId))
  );
  if (envelope) return envelope;
  const legacy = parseEnvelope(window.localStorage.getItem(STORAGE_KEY));
  return legacy && legacy.character.id === characterId ? legacy : null;
}

/** Load-time arbitration between the canonical envelope and the roster
 * entry: strictly fresher wins; ties go to the envelope (canonical). */
export function pickFresherCharacter(
  envelope: CharacterEnvelope | null,
  rosterCharacter: CharacterState | null | undefined
): CharacterState | null {
  if (!envelope) return rosterCharacter ?? null;
  if (!rosterCharacter) return envelope.character;
  return isStrictlyFresher(rosterCharacter, envelope.character)
    ? rosterCharacter
    : envelope.character;
}

/** zustand persist storage adapter. getItem returns null — the store boots
 * empty and hydrates through the explicit load-by-id flow. setItem derives
 * the per-character key from the serialized state and writes only while
 * that character id is armed. */
export function createPerCharacterStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: (_name, value) => {
      if (typeof window === 'undefined') return;
      let id: string | undefined;
      try {
        id = (JSON.parse(value) as PersistedShape)?.state?.character?.id;
      } catch {
        return;
      }
      if (!id || id !== armedCharacterId) return;
      window.localStorage.setItem(characterEnvelopeKey(id), value);
    },
    removeItem: () => {},
  };
}
