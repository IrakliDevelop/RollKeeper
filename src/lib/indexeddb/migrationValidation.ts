import type { LegacySnapshot } from '@/lib/indexeddb/migrationCapture';

const CURRENT_PERSISTENCE_VERSIONS: Readonly<Record<string, number>> = {
  'rollkeeper-character': 0,
  'rollkeeper-player-data': 1,
  'rollkeeper-dm-data': 1,
  'rollkeeper-encounter-data': 2,
  'rollkeeper-npc-data': 4,
  'rollkeeper-calendar-data': 3,
  'rollkeeper-location-data': 0,
  'rollkeeper-battlemap-data': 0,
  // Slice 11F re-keyed the combat log store to `COMBAT_LOG_ARCHIVE_PERSIST_VERSION`.
  'rollkeeper-combat-log': 2,
  'rollkeeper-dm-magic-item-library': 1,
};

type QuarantineReason =
  | 'malformed-json'
  | 'future-version'
  | 'invalid-envelope'
  | 'semantic-integrity'
  | 'reference-integrity';

export type LegacyValidation =
  | {
      status: 'valid';
      rawValue: string;
      parsed: Record<string, unknown>;
      persistenceVersion: number;
    }
  | { status: 'retained-only'; rawValue: string }
  | {
      status: 'quarantined';
      rawValue: string;
      reason: QuarantineReason;
      detail: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function supportedVersion(key: string): number | null {
  if (key.startsWith('rollkeeper-character:')) return 0;
  return CURRENT_PERSISTENCE_VERSIONS[key] ?? null;
}

function quarantine(
  rawValue: string,
  reason: QuarantineReason,
  detail: string
): LegacyValidation {
  return { status: 'quarantined', rawValue, reason, detail };
}

function validatePlayerReferences(
  rawValue: string,
  state: Record<string, unknown>
): LegacyValidation | null {
  if (!Array.isArray(state.characters)) return null;
  const ids = new Set<string>();
  for (const candidate of state.characters) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') {
      return quarantine(
        rawValue,
        'semantic-integrity',
        'Character roster entry is incomplete'
      );
    }
    if (ids.has(candidate.id)) {
      return quarantine(
        rawValue,
        'semantic-integrity',
        'Duplicate character ID'
      );
    }
    ids.add(candidate.id);
    if (
      isRecord(candidate.characterData) &&
      typeof candidate.characterData.id === 'string' &&
      candidate.characterData.id !== candidate.id
    ) {
      return quarantine(
        rawValue,
        'reference-integrity',
        'Roster and character payload IDs differ'
      );
    }
    if (!isPlayableRosterCharacter(candidate)) {
      return quarantine(
        rawValue,
        'semantic-integrity',
        'Character roster entry is incomplete'
      );
    }
  }
  return null;
}

function isPlayableRosterCharacter(
  candidate: Record<string, unknown>
): boolean {
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.race === 'string' &&
    typeof candidate.class === 'string' &&
    typeof candidate.level === 'number' &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every(tag => typeof tag === 'string') &&
    candidate.createdAt != null &&
    candidate.lastPlayed != null
  );
}

export function validateLegacyEnvelope(
  key: string,
  rawValue: string
): LegacyValidation {
  const maximum = supportedVersion(key);
  if (
    maximum === null &&
    !key.startsWith('location-canvas-') &&
    !key.startsWith('battlemap-canvas-')
  ) {
    return { status: 'retained-only', rawValue };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return quarantine(rawValue, 'malformed-json', 'Value is not valid JSON');
  }
  const isCanvas =
    key.startsWith('location-canvas-') || key.startsWith('battlemap-canvas-');
  if (isCanvas && isRecord(parsed)) {
    return {
      status: 'valid',
      rawValue,
      parsed,
      persistenceVersion: 0,
    };
  }
  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    return quarantine(
      rawValue,
      'invalid-envelope',
      'Missing Zustand state envelope'
    );
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (maximum !== null && persistenceVersion > maximum) {
    return quarantine(
      rawValue,
      'future-version',
      `Persistence version ${persistenceVersion} exceeds ${maximum}`
    );
  }
  if (key === 'rollkeeper-player-data') {
    const invalid = validatePlayerReferences(rawValue, parsed.state);
    if (invalid) return invalid;
  }
  if (key.startsWith('rollkeeper-character:')) {
    const id = key.slice('rollkeeper-character:'.length);
    const character = parsed.state.character;
    if (!isRecord(character) || typeof character.id !== 'string') {
      return quarantine(
        rawValue,
        'semantic-integrity',
        'Character envelope payload is incomplete'
      );
    }
    if (character.id !== id) {
      return quarantine(
        rawValue,
        'reference-integrity',
        'Envelope key and character ID differ'
      );
    }
  }
  return {
    status: 'valid',
    rawValue,
    parsed,
    persistenceVersion,
  };
}

export function transformCapturedSnapshot(
  snapshot: LegacySnapshot,
  namespace: 'guest' | `user:${string}`
) {
  const validation = snapshot.rawValue
    ? validateLegacyEnvelope(snapshot.key, snapshot.rawValue)
    : null;
  return {
    namespace,
    generation: snapshot.runId,
    key: snapshot.key,
    presence: snapshot.presence,
    rawValue: snapshot.rawValue,
    parsed:
      validation?.status === 'valid'
        ? structuredClone(validation.parsed)
        : undefined,
    sourceSha256: snapshot.sha256,
    sourceCaptureNumber: snapshot.captureNumber,
  };
}
