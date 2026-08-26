import { encounterUsesIndexedDbAuthority } from '@/lib/durableDm/encounterLegacyAuthority';
import { isEncounterClientVisible } from '@/lib/durableDm/slice11eFlags';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';

import type { Encounter } from '@/types/encounter';
import type { EncounterDeletionTombstone } from '@/store/encounterStore';

interface EncounterStoreLike {
  getState: () => {
    encounters: Encounter[];
    encounterTombstones: Record<string, EncounterDeletionTombstone>;
  };
  setState: (partial: {
    encounters: Encounter[];
    encounterTombstones: Record<string, EncounterDeletionTombstone>;
  }) => void;
}

/**
 * The campaigns whose encounters this device no longer keeps in the legacy key
 * (ruling 4). Resolved once per storage event from the local and incoming
 * encounters plus the incoming tombstones. While the client flag is off no
 * campaign can be routed, so the merge stays byte-identical to the pre-11E one
 * and performs no extra localStorage reads.
 */
function routedCampaignCodes(
  local: Encounter[],
  incoming: Encounter[],
  incomingTombstones: Record<string, EncounterDeletionTombstone>
): Set<string> {
  const routed = new Set<string>();
  if (!isEncounterClientVisible() || typeof localStorage === 'undefined')
    return routed;
  const codes = new Set<string>();
  for (const entry of local)
    if (entry?.campaignCode) codes.add(entry.campaignCode);
  for (const entry of incoming)
    if (entry?.campaignCode) codes.add(entry.campaignCode);
  for (const tombstone of Object.values(incomingTombstones)) {
    const code = tombstone?.beforeImage?.campaignCode;
    if (code) codes.add(code);
  }
  for (const code of codes)
    if (encounterUsesIndexedDbAuthority(localStorage, code)) routed.add(code);
  return routed;
}

/**
 * Cross-tab encounter convergence (mirrors crossTabRosterSync). The DM
 * routinely keeps the encounter page and the battlemap open in separate
 * tabs; zustand persist writes localStorage but never listens for the
 * `storage` event, so without this each tab's in-memory store goes stale
 * until a reload. Merge per encounter by `updatedAt` — strictly newer
 * wins (every store mutation stamps it); unknown ids are adopted (created
 * in another tab); local-only encounters are kept (deletion sync is out
 * of scope, same as the roster). setState only on change, so the echo
 * event the other tab receives finds equal timestamps and terminates.
 * Same-timestamp concurrent edits are last-writer-wins.
 */
export function initCrossTabEncounterSync(
  store: EncounterStoreLike
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== ENCOUNTER_STORAGE_KEY || !event.newValue) return;
    let incoming: Encounter[] | undefined;
    let incomingTombstones: Record<string, EncounterDeletionTombstone> = {};
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      const incomingState = (
        parsed as {
          state?: {
            encounters?: Encounter[];
            encounterTombstones?: Record<string, EncounterDeletionTombstone>;
          };
        } | null
      )?.state;
      incoming = incomingState?.encounters;
      incomingTombstones = incomingState?.encounterTombstones ?? {};
    } catch {
      return;
    }
    if (!Array.isArray(incoming)) return;

    const current = store.getState();
    const routed = routedCampaignCodes(
      current.encounters,
      incoming,
      incomingTombstones
    );
    // A routed encounter is owned by the cloud family; a legacy tab can neither
    // resurrect nor delete it, whatever its stale copy claims.
    const routedLocalIds = new Set(
      routed.size === 0
        ? []
        : current.encounters
            .filter(
              entry => entry?.campaignCode && routed.has(entry.campaignCode)
            )
            .map(entry => entry.id)
    );
    const encounterTombstones = { ...current.encounterTombstones };
    let changed = false;
    for (const [id, tombstone] of Object.entries(incomingTombstones)) {
      if (routedLocalIds.has(id)) continue;
      const tombstonedCode = tombstone?.beforeImage?.campaignCode;
      if (tombstonedCode && routed.has(tombstonedCode)) continue;
      const local = encounterTombstones[id];
      if (!local || tombstone.deletedAt > local.deletedAt) {
        encounterTombstones[id] = tombstone;
        changed = true;
      }
    }
    const incomingById = new Map(
      incoming
        .filter(entry => entry && typeof entry.id === 'string')
        .filter(
          entry => !(entry.campaignCode && routed.has(entry.campaignCode))
        )
        .filter(entry => !encounterTombstones[entry.id])
        .map(entry => [entry.id, entry])
    );
    const merged = current.encounters
      .filter(entry => {
        const keep =
          !encounterTombstones[entry.id] || routedLocalIds.has(entry.id);
        if (!keep) changed = true;
        return keep;
      })
      .map(entry => {
        const candidate = incomingById.get(entry.id);
        incomingById.delete(entry.id);
        if (!candidate) return entry;
        if ((candidate.updatedAt ?? '') > (entry.updatedAt ?? '')) {
          changed = true;
          return candidate;
        }
        return entry;
      });
    for (const adopted of incomingById.values()) {
      merged.push(adopted);
      changed = true;
    }
    if (changed) store.setState({ encounters: merged, encounterTombstones });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
