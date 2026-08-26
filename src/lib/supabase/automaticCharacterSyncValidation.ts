import {
  decodeCharacterCloudRow,
  type CharacterCloudRow,
  type DecodedCloudCharacter,
} from './characterCloudCodec';

export type ValidatedAutomaticCharacterCandidate =
  | { status: 'supported'; decoded: DecodedCloudCharacter }
  | { status: 'quarantined'; reason: string; rawValue: string };

export function serializeAutomaticCharacterCandidate(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, candidate: unknown) => {
      if (candidate && typeof candidate === 'object') {
        if (seen.has(candidate)) return '[Circular]';
        seen.add(candidate);
      }
      return candidate;
    });
  } catch {
    return JSON.stringify({ unavailable: true });
  }
}

export async function validateAutomaticCharacterCandidate(
  row: CharacterCloudRow,
  expectedLegacyId: string
): Promise<ValidatedAutomaticCharacterCandidate> {
  const invalidMetadata =
    typeof row.id !== 'string' ||
    !row.id ||
    row.legacy_client_id !== expectedLegacyId ||
    !Number.isInteger(row.schema_version) ||
    !Number.isInteger(row.client_revision) ||
    row.client_revision < 0 ||
    !Number.isInteger(row.server_version) ||
    row.server_version < 1 ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string' ||
    (row.deleted_at !== null && typeof row.deleted_at !== 'string');
  if (invalidMetadata) {
    return {
      status: 'quarantined',
      reason:
        'Cloud candidate identity, revision, version, or timestamps are unsafe',
      rawValue: serializeAutomaticCharacterCandidate(row),
    };
  }

  let decoded: DecodedCloudCharacter;
  try {
    decoded = await decodeCharacterCloudRow(row);
  } catch (cause) {
    return {
      status: 'quarantined',
      reason:
        cause instanceof Error
          ? cause.message
          : 'Cloud candidate could not be decoded safely',
      rawValue: serializeAutomaticCharacterCandidate(row),
    };
  }
  if (decoded.status !== 'supported' || !decoded.localCharacter) {
    return {
      status: 'quarantined',
      reason: decoded.quarantineReason ?? 'Unsafe cloud candidate',
      rawValue: serializeAutomaticCharacterCandidate(row),
    };
  }
  if (
    decoded.localCharacter.id !== expectedLegacyId ||
    decoded.localCharacter.characterData.id !== expectedLegacyId
  ) {
    return {
      status: 'quarantined',
      reason:
        'Cloud candidate payload identity does not match the selected character',
      rawValue: serializeAutomaticCharacterCandidate(row),
    };
  }
  return { status: 'supported', decoded };
}
