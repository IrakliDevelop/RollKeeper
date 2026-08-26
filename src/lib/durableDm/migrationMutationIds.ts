export type MigrationCloudOperation =
  | 'begin-staging'
  | 'stage-items'
  | 'confirm-cutover'
  | 'rollback';

const encoder = new TextEncoder();

/** RFC 9562 requires exactly 16 bytes (128 bits) of material for a UUID. */
const UUID_BYTE_LENGTH = 16;

/**
 * A mutation ID derived from the run rather than generated per attempt.
 *
 * The server keys its mutation receipts on (actor, mutation id) and replays the
 * stored result for a repeat call, so a deterministic ID turns "the response
 * was lost" into "read the receipt again" instead of "start a second staging
 * run". The material is JSON-encoded rather than delimiter-joined, so field
 * boundaries survive any input a future caller passes.
 */
export async function migrationMutationId(input: {
  recoveryRunId: string;
  campaignId: string;
  family: string;
  manifestFingerprint: string;
  expectedEpoch: number;
  operation: MigrationCloudOperation;
}): Promise<string> {
  // JSON, not a delimiter-joined string. Relying on "a space cannot appear in
  // any of these fields" is an assumption about every present and future
  // caller; JSON.stringify escapes and length-delimits each field, so no two
  // distinct inputs can produce the same material regardless.
  const material = JSON.stringify([
    'rollkeeper-migration-mutation-v1',
    input.recoveryRunId,
    input.campaignId,
    input.family,
    input.manifestFingerprint,
    input.expectedEpoch,
    input.operation,
  ]);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(material))
  );
  const bytes = digest.slice(0, UUID_BYTE_LENGTH);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // RFC 9562 version 8: custom
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 9562 variant 10
  const hex = Array.from(bytes, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
