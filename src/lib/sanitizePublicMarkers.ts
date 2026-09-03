/**
 * Server-side sanitizer for `PublicMarkerDetail[]` payloads arriving over the
 * wire — the battle-map marker route's PUT body, and (locations route) a
 * location sync payload's `markers`. This is a SECOND, independent boundary
 * from `buildPublicMarkerDetails` (§6.4): that function builds the public
 * projection from trusted server-side `MarkerDetail` records, while this one
 * re-validates whatever an HTTP client claims is already a public marker
 * before it is trusted enough to store or forward.
 *
 * Both functions share the same discipline: every field is picked
 * EXPLICITLY (`{ id, title, body, ... }`), never spread (`{ ...raw }`) and
 * never the caller's object itself. A field a client smuggles in — `portal`,
 * `dmNotes`, or anything not named below — is structurally unreachable, not
 * merely filtered out by a denylist that could go stale.
 */

import type {
  MarkerLootLedgerEntry,
  MarkerStatus,
  PublicMarkerDetail,
} from '@/types/battlemap';

export const STATUSES = new Set<MarkerStatus>([
  'closed',
  'open',
  'locked',
  'armed',
  'triggered',
  'disarmed',
  'available',
  'claimed',
  'active',
  'defeated',
  'hidden',
  'revealed',
  'resolved',
]);

/**
 * Validates and re-projects an untrusted value into `PublicMarkerDetail[]`,
 * or `null` if the shape is invalid. Only `{ id, title, body, status?,
 * loot? }` ever survives — any other field on an input marker (including
 * `portal`, `dmNotes`, or an unknown future private key) is dropped by
 * construction, since the result is built field-by-field rather than by
 * spreading the input.
 */
export function sanitizePublicMarkers(
  value: unknown
): PublicMarkerDetail[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const result: PublicMarkerDetail[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const marker = raw as Record<string, unknown>;
    if (
      typeof marker.id !== 'string' ||
      marker.id.length === 0 ||
      marker.id.length > 200 ||
      typeof marker.title !== 'string' ||
      marker.title.length > 20_000 ||
      typeof marker.body !== 'string' ||
      marker.body.length > 100_000 ||
      (marker.status !== undefined &&
        !STATUSES.has(marker.status as MarkerStatus))
    )
      return null;
    result.push({
      id: marker.id,
      title: marker.title,
      body: marker.body,
      ...(marker.status === undefined
        ? {}
        : { status: marker.status as MarkerStatus }),
      ...(Array.isArray(marker.loot)
        ? {
            loot: marker.loot.flatMap(item => {
              if (!item || typeof item !== 'object') return [];
              const entry = item as Record<string, unknown>;
              if (
                typeof entry.id !== 'string' ||
                typeof entry.name !== 'string' ||
                (entry.itemKind !== 'inventory' &&
                  entry.itemKind !== 'magic') ||
                !Number.isInteger(entry.quantity) ||
                !Number.isInteger(entry.remainingQuantity)
              )
                return [];
              return [
                {
                  id: entry.id,
                  name: entry.name,
                  itemKind: entry.itemKind,
                  quantity: entry.quantity as number,
                  remainingQuantity: entry.remainingQuantity as number,
                  ...(typeof entry.description === 'string'
                    ? { description: entry.description }
                    : {}),
                  ...(typeof entry.rarity === 'string'
                    ? { rarity: entry.rarity }
                    : {}),
                },
              ];
            }),
          }
        : {}),
    });
  }
  return result;
}

/**
 * Re-projects each marker's loot `remainingQuantity` from the canonical
 * ledger rather than trusting whatever count the caller supplied. Same
 * explicit-field-pick discipline as `sanitizePublicMarkers` — no `portal`,
 * `dmNotes`, or other private field can ride through this function either.
 */
export function applyCanonicalRemaining(
  markers: PublicMarkerDetail[],
  ledger: MarkerLootLedgerEntry[]
): PublicMarkerDetail[] {
  const remaining = new Map(
    ledger.map(entry => [
      `${entry.markerId}:${entry.id}`,
      Math.max(0, entry.quantity - entry.claimedQuantity),
    ])
  );
  return markers.map(marker => ({
    id: marker.id,
    title: marker.title,
    body: marker.body,
    ...(marker.status === undefined ? {} : { status: marker.status }),
    ...(marker.loot === undefined
      ? {}
      : {
          loot: marker.loot.map(entry => ({
            ...entry,
            remainingQuantity: remaining.get(`${marker.id}:${entry.id}`) ?? 0,
          })),
        }),
  }));
}
