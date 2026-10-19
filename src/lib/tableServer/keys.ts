import { createHash } from 'node:crypto';

const CAMPAIGN_CODE = /^[A-Za-z0-9_-]{1,64}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type TableCompatibilityFeature =
  | 'initiative'
  | 'battlemap'
  | 'initiativeRequest';

export function tableCampaignTag(code: string): string {
  if (!CAMPAIGN_CODE.test(code)) throw new Error('Invalid campaign code');
  const digest = createHash('sha256')
    .update(Buffer.from(code, 'utf8'))
    .digest('hex');
  return `{rk-table-v1:${digest}}`;
}

function tableKey(code: string, suffix: string): string {
  return `campaign:${tableCampaignTag(code)}:${suffix}`;
}

export const tableControlKey = (code: string): string =>
  tableKey(code, 'table-control');
export const tableRegistryKey = (code: string): string =>
  tableKey(code, 'table-scenes');
export const tableLedgerKey = (code: string): string =>
  tableKey(code, 'table-operations');
export const tableLedgerOrderKey = (code: string): string =>
  tableKey(code, 'table-operations-order');
/** PR05 E1: the display session binding `{displayGeneration, nonceHash}`. */
export const tableDisplaySessionKey = (code: string): string =>
  tableKey(code, 'display-session');
/** PR05 E1: the last accepted display ACK record (EX 30). */
export const tableDisplayAckKey = (code: string): string =>
  tableKey(code, 'display-ack');
export const tableAuthorityChallengeKey = (
  code: string,
  challengeId: string
): string => {
  if (!UUID.test(challengeId)) throw new Error('Invalid challenge UUID');
  return tableKey(code, `table-authority-challenge:${challengeId}`);
};
export interface TableAuthorityRoomKeys {
  meta: string;
  elements: string;
  ownership: string;
  layers: string;
  fogMeta: string;
  fogTiles: string;
  dedupe: string;
  dedupeOrder: string;
  receipts: string;
  history: string;
  evidence: string;
  outbox: string;
  outboxClaims: string;
  playerRate: string;
}

export function tableAuthorityRoomKeys(
  code: string,
  room: string
): TableAuthorityRoomKeys {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      room
    )
  ) {
    throw new Error('Invalid authority room UUID');
  }
  const prefix = tableKey(code, `room:${room}`);
  return {
    meta: `${prefix}:meta`,
    elements: `${prefix}:elements`,
    ownership: `${prefix}:ownership`,
    layers: `${prefix}:layers`,
    fogMeta: `${prefix}:fog:meta`,
    fogTiles: `${prefix}:fog:tiles`,
    dedupe: `${prefix}:dedupe`,
    dedupeOrder: `${prefix}:dedupe-order`,
    receipts: `${prefix}:receipts`,
    history: `${prefix}:history`,
    evidence: `${prefix}:evidence`,
    outbox: `${prefix}:outbox`,
    outboxClaims: `${prefix}:outbox-claims`,
    playerRate: `${prefix}:player-rate`,
  };
}
export const tableCompatibilityKey = (
  code: string,
  feature: TableCompatibilityFeature
): string => tableKey(code, `shared:${feature}`);
