import { createHash } from 'node:crypto';

const CAMPAIGN_CODE = /^[A-Za-z0-9_-]{1,64}$/u;
const ROOM_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CHALLENGE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function tableCampaignTag(code: string): string {
  if (!CAMPAIGN_CODE.test(code)) throw new Error('Invalid campaign code');
  const digest = createHash('sha256')
    .update(Buffer.from(code, 'utf8'))
    .digest('hex');
  return `{rk-table-v1:${digest}}`;
}

function key(code: string, suffix: string): string {
  return `campaign:${tableCampaignTag(code)}:${suffix}`;
}

export const tableControlKey = (code: string): string =>
  key(code, 'table-control');
export const tableRegistryKey = (code: string): string =>
  key(code, 'table-scenes');
export const tableAuthorityChallengeKey = (
  code: string,
  challengeId: string
): string => {
  if (!CHALLENGE_UUID.test(challengeId))
    throw new Error('Invalid challenge UUID');
  return key(code, `table-authority-challenge:${challengeId}`);
};

export interface AuthorityRoomKeys {
  fogMeta: string;
  fogTiles: string;
  meta: string;
  elements: string;
  ownership: string;
  layers: string;
  dedupe: string;
  dedupeOrder: string;
  receipts: string;
  history: string;
  evidence: string;
  outbox: string;
  outboxClaims: string;
  playerRate: string;
}

export function authorityRoomKeys(
  code: string,
  room: string
): AuthorityRoomKeys {
  if (!ROOM_UUID.test(room)) throw new Error('Invalid authority room UUID');
  const base = `room:${room}`;
  return {
    fogMeta: key(code, `${base}:fog:meta`),
    fogTiles: key(code, `${base}:fog:tiles`),
    meta: key(code, `${base}:meta`),
    elements: key(code, `${base}:elements`),
    ownership: key(code, `${base}:ownership`),
    layers: key(code, `${base}:layers`),
    dedupe: key(code, `${base}:dedupe`),
    dedupeOrder: key(code, `${base}:dedupe-order`),
    receipts: key(code, `${base}:receipts`),
    history: key(code, `${base}:history`),
    evidence: key(code, `${base}:evidence`),
    outbox: key(code, `${base}:outbox`),
    outboxClaims: key(code, `${base}:outbox-claims`),
    playerRate: key(code, `${base}:player-rate`),
  };
}

export function assertAuthorityKeyTag(
  code: string,
  keys: readonly string[]
): void {
  const tag = tableCampaignTag(code);
  if (keys.length === 0 || keys.some(value => !value.includes(tag))) {
    throw new Error(
      'Table authority keys do not share the canonical campaign tag'
    );
  }
}
