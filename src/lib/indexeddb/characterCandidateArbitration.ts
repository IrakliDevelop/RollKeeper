import type { IntentWatermark } from '@/lib/characterCanonicalStorage';

export type CandidateDisposition =
  | 'valid'
  | 'malformed'
  | 'corrupt'
  | 'future-schema'
  | 'unsupported'
  | 'quarantined';

export interface CharacterCandidate {
  candidateId: string;
  sourceKey: string;
  declaredId: string;
  payload: unknown;
  rawValue: string;
  revision: number;
  lastMutatedAt: number;
  lastMutatedBy: string;
  intentWatermarks: Record<string, IntentWatermark>;
  disposition?: CandidateDisposition;
}

export interface CharacterCandidateConflict {
  kind: 'equal-stamp-divergence' | 'id-mismatch';
  characterId: string;
  candidateIds: string[];
}

export interface CharacterArbitrationResult {
  active: Map<string, CharacterCandidate>;
  candidates: Map<string, CharacterCandidate[]>;
  conflicts: CharacterCandidateConflict[];
  blocked: CharacterCandidate[];
  watermarks: Map<string, Record<string, IntentWatermark>>;
}

function payloadId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function compareStamp(
  left: CharacterCandidate,
  right: CharacterCandidate
): number {
  return (
    left.revision - right.revision ||
    left.lastMutatedAt - right.lastMutatedAt ||
    left.lastMutatedBy.localeCompare(right.lastMutatedBy)
  );
}

function sameStamp(
  left: CharacterCandidate,
  right: CharacterCandidate
): boolean {
  return compareStamp(left, right) === 0;
}

function mergeCandidateWatermarks(
  candidates: readonly CharacterCandidate[]
): Record<string, IntentWatermark> {
  const merged: Record<string, IntentWatermark> = {};
  for (const candidate of candidates) {
    for (const [tabId, mark] of Object.entries(candidate.intentWatermarks)) {
      const current = merged[tabId];
      merged[tabId] = current
        ? {
            seq: Math.max(current.seq, mark.seq),
            lastSeen: Math.max(current.lastSeen, mark.lastSeen),
          }
        : { ...mark };
    }
  }
  return merged;
}

export function arbitrateCharacterCandidates(
  input: readonly CharacterCandidate[]
): CharacterArbitrationResult {
  const candidates = new Map<string, CharacterCandidate[]>();
  for (const candidate of input) {
    const group = candidates.get(candidate.declaredId) ?? [];
    group.push(structuredClone(candidate));
    candidates.set(candidate.declaredId, group);
  }

  const active = new Map<string, CharacterCandidate>();
  const conflicts: CharacterCandidateConflict[] = [];
  const blocked: CharacterCandidate[] = [];
  const watermarks = new Map<string, Record<string, IntentWatermark>>();

  for (const [characterId, group] of candidates) {
    group.sort((left, right) =>
      left.candidateId.localeCompare(right.candidateId)
    );
    watermarks.set(characterId, mergeCandidateWatermarks(group));

    const invalid = group.filter(
      candidate => (candidate.disposition ?? 'valid') !== 'valid'
    );
    blocked.push(...invalid);
    const mismatches = group.filter(
      candidate => payloadId(candidate.payload) !== candidate.declaredId
    );
    if (mismatches.length > 0) {
      conflicts.push({
        kind: 'id-mismatch',
        characterId,
        candidateIds: mismatches.map(candidate => candidate.candidateId),
      });
    }
    if (invalid.length > 0 || mismatches.length > 0) continue;

    const ordered = [...group].sort((left, right) => {
      const stamp = compareStamp(right, left);
      return stamp || left.candidateId.localeCompare(right.candidateId);
    });
    const newest = ordered[0];
    const equalNewest = ordered.filter(candidate =>
      sameStamp(candidate, newest)
    );
    if (new Set(equalNewest.map(candidate => candidate.rawValue)).size > 1) {
      conflicts.push({
        kind: 'equal-stamp-divergence',
        characterId,
        candidateIds: equalNewest.map(candidate => candidate.candidateId),
      });
      continue;
    }
    active.set(characterId, newest);
  }

  return { active, candidates, conflicts, blocked, watermarks };
}
