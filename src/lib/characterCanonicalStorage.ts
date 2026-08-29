import type { StateStorage } from 'zustand/middleware';

import { characterWriterLock } from '@/lib/characterWriterLock';
import { isStrictlyFresher } from '@/lib/characterFreshness';
import { createSafeStorage } from '@/lib/safeStorage';
import { isBrowserCharacterCutoverParticipant } from '@/lib/indexeddb/characterCutoverSelection';
import { createCharacterFamilyStateStorage } from '@/lib/indexeddb/characterPersistenceRuntime';
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

/** Merges two per-tab watermark maps, envelope-dominant: the envelope was
 * just read synchronously (e.g. at leader promotion) and can only be as
 * fresh or fresher than in-memory state for any tab whose watermark it
 * carries, since followers only ever adopt watermarks via storage-event
 * adoption gated on the character being strictly fresher. For a tabId
 * present in both maps the merged seq is the max of the two (never regress
 * dedup state) and the merged lastSeen is the max of the two timestamps.
 * A tabId present in only one map passes through unchanged. Pure — safe to
 * unit-test directly and to reuse from both onPromotedToLeader and the
 * roster-sync load path. */
export function mergeWatermarks(
  envelopeWatermarks: Record<string, IntentWatermark>,
  currentWatermarks: Record<string, IntentWatermark>
): Record<string, IntentWatermark> {
  const merged: Record<string, IntentWatermark> = { ...currentWatermarks };
  for (const [tabId, envMark] of Object.entries(envelopeWatermarks)) {
    const curMark = currentWatermarks[tabId];
    merged[tabId] = curMark
      ? {
          seq: Math.max(envMark.seq, curMark.seq),
          lastSeen: Math.max(envMark.lastSeen, curMark.lastSeen),
        }
      : envMark;
  }
  return merged;
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
 * that character id is armed AND this tab holds the writer lock for it —
 * zustand persist's setItem fires on every set/setState (cross-tab
 * adoption, UI-flag toggles, hydration flips), and a follower echoing the
 * envelope it just read/adopted would violate single-writer at the storage
 * layer (stale-state resurrection window, watermark regression). With no
 * Web Locks support, isLeader() reports every tab as leader — the reduced
 * no-locks guarantee is unchanged. */
export function createPerCharacterStorage(): StateStorage {
  const participant = isBrowserCharacterCutoverParticipant();
  const routed =
    typeof window !== 'undefined'
      ? createCharacterFamilyStateStorage({
          backing: window.localStorage,
          participant,
        })
      : null;
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
      if (!characterWriterLock.isLeader(id)) return;
      const key = characterEnvelopeKey(id);
      if (routed) return routed.setItem(key, value);
      return createSafeStorage(window.localStorage).setItem(key, value);
    },
    removeItem: () => {},
  };
}
