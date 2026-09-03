/**
 * Marker portal target — the schema and untrusted-input parser for a
 * DM-authored map-to-map navigation link attached to a marker's detail
 * record (`MarkerDetail.portal`, added in a later task).
 *
 * This module owns the shape of that field and the pure logic needed to
 * turn it into a clickable DM route: `{ v, kind, id }` in, `{ href, name }`
 * out. It is pure data/logic: no React, no Zustand, no store or SDK side
 * effects, no network calls. `MarkerPortalTargetV1` is the canonical
 * declaration on `MarkerDetail` (`src/types/battlemap.ts`), imported and
 * re-exported here so existing consumers of this module keep working.
 *
 * Persisted shape is exactly `{ v, kind, id }` — no pathname, absolute URL,
 * campaign code, target name, or return URL is ever persisted. A target's
 * display name and href are recomputed live from the current campaign's
 * stores every time `resolveDmPortalDestination` runs, so a renamed
 * battle-map/location is reflected immediately without rewriting the
 * persisted target (see the "target rename" test below).
 */

import type { MarkerPortalTargetV1 } from '@/types/battlemap';

import { capCodePoints } from './markerData';

export type { MarkerPortalTargetV1 } from '@/types/battlemap';

/** Maximum id length, in Unicode code points (see `capCodePoints`). */
export const MARKER_PORTAL_ID_MAX_CODE_POINTS = 200;

export const MARKER_PORTAL_KINDS = ['battlemap', 'location'] as const;
export type MarkerPortalKind = (typeof MARKER_PORTAL_KINDS)[number];

