'use client';

import { useEffect } from 'react';

import type { TableRosterEntry, TableSceneRoster } from '@/lib/table/roster';

import {
  PHYSICAL_REPRESENTATION,
  TABLE_REPRESENTATION_FIELD,
} from './display/displayProjection';
import type { TableRosterCanvas } from './useTableRosterState';

/**
 * PR07 P9/P10 (R3-3): per-member table representation on the DM canvas.
 * Tokens of physical members carry `tableRepresentation: 'physical'` so the
 * table display's projection omits them (table output only — the relay
 * projection, players, roster, initiative, HP and fog are unchanged). The
 * field is not secret and grants nothing.
 */

export const PHYSICAL_MINI_HELP =
  'Physical minis are hidden on the table display only. Players and the DM still see the token; initiative, HP and fog are unchanged. Physical minis are not tracked — reveal fog manually with the fog tools.';
export const PHYSICAL_PLAYER_HELP =
  "The player can still move their digital token; the table won't show it and it won't follow the real mini.";
export const REPRESENTATION_PENDING =
  'Table display updates when live control is connected.';

/** Stamp-time fields for a newly placed token of this member. */
export function representationFields(
  entry: Pick<TableRosterEntry, 'representation'>
): Record<string, unknown> {
  return entry.representation === 'physical'
    ? { [TABLE_REPRESENTATION_FIELD]: PHYSICAL_REPRESENTATION }
    : {};
}

const TOKEN_KEYS = ['tokenKind', 'characterId', 'sceneMemberId', 'entityId'];

function isTokenLike(element: Record<string, unknown>): boolean {
  return TOKEN_KEYS.some(key => element[key] !== undefined);
}

export interface RepresentationPatch {
  tokenId: string;
  patch: { set: Record<string, unknown>; unset: string[] };
}

/**
 * The writes that make canvas tokens match member records: the field on
 * every bound and alias token of a live physical member; removed from any
 * other token-like element (digital, removed, orphaned or player-tagged).
 * Non-token elements are never touched. Empty when everything matches.
 */
export function representationPatches(
  elements: readonly Record<string, unknown>[],
  roster: TableSceneRoster
): RepresentationPatch[] {
  const physical = new Set(
    roster.entries
      .filter(entry => !entry.removed && entry.representation === 'physical')
      .flatMap(entry => [...entry.boundTokenIds, ...entry.aliasTokenIds])
  );
  const patches: RepresentationPatch[] = [];
  for (const element of elements) {
    const id = element.id;
    if (typeof id !== 'string') continue;
    const tagged =
      element[TABLE_REPRESENTATION_FIELD] === PHYSICAL_REPRESENTATION;
    if (physical.has(id) && !tagged)
      patches.push({
        tokenId: id,
        patch: {
          set: { [TABLE_REPRESENTATION_FIELD]: PHYSICAL_REPRESENTATION },
          unset: [],
        },
      });
    else if (
      !physical.has(id) &&
      element[TABLE_REPRESENTATION_FIELD] !== undefined &&
      isTokenLike(element)
    )
      patches.push({
        tokenId: id,
        patch: { set: {}, unset: [TABLE_REPRESENTATION_FIELD] },
      });
  }
  return patches;
}

/** Roster header summary when the scene mixes physical and digital members. */
export function representationSummary(
  entries: readonly TableRosterEntry[]
): string | null {
  const live = entries.filter(entry => !entry.removed);
  const physical = live.filter(
    entry => entry.representation === 'physical'
  ).length;
  const digital = live.length - physical;
  return physical > 0 && digital > 0
    ? `${physical} physical · ${digital} digital`
    : null;
}

/**
 * P10: while this tab holds live control (live relay + control session), a
 * pass runs on every roster/member or canvas token change and when the tab
 * becomes the live holder or the scene canvas mounts. Each write is an
 * ordinary DM token update (committed through the authority connection);
 * nothing is written when tokens already match. Offline / non-holder:
 * nothing is written (the member section says the update is pending).
 */
export function useTableRepresentationSync(options: {
  canvas: TableRosterCanvas | null;
  roster: TableSceneRoster | null;
  liveHolder: boolean;
}): void {
  const { canvas, roster, liveHolder } = options;
  useEffect(() => {
    if (!canvas || !roster || !liveHolder) return;
    for (const { tokenId, patch } of representationPatches(
      canvas.elements(),
      roster
    ))
      canvas.applyTokenPatch(tokenId, patch);
  }, [canvas, roster, liveHolder]);
}
