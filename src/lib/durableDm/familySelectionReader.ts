import { readCalendarSelection } from '@/lib/indexeddb/calendarSelection';
import { readCampaignSettingsSelection } from '@/lib/indexeddb/campaignSettingsSelection';
import { readCombatLogArchiveSelection } from '@/lib/indexeddb/combatLogArchiveSelection';
import { readEncounterSelection } from '@/lib/indexeddb/encounterSelection';
import { readMagicItemSelection } from '@/lib/indexeddb/magicItemSelection';
import { readNpcSelection } from '@/lib/indexeddb/npcSelection';
import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

import type { DurableFamilyName } from './durableFamilyAdapter';

interface SelectionStorage {
  getItem(key: string): string | null;
}

/**
 * `deriveFamilyStepState`'s `selected` (spec R6, migrationRunState.ts:100-108)
 * needs a `{runId, manifestHash}` selection record, but each family owns a
 * DIFFERENT persisted selection shape and module
 * (`campaignSettingsSelection.ts` and five siblings) — there is no member on
 * `DurableFamilyAdapter` for it (the interface is deliberately silent on
 * selection storage; only `selectFamily` WRITES one). This is the one small
 * per-family dispatch the wizard needs to read what six adapters already
 * write, so `FamilyStep` can render `selected`/`prepared` from real
 * persisted evidence instead of treating them as permanently unreachable.
 *
 * Every one of the six selection records carries the identical
 * `recovery: {runId, manifestHash, createdAt}` shape (confirmed by reading
 * all six modules before writing this), so the dispatch below is a plain
 * switch over `family`, not six different result shapes.
 */
export function readFamilySelection(
  family: DurableFamilyName,
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): { runId: string; manifestHash: string } | null {
  switch (family) {
    case 'campaign_settings': {
      const selection = readCampaignSettingsSelection(
        storage,
        namespace,
        campaignId
      );
      return selection ? toRunPointer(selection.recovery) : null;
    }
    case 'calendar': {
      const selection = readCalendarSelection(storage, namespace, campaignId);
      return selection ? toRunPointer(selection.recovery) : null;
    }
    case 'magic_item': {
      const selection = readMagicItemSelection(storage, namespace, campaignId);
      return selection ? toRunPointer(selection.recovery) : null;
    }
    case 'npc': {
      const selection = readNpcSelection(storage, namespace, campaignId);
      return selection ? toRunPointer(selection.recovery) : null;
    }
    case 'encounter_definition': {
      const selection = readEncounterSelection(storage, namespace, campaignId);
      return selection ? toRunPointer(selection.recovery) : null;
    }
    case 'combat_log_archive': {
      const selection = readCombatLogArchiveSelection(
        storage,
        namespace,
        campaignId
      );
      return selection ? toRunPointer(selection.recovery) : null;
    }
    default: {
      const exhaustive: never = family;
      throw new Error(`Unknown data category: ${String(exhaustive)}`);
    }
  }
}

function toRunPointer(recovery: { runId: string; manifestHash: string }): {
  runId: string;
  manifestHash: string;
} {
  return { runId: recovery.runId, manifestHash: recovery.manifestHash };
}

/**
 * `deriveFamilyStepState`'s `prepared` needs the persisted
 * `migration-state:<namespace>:<family>:<campaignId>` `meta` checkpoint.
 * Every family's own `run*IndexedDbMigration` writes this key with the
 * SAME scope shape (confirmed against all six `*Migration.ts` modules and
 * `adapters/shared.ts`'s own `verifyPreparedGeneration`, which reads the
 * identical key with `familyKey` set to exactly the `DurableFamilyName`
 * string) — so, unlike selection, this one needs no per-family dispatch at
 * all.
 */
export async function readFamilyPreparedState(
  database: IDBDatabase,
  namespace: StorageNamespace,
  family: DurableFamilyName,
  campaignId: string
): Promise<string | null> {
  const transaction = database.transaction('meta', 'readonly');
  const record = (await requestResult(
    transaction
      .objectStore('meta')
      .get(`migration-state:${namespace}:${family}:${campaignId}`)
  )) as { state?: string } | undefined;
  await transactionComplete(transaction);
  return record?.state ?? null;
}
