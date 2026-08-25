import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { selectCalendar } from '@/lib/indexeddb/calendarSelection';
import { selectCampaignSettings } from '@/lib/indexeddb/campaignSettingsSelection';
import { selectCombatLogArchiveFamily } from '@/lib/indexeddb/combatLogArchiveSelection';
import { selectEncounterFamily } from '@/lib/indexeddb/encounterSelection';
import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { selectMagicItemLibrary } from '@/lib/indexeddb/magicItemSelection';
import { selectNpcFamily } from '@/lib/indexeddb/npcSelection';

import type { DurableFamilyName } from '../durableFamilyAdapter';
import {
  readFamilyPreparedState,
  readFamilySelection,
} from '../familySelectionReader';

const NAMESPACE = 'user:account-a' as const;
const CAMPAIGN_ID = 'campaign-a';
const NOW = '2026-08-25T00:00:00.000Z';
const RECOVERY = {
  runId: 'run-1',
  manifestHash: 'a'.repeat(64),
  createdAt: NOW,
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('readFamilySelection', () => {
  it('reads campaign_settings from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectCampaignSettings(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(
      readFamilySelection('campaign_settings', storage, NAMESPACE, CAMPAIGN_ID)
    ).toEqual({ runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash });
  });

  it('returns null for campaign_settings when nothing has been selected', () => {
    expect(
      readFamilySelection(
        'campaign_settings',
        memoryStorage(),
        NAMESPACE,
        CAMPAIGN_ID
      )
    ).toBeNull();
  });

  it('reads calendar from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectCalendar(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(
      readFamilySelection('calendar', storage, NAMESPACE, CAMPAIGN_ID)
    ).toEqual({ runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash });
  });

  it('returns null for calendar when nothing has been selected', () => {
    expect(
      readFamilySelection('calendar', memoryStorage(), NAMESPACE, CAMPAIGN_ID)
    ).toBeNull();
  });

  it('reads magic_item from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectMagicItemLibrary(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(
      readFamilySelection('magic_item', storage, NAMESPACE, CAMPAIGN_ID)
    ).toEqual({ runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash });
  });

  it('returns null for magic_item when nothing has been selected', () => {
    expect(
      readFamilySelection('magic_item', memoryStorage(), NAMESPACE, CAMPAIGN_ID)
    ).toBeNull();
  });

  it('reads npc from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectNpcFamily(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(readFamilySelection('npc', storage, NAMESPACE, CAMPAIGN_ID)).toEqual(
      { runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash }
    );
  });

  it('returns null for npc when nothing has been selected', () => {
    expect(
      readFamilySelection('npc', memoryStorage(), NAMESPACE, CAMPAIGN_ID)
    ).toBeNull();
  });

  it('reads encounter_definition from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectEncounterFamily(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(
      readFamilySelection(
        'encounter_definition',
        storage,
        NAMESPACE,
        CAMPAIGN_ID
      )
    ).toEqual({ runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash });
  });

  it('returns null for encounter_definition when nothing has been selected', () => {
    expect(
      readFamilySelection(
        'encounter_definition',
        memoryStorage(),
        NAMESPACE,
        CAMPAIGN_ID
      )
    ).toBeNull();
  });

  it('reads combat_log_archive from a real, matching selection record', () => {
    const storage = memoryStorage();
    selectCombatLogArchiveFamily(storage, {
      namespace: NAMESPACE,
      campaignId: CAMPAIGN_ID,
      confirmed: true,
      recovery: RECOVERY,
      now: () => NOW,
    });
    expect(
      readFamilySelection('combat_log_archive', storage, NAMESPACE, CAMPAIGN_ID)
    ).toEqual({ runId: RECOVERY.runId, manifestHash: RECOVERY.manifestHash });
  });

  it('returns null for combat_log_archive when nothing has been selected', () => {
    expect(
      readFamilySelection(
        'combat_log_archive',
        memoryStorage(),
        NAMESPACE,
        CAMPAIGN_ID
      )
    ).toBeNull();
  });

  it('throws for a family name outside the six registered dispatch cases', () => {
    expect(() =>
      readFamilySelection(
        'not_a_real_family' as unknown as DurableFamilyName,
        memoryStorage(),
        NAMESPACE,
        CAMPAIGN_ID
      )
    ).toThrow(/unknown data category/i);
  });
});

describe('readFamilyPreparedState', () => {
  afterEach(() => deleteRollkeeperDatabaseForTests(indexedDB));

  it('returns the persisted migration-state checkpoint when present', async () => {
    const writeDatabase = await openRollkeeperDatabase();
    try {
      const transaction = writeDatabase.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({
        key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN_ID}`,
        state: 'CUTOVER_READY',
        runId: 'generation-x',
      });
      await transactionComplete(transaction);
    } finally {
      writeDatabase.close();
    }

    const readDatabase = await openRollkeeperDatabase();
    try {
      expect(
        await readFamilyPreparedState(
          readDatabase,
          NAMESPACE,
          'npc',
          CAMPAIGN_ID
        )
      ).toBe('CUTOVER_READY');
    } finally {
      readDatabase.close();
    }
  });

  it('returns null when no checkpoint has ever been written', async () => {
    const database = await openRollkeeperDatabase();
    try {
      expect(
        await readFamilyPreparedState(database, NAMESPACE, 'npc', CAMPAIGN_ID)
      ).toBeNull();
    } finally {
      database.close();
    }
  });

  it('is scoped per family -- a checkpoint for one family is invisible to another', async () => {
    const writeDatabase = await openRollkeeperDatabase();
    try {
      const transaction = writeDatabase.transaction('meta', 'readwrite');
      transaction.objectStore('meta').put({
        key: `migration-state:${NAMESPACE}:npc:${CAMPAIGN_ID}`,
        state: 'CUTOVER_READY',
        runId: 'generation-x',
      });
      await transactionComplete(transaction);
    } finally {
      writeDatabase.close();
    }

    const readDatabase = await openRollkeeperDatabase();
    try {
      expect(
        await readFamilyPreparedState(
          readDatabase,
          NAMESPACE,
          'calendar',
          CAMPAIGN_ID
        )
      ).toBeNull();
    } finally {
      readDatabase.close();
    }
  });
});