export type MarkerPortalTargetResult =
  | { status: 'valid'; target: MarkerPortalTargetV1 }
  | { status: 'unsupported'; version?: number }
  | { status: 'invalid'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMarkerPortalKind(value: unknown): value is MarkerPortalKind {
  return (
    typeof value === 'string' &&
    (MARKER_PORTAL_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Tri-state parser for untrusted `value`: `valid` | `unsupported` | `invalid`.
 * Mirrors the structure of `parseMarkerData` in `./markerData` — call this
 * before trusting any persisted or remote portal target, since it may have
 * been written by a newer/older client or by a hostile peer.
 *
 * Unlike `parseMarkerData`'s marker `kind` (which is deliberately
 * `unsupported` for a forward-compatible future kind), an unrecognized
 * portal `kind` is `invalid`: `MarkerPortalTargetV1` has exactly two kinds
 * and no versioning story that grows the kind set within `v: 1`, so an
 * unrecognized kind on a `v: 1` record is malformed, not merely a future
 * addition — `unsupported` is reserved for `v > 1`.
 *
 * On `valid`, `target` is a freshly constructed object with exactly the
 * known keys — never the caller's object, never a spread of it.
 */
export function parseMarkerPortalTarget(
  value: unknown
): MarkerPortalTargetResult {
  if (!isRecord(value)) {
    return { status: 'invalid', reason: 'portal target is not a record' };
  }

  const { v, kind, id } = value;

  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { status: 'invalid', reason: 'portal target v is not an integer' };
  }
  if (v > 1) {
    return { status: 'unsupported', version: v };
  }
  if (v < 1) {
    return {
      status: 'invalid',
      reason: 'portal target v is below the minimum supported version',
    };
  }

  if (typeof kind !== 'string' || !isMarkerPortalKind(kind)) {
    return {
      status: 'invalid',
      reason: 'portal target kind is missing, not a string, or unrecognized',
    };
  }

  if (typeof id !== 'string' || id.trim() === '') {
    return {
      status: 'invalid',
      reason: 'portal target id is missing, not a string, or blank',
    };
  }

  return {
    status: 'valid',
    target: {
      v: 1,
      kind,
      id: capCodePoints(id.trim(), MARKER_PORTAL_ID_MAX_CODE_POINTS),
    },
  };
}

/**
 * Local-authorship constructor. `kind` is compile-time-constrained by its
 * type, so no runtime kind validation happens here — that is
 * `parseMarkerPortalTarget`'s job for untrusted data. `id` is expected to
 * already be a valid store id (e.g. selected from a live picker) and is
 * passed through unchanged, matching `buildMarkerData`'s treatment of its
 * mandatory `ref` field.
 */
export function buildMarkerPortalTarget(
  kind: MarkerPortalKind,
  id: string
): MarkerPortalTargetV1 {
  return { v: 1, kind, id };
}

/**
 * Builds the DM-only route for a portal target within a campaign, with
 * every dynamic path segment percent-encoded via `encodeURIComponent` so a
 * campaign code or id containing `/`, `?`, `#`, spaces, or other reserved
 * characters cannot corrupt the path or escape its segment.
 */
export function buildDmPortalHref(
  campaignCode: string,
  target: MarkerPortalTargetV1
): string {
  const encodedCode = encodeURIComponent(campaignCode);
  const encodedId = encodeURIComponent(target.id);
  const segment = target.kind === 'battlemap' ? 'battlemaps' : 'locations';
  return `/dm/campaign/${encodedCode}/${segment}/${encodedId}`;
}

/** Narrow read-only lookup for resolving a battle-map portal target's
 * live name within a campaign. */
export interface PortalBattleMapStoreLike {
  getBattleMap(
    campaignCode: string,
    id: string
  ): { id: string; name: string } | undefined;
}

/** Narrow read-only lookup for resolving a location portal target's live
 * name within a campaign. */
export interface PortalLocationStoreLike {
  getLocation(
    campaignCode: string,
    id: string
  ): { id: string; name: string } | undefined;
}

export type PortalDestinationResult =
  | { status: 'ready'; href: string; name: string }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unsupported' }
  | { status: 'self' };

/**
 * Resolves a (possibly untrusted/persisted) portal target into a DM-ready
 * destination: a canonical href and the target's *current* display name,
 * looked up live from `stores` rather than any name captured at authoring
 * time — so a renamed battle-map/location is reflected immediately without
 * rewriting the persisted `{ v, kind, id }` target.
 *
 * `target` is accepted as `unknown` and re-validated via
 * `parseMarkerPortalTarget` on every call (never trusted from a prior
 * result), so a malformed or forward-versioned persisted target surfaces as
 * `invalid`/`unsupported` here rather than throwing or silently resolving.
 *
 * Self-link refusal: when the (parsed) target's kind and id match the
 * caller-supplied `sourceKind`/`sourceId` — i.e. the marker points at the
 * map/location it lives on — resolution stops at `self` before any store
 * lookup. This function never follows a resolved destination's own portal
 * target, so two markers pointing at each other (a two-map cycle) each
 * resolve independently to `ready` and there is no recursion to bound.
 */
export function resolveDmPortalDestination(
  target: unknown,
  campaignCode: string,
  sourceId: string,
  sourceKind: MarkerPortalKind,
  stores: {
    battleMaps: PortalBattleMapStoreLike;
    locations: PortalLocationStoreLike;
  }
): PortalDestinationResult {
  const parsed = parseMarkerPortalTarget(target);
  if (parsed.status === 'invalid') {
    return { status: 'invalid' };
  }
  if (parsed.status === 'unsupported') {
    return { status: 'unsupported' };
  }

  const { target: resolved } = parsed;

  if (resolved.kind === sourceKind && resolved.id === sourceId) {
    return { status: 'self' };
  }

  const record =
    resolved.kind === 'battlemap'
      ? stores.battleMaps.getBattleMap(campaignCode, resolved.id)
      : stores.locations.getLocation(campaignCode, resolved.id);

  if (!record) {
    return { status: 'missing' };
  }

  return {
    status: 'ready',
    href: buildDmPortalHref(campaignCode, resolved),
    name: record.name,
  };
}

/**
 * Deferred follow-ups (Task 7 — non-DM portal isolation lockdown).
 *
 * This module, `PublicMarkerDetail.portal?: never`, and the sanitizer/panel
 * tests around them are today's complete, intentional scope: a DM-only
 * navigation aid with no player-, display-, or cross-client-facing
 * counterpart. The following are recorded here as deliberately deferred
 * product surfaces — NOT dormant controls, flags, or partially-wired code
 * paths waiting to be flipped on. Each would need its own design pass
 * (most importantly, server-enforced authorization — a portal target must
 * never be trusted from a client) before any code lands:
 *
 *   - Player portal travel: a player-triggered map/location jump would need
 *     the destination validated and applied server-side (the relay or an
 *     API route), never a bare client-side navigation off a DM-authored
 *     target, so a compromised or stale client cannot smuggle a player into
 *     an unauthorized map.
 *   - Stable deep linking to campaign locations from inside the player
 *     character-sheet (e.g. "view on map" from an NPC/location reference).
 *   - Coordinated active-map handoff: today each connected player's client
 *     independently decides what it renders; moving "the table" to a new
 *     battle map together (DM-initiated) is unbuilt.
 *   - Display navigation for the TV surface: `useMarkerRegistration`'s
 *     `gesture: null` keeps the display non-interactive by design (see
 *     `display/page.tsx`); a DM-remote-controlled TV map switch is a
 *     separate, unbuilt feature, not a gap in this lockdown.
 */
