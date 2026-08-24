/**
 * Task 1 (Slice 11G): aware-storage fixpoint preflight.
 *
 * The migration wizard (Task 15) verifies exactly one browser backup before a
 * whole six-family cutover run and expects the legacy envelope to be
 * byte-stable afterward. Each family's aware storage wrapper reconstructs the
 * legacy envelope on every write once a campaign is routed, freezing that
 * campaign's fields from the previous envelope. If that reconstruction
 * re-emits semantically identical data in a different key order, the device
 * recovery manifest hash changes on every write — silently invalidating the
 * one verified backup the wizard is relying on.
 *
 * Each test below seeds a legacy envelope with two campaigns deliberately
 * interleaved (or otherwise ordered) so a routed campaign is not contiguous
 * with itself, marks one campaign routed to IndexedDB, then re-persists the
 * *exact same* envelope unchanged. The aware storage must leave the stored
 * bytes untouched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCombatLogStore } from '@/store/combatLogStore';
import { useEncounterStore } from '@/store/encounterStore';

import { createCalendarAwareStorage } from '../calendarAwareStorage';
import { writeCalendarProjectionAuthority } from '../calendarLegacyProjection';
import { createCampaignSettingsAwareDmStorage } from '../campaignSettingsAwareStorage';
import { writeCampaignSettingsProjectionAuthority } from '../campaignSettingsLegacyProjection';
import { createCombatLogArchiveAwareStorage } from '../combatLogArchiveAwareStorage';
import { writeCombatLogArchiveAuthorityMarker } from '../combatLogArchiveLegacyAuthority';
import { createEncounterAwareStorage } from '../encounterAwareStorage';
import { writeEncounterAuthorityMarker } from '../encounterLegacyAuthority';
import { createMagicItemAwareStorage } from '../magicItemAwareStorage';
import { writeMagicItemAuthorityMarker } from '../magicItemLegacyAuthority';
import { createNpcAwareStorage } from '../npcAwareStorage';
import { writeNpcAuthorityMarker } from '../npcLegacyAuthority';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
  } as Storage;
}

const ROUTED = 'ALPHA';
const UNROUTED = 'BETA';

describe('aware-storage device manifest stability (Task 1 preflight)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('combat_log_archive', () => {
    /** Archives deliberately interleaved: ALPHA, BETA, ALPHA. */
    function interleavedEnvelope() {
      return JSON.stringify({
        version: 2,
        state: {
          encounters: {
            'a-1': { campaignCode: ROUTED, events: [] },
            'b-1': { campaignCode: UNROUTED, events: [] },
            'a-2': { campaignCode: ROUTED, events: [] },
          },
          combatLogTombstones: {},
          activeArchiveId: null,
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
      const before = interleavedEnvelope();
      const storage = memoryStorage({
        'rollkeeper-combat-log': before,
      });
      writeCombatLogArchiveAuthorityMarker(storage, {
        version: 1,
        campaignCode: ROUTED,
        authority: 'indexedDB',
        epoch: 1,
        accountId: 'account-1',
        campaignId: 'campaign-1',
      });
      const aware = createCombatLogArchiveAwareStorage(storage);

      // The store re-persists exactly what it already holds. Nothing changed.
      aware.setItem('rollkeeper-combat-log', before);

      expect(storage.getItem('rollkeeper-combat-log')).toBe(before);
    });

    /** Tombstones deliberately interleaved: ALPHA, BETA, ALPHA. */
    function interleavedTombstoneEnvelope() {
      return JSON.stringify({
        version: 2,
        state: {
          encounters: {},
          combatLogTombstones: {
            'a-1': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: {
                encounterId: 'a-1',
                campaignCode: ROUTED,
                events: [],
              },
            },
            'b-1': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: {
                encounterId: 'b-1',
                campaignCode: UNROUTED,
                events: [],
              },
            },
            'a-2': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: {
                encounterId: 'a-2',
                campaignCode: ROUTED,
                events: [],
              },
            },
          },
          activeArchiveId: null,
        },
      });
    }

    it('leaves the legacy envelope byte-identical when routed tombstones are re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
      const before = interleavedTombstoneEnvelope();
      const storage = memoryStorage({
        'rollkeeper-combat-log': before,
      });
      writeCombatLogArchiveAuthorityMarker(storage, {
        version: 1,
        campaignCode: ROUTED,
        authority: 'indexedDB',
        epoch: 1,
        accountId: 'account-1',
        campaignId: 'campaign-1',
      });
      const aware = createCombatLogArchiveAwareStorage(storage);

      aware.setItem('rollkeeper-combat-log', before);

      expect(storage.getItem('rollkeeper-combat-log')).toBe(before);
    });

    /**
     * The tests above re-inject `before` back in as `nextRaw` verbatim, which
     * only proves the aware storage is a fixpoint *given byte-identical
     * input*. The real post-cutover write is zustand's own
     * `JSON.stringify({state: partialize(state), version})` after a real
     * hydrate — if rehydrate ever reordered a record's fields, this test
     * would catch it where the re-injection tests above cannot. Uses the
     * real, globally-backed `useCombatLogStore` singleton (not `memoryStorage`)
     * because the store's aware storage always binds to the global
     * `localStorage`.
     */
    it('is a fixpoint through the real store: hydrate, then let a genuine persist write-through leave the stored bytes untouched', async () => {
      vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
      localStorage.clear();
      const before = JSON.stringify({
        state: {
          encounters: {
            'a-1': {
              encounterId: 'a-1',
              campaignCode: ROUTED,
              events: [],
              startedAt: '2026-07-01T00:00:00.000Z',
            },
            'b-1': {
              encounterId: 'b-1',
              campaignCode: UNROUTED,
              events: [],
              startedAt: '2026-07-01T00:00:00.000Z',
            },
            'a-2': {
              encounterId: 'a-2',
              campaignCode: ROUTED,
              events: [],
              startedAt: '2026-07-01T00:00:00.000Z',
            },
          },
          combatLogTombstones: {},
          activeArchiveId: null,
        },
        version: 2,
      });
      localStorage.setItem('rollkeeper-combat-log', before);
      writeCombatLogArchiveAuthorityMarker(localStorage, {
        version: 1,
        campaignCode: ROUTED,
        authority: 'indexedDB',
        epoch: 1,
        accountId: 'account-1',
        campaignId: 'campaign-1',
      });

      await useCombatLogStore.persist.rehydrate();
      // Rehydrating alone must never write back to storage.
      expect(localStorage.getItem('rollkeeper-combat-log')).toBe(before);

      // Any zustand `set()` call — including this no-op `.setState({})` —
      // goes through the exact same middleware-wrapped path as a real store
      // action: it recomputes `partialize({...get()})` fresh and writes it
      // through `JSON.stringify` and the aware storage. This is the real
      // post-cutover persist, not a re-injection of `before`.
      useCombatLogStore.setState({});

      expect(localStorage.getItem('rollkeeper-combat-log')).toBe(before);
      localStorage.clear();
    });
  });

  describe('encounter_definition', () => {
    /** Encounters deliberately interleaved: ALPHA, BETA, ALPHA. */
    function interleavedEnvelope() {
      return JSON.stringify({
        version: 2,
        state: {
          encounters: [
            { id: 'a-1', campaignCode: ROUTED, entities: [] },
            { id: 'b-1', campaignCode: UNROUTED, entities: [] },
            { id: 'a-2', campaignCode: ROUTED, entities: [] },
          ],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: { enemyHpDisplay: 'exact' },
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
      const before = interleavedEnvelope();
      const storage = memoryStorage({
        'rollkeeper-encounter-data': before,
      });
      writeEncounterAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createEncounterAwareStorage(storage);

      aware.setItem('rollkeeper-encounter-data', before);

      expect(storage.getItem('rollkeeper-encounter-data')).toBe(before);
    });

    /** Tombstones deliberately interleaved: ALPHA, BETA, ALPHA. */
    function interleavedTombstoneEnvelope() {
      return JSON.stringify({
        version: 2,
        state: {
          encounters: [],
          encounterTombstones: {
            'a-1': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: { id: 'a-1', campaignCode: ROUTED, entities: [] },
            },
            'b-1': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: { id: 'b-1', campaignCode: UNROUTED, entities: [] },
            },
            'a-2': {
              deletedAt: '2026-07-05T00:00:00.000Z',
              beforeImage: { id: 'a-2', campaignCode: ROUTED, entities: [] },
            },
          },
          activeEncounterId: null,
          combatConfig: { enemyHpDisplay: 'exact' },
        },
      });
    }

    it('leaves the legacy envelope byte-identical when routed tombstones are re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
      const before = interleavedTombstoneEnvelope();
      const storage = memoryStorage({
        'rollkeeper-encounter-data': before,
      });
      writeEncounterAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createEncounterAwareStorage(storage);

      aware.setItem('rollkeeper-encounter-data', before);

      expect(storage.getItem('rollkeeper-encounter-data')).toBe(before);
    });

    /**
     * `mergeRoutedArray` must not rely on `entry.id` to stay stable — real
     * encounter records always have one, but the aware storage still has to
     * survive malformed data faithfully instead of reordering it further.
     */
    it('leaves a no-id entry in its original position when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
      const before = JSON.stringify({
        version: 2,
        state: {
          encounters: [
            { id: 'a-1', campaignCode: ROUTED, entities: [] },
            { name: 'malformed: no id field', entities: [] },
            { id: 'b-1', campaignCode: UNROUTED, entities: [] },
          ],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: { enemyHpDisplay: 'exact' },
        },
      });
      const storage = memoryStorage({ 'rollkeeper-encounter-data': before });
      writeEncounterAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createEncounterAwareStorage(storage);

      aware.setItem('rollkeeper-encounter-data', before);

      expect(storage.getItem('rollkeeper-encounter-data')).toBe(before);
    });

    it('leaves duplicate-id entries stable when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
      const before = JSON.stringify({
        version: 2,
        state: {
          encounters: [
            { id: 'dup', campaignCode: ROUTED, entities: [] },
            { id: 'dup', campaignCode: UNROUTED, entities: [] },
          ],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: { enemyHpDisplay: 'exact' },
        },
      });
      const storage = memoryStorage({ 'rollkeeper-encounter-data': before });
      writeEncounterAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createEncounterAwareStorage(storage);

      aware.setItem('rollkeeper-encounter-data', before);

      expect(storage.getItem('rollkeeper-encounter-data')).toBe(before);
    });

    /** See combat_log_archive's equivalent test for why this is necessary. */
    it('is a fixpoint through the real store: hydrate, then let a genuine persist write-through leave the stored bytes untouched', async () => {
      vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
      localStorage.clear();
      const before = JSON.stringify({
        state: {
          encounters: [
            { id: 'a-1', campaignCode: ROUTED, entities: [] },
            { id: 'b-1', campaignCode: UNROUTED, entities: [] },
            { id: 'a-2', campaignCode: ROUTED, entities: [] },
          ],
          encounterTombstones: {},
          activeEncounterId: null,
          combatConfig: { enemyHpDisplay: 'exact' },
        },
        version: 2,
      });
      localStorage.setItem('rollkeeper-encounter-data', before);
      writeEncounterAuthorityMarker(localStorage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });

      await useEncounterStore.persist.rehydrate();
      expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(before);

      // encounterStore has no `partialize` override (identity partialize),
      // so this exercises the default `state => state` path too — a `set()`
      // call still recomputes and re-serializes the full live state.
      useEncounterStore.setState({});

      expect(localStorage.getItem('rollkeeper-encounter-data')).toBe(before);
      localStorage.clear();
    });
  });

  describe('magic_item', () => {
    /**
     * `itemsByCampaign` is keyed directly by campaign code (one bucket per
     * campaign), so the interleaving risk is in key insertion order rather
     * than entry order within a campaign: UNROUTED is inserted before ROUTED.
     */
    function envelope() {
      return JSON.stringify({
        version: 1,
        state: {
          itemsByCampaign: {
            [UNROUTED]: [
              { id: 'item-1', campaignCode: UNROUTED, name: 'Ring' },
            ],
            [ROUTED]: [{ id: 'item-2', campaignCode: ROUTED, name: 'Wand' }],
          },
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
      const before = envelope();
      const storage = memoryStorage({
        'rollkeeper-dm-magic-item-library': before,
      });
      writeMagicItemAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createMagicItemAwareStorage(storage);

      aware.setItem('rollkeeper-dm-magic-item-library', before);

      expect(storage.getItem('rollkeeper-dm-magic-item-library')).toBe(before);
    });

    /**
     * A byte-identical re-persist alone cannot distinguish "the routed
     * branch ran and did nothing" from "the routed branch never ran and the
     * write fell through unchanged" — an unparseable marker takes the same
     * fallback path as a correctly-off flag. Persisting a *mutated* routed
     * campaign and asserting it reverts to the previous value pins the
     * freeze itself, not just its no-op case.
     */
    it('reverts a mutated routed campaign to its previous value', () => {
      vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
      const storage = memoryStorage({
        'rollkeeper-dm-magic-item-library': envelope(),
      });
      writeMagicItemAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createMagicItemAwareStorage(storage);

      aware.setItem(
        'rollkeeper-dm-magic-item-library',
        JSON.stringify({
          version: 1,
          state: {
            itemsByCampaign: {
              [UNROUTED]: [
                { id: 'item-1', campaignCode: UNROUTED, name: 'Ring' },
              ],
              [ROUTED]: [
                { id: 'item-2', campaignCode: ROUTED, name: 'Mutated' },
              ],
            },
          },
        })
      );

      const persisted = JSON.parse(
        storage.getItem('rollkeeper-dm-magic-item-library')!
      );
      expect(persisted.state.itemsByCampaign[ROUTED]).toEqual([
        { id: 'item-2', campaignCode: ROUTED, name: 'Wand' },
      ]);
    });
  });

  describe('npc', () => {
    /** `npcsByCampaign` keyed directly by campaign code, UNROUTED inserted first. */
    function envelope() {
      return JSON.stringify({
        version: 4,
        state: {
          npcsByCampaign: {
            [UNROUTED]: [
              { id: 'npc-1', campaignCode: UNROUTED, name: 'Guard' },
            ],
            [ROUTED]: [{ id: 'npc-2', campaignCode: ROUTED, name: 'Sage' }],
          },
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
      const before = envelope();
      const storage = memoryStorage({
        'rollkeeper-npc-data': before,
      });
      writeNpcAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createNpcAwareStorage(storage);

      aware.setItem('rollkeeper-npc-data', before);

      expect(storage.getItem('rollkeeper-npc-data')).toBe(before);
    });

    /** See magic_item's equivalent test for why this pins the routed branch. */
    it('reverts a mutated routed campaign to its previous value', () => {
      vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
      const storage = memoryStorage({
        'rollkeeper-npc-data': envelope(),
      });
      writeNpcAuthorityMarker(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createNpcAwareStorage(storage);

      aware.setItem(
        'rollkeeper-npc-data',
        JSON.stringify({
          version: 4,
          state: {
            npcsByCampaign: {
              [UNROUTED]: [
                { id: 'npc-1', campaignCode: UNROUTED, name: 'Guard' },
              ],
              [ROUTED]: [
                { id: 'npc-2', campaignCode: ROUTED, name: 'Mutated' },
              ],
            },
          },
        })
      );

      const persisted = JSON.parse(storage.getItem('rollkeeper-npc-data')!);
      expect(persisted.state.npcsByCampaign[ROUTED]).toEqual([
        { id: 'npc-2', campaignCode: ROUTED, name: 'Sage' },
      ]);
    });
  });

  describe('calendar', () => {
    /**
     * One calendar per campaign (the store forbids duplicates), so the array
     * itself carries both campaigns; UNROUTED is listed before ROUTED so a
     * routed rewrite that appended rather than mutated in place would move it.
     */
    function envelope() {
      return JSON.stringify({
        version: 3,
        state: {
          calendars: [
            {
              campaignCode: UNROUTED,
              config: {},
              currentTime: 0,
              startTime: 0,
              events: [],
            },
            {
              campaignCode: ROUTED,
              config: {},
              currentTime: 5,
              startTime: 0,
              events: [],
            },
          ],
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
      const before = envelope();
      const storage = memoryStorage({
        'rollkeeper-calendar-data': before,
      });
      writeCalendarProjectionAuthority(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createCalendarAwareStorage(storage);

      aware.setItem('rollkeeper-calendar-data', before);

      expect(storage.getItem('rollkeeper-calendar-data')).toBe(before);
    });

    /** See magic_item's equivalent test for why this pins the routed branch. */
    it('reverts a mutated routed campaign to its previous value', () => {
      vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
      const storage = memoryStorage({
        'rollkeeper-calendar-data': envelope(),
      });
      writeCalendarProjectionAuthority(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createCalendarAwareStorage(storage);

      aware.setItem(
        'rollkeeper-calendar-data',
        JSON.stringify({
          version: 3,
          state: {
            calendars: [
              {
                campaignCode: UNROUTED,
                config: {},
                currentTime: 0,
                startTime: 0,
                events: [],
              },
              {
                campaignCode: ROUTED,
                config: {},
                currentTime: 99,
                startTime: 0,
                events: [],
              },
            ],
          },
        })
      );

      const persisted = JSON.parse(
        storage.getItem('rollkeeper-calendar-data')!
      );
      expect(
        persisted.state.calendars.find(
          (c: { campaignCode: string }) => c.campaignCode === ROUTED
        ).currentTime
      ).toBe(5);
    });
  });

  describe('campaign_settings', () => {
    /**
     * One campaign object per code, so the interleaving risk is in the
     * `campaigns` array order: UNROUTED is listed before ROUTED.
     */
    function envelope() {
      return JSON.stringify({
        version: 1,
        state: {
          campaigns: [
            { code: UNROUTED, stackableInspiration: false, unrelated: 1 },
            { code: ROUTED, stackableInspiration: true, unrelated: 2 },
          ],
        },
      });
    }

    it('leaves the legacy envelope byte-identical when a routed campaign is re-persisted unchanged', () => {
      vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
      const before = envelope();
      const storage = memoryStorage({
        'rollkeeper-dm-data': before,
      });
      writeCampaignSettingsProjectionAuthority(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createCampaignSettingsAwareDmStorage(storage);

      aware.setItem('rollkeeper-dm-data', before);

      expect(storage.getItem('rollkeeper-dm-data')).toBe(before);
    });

    /** See magic_item's equivalent test for why this pins the routed branch. */
    it('reverts a mutated routed campaign to its previous value', () => {
      vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
      const storage = memoryStorage({
        'rollkeeper-dm-data': envelope(),
      });
      writeCampaignSettingsProjectionAuthority(storage, ROUTED, {
        version: 1,
        authority: 'indexedDB',
        epoch: 1,
        campaignId: 'campaign-1',
      });
      const aware = createCampaignSettingsAwareDmStorage(storage);

      aware.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          version: 1,
          state: {
            campaigns: [
              { code: UNROUTED, stackableInspiration: false, unrelated: 1 },
              { code: ROUTED, stackableInspiration: false, unrelated: 2 },
            ],
          },
        })
      );

      const persisted = JSON.parse(storage.getItem('rollkeeper-dm-data')!);
      expect(
        persisted.state.campaigns.find(
          (c: { code: string }) => c.code === ROUTED
        ).stackableInspiration
      ).toBe(true);
    });
  });
});
