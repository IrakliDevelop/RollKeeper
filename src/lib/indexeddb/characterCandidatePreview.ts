import {
  arbitrateCharacterCandidates,
  type CharacterCandidate,
} from './characterCandidateArbitration';
import {
  CHARACTER_ENVELOPE_PREFIX,
  LEGACY_CHARACTER_KEY,
  PLAYER_ROSTER_KEY,
} from './characterFamily';
import { requestResult, transactionComplete } from './localDatabase';
import type { StorageNamespace } from './shadowJournal';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toCandidate(
  sourceKey: string,
  candidateId: string,
  declaredId: string,
  payload: Record<string, unknown>,
  watermarks: CharacterCandidate['intentWatermarks'] = {}
): CharacterCandidate {
  return {
    candidateId,
    sourceKey,
    declaredId,
    payload,
    rawValue: JSON.stringify(payload),
    revision: typeof payload.revision === 'number' ? payload.revision : 0,
    lastMutatedAt:
      typeof payload.lastMutatedAt === 'number' ? payload.lastMutatedAt : 0,
    lastMutatedBy:
      typeof payload.lastMutatedBy === 'string' ? payload.lastMutatedBy : '',
    intentWatermarks: watermarks,
  };
}

function candidatesFromRow(row: {
  key: string;
  rawValue: string;
}): CharacterCandidate[] {
  let parsed: Record<string, unknown> | null;
  try {
    parsed = record(JSON.parse(row.rawValue));
  } catch {
    return [];
  }
  const state = record(parsed?.state);
  if (!state) return [];
  if (
    row.key === LEGACY_CHARACTER_KEY ||
    row.key.startsWith(CHARACTER_ENVELOPE_PREFIX)
  ) {
    const character = record(state.character);
    if (!character || typeof character.id !== 'string') return [];
    const watermarks = record(state.intentWatermarks) as
      | CharacterCandidate['intentWatermarks']
      | null;
    const declaredId = row.key.startsWith(CHARACTER_ENVELOPE_PREFIX)
      ? row.key.slice(CHARACTER_ENVELOPE_PREFIX.length)
      : character.id;
    return [
      toCandidate(
        row.key,
        `${row.key}:character`,
        declaredId,
        character,
        watermarks ?? {}
      ),
    ];
  }
  if (row.key === PLAYER_ROSTER_KEY && Array.isArray(state.characters)) {
    return state.characters.flatMap((entry, index) => {
      const roster = record(entry);
      const character = record(roster?.characterData);
      if (!roster || !character || typeof roster.id !== 'string') return [];
      return [
        toCandidate(
          row.key,
          `${row.key}:characters:${index}`,
          roster.id,
          character
        ),
      ];
    });
  }
  return [];
}

export async function previewPersistedCharacterCandidates(
  database: IDBDatabase,
  namespace: StorageNamespace,
  generation: string,
  now: () => string
) {
  const read = database.transaction('kvGenerations', 'readonly');
  const rows = (await requestResult(
    read.objectStore('kvGenerations').getAll()
  )) as Array<{
    namespace: StorageNamespace;
    generation: string;
    key: string;
    rawValue?: string;
  }>;
  await transactionComplete(read);
  const candidates = rows
    .filter(
      row =>
        row.namespace === namespace &&
        row.generation === generation &&
        typeof row.rawValue === 'string'
    )
    .flatMap(row =>
      candidatesFromRow({ key: row.key, rawValue: row.rawValue! })
    );
  const result = arbitrateCharacterCandidates(candidates);
  if (result.conflicts.length > 0) {
    const transaction = database.transaction(
      ['conflicts', 'meta'],
      'readwrite'
    );
    for (const conflict of result.conflicts) {
      transaction.objectStore('conflicts').put({
        conflictId: `candidate:${namespace}:${generation}:${conflict.characterId}:${conflict.kind}`,
        ...conflict,
        namespace,
        family: 'character',
        generation,
        candidates: result.candidates.get(conflict.characterId)!,
        detectedAt: now(),
        resolutionState: 'unresolved',
      });
    }
    transaction.objectStore('meta').put({
      key: `migration-state:${namespace}:character`,
      state: 'SHADOWING',
      runId: generation,
      checkpointAt: now(),
    });
    await transactionComplete(transaction);
  }
  return result;
}
