import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  combatLogArchiveSelectionKey,
  hasCombatLogArchiveSelection,
  isCombatLogArchiveParticipant,
  readCombatLogArchiveSelection,
  selectCombatLogArchiveFamily,
} from '../combatLogArchiveSelection';

describe('Combat log archive family explicit selection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('namespaces the selection receipt by account and campaign', () => {
    expect(combatLogArchiveSelectionKey('user:a', 'campaign-a')).toBe(
      'rollkeeper:combat-log-archive-selection:user:a:campaign-a'
    );
  });

  it('is disabled and unselected by default without reading storage', () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(isCombatLogArchiveParticipant(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('requires client visibility plus exact account/campaign selection', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(() =>
      selectCombatLogArchiveFamily(storage, {
        namespace: 'user:a',
        campaignId: 'campaign-a',
        confirmed: false,
        recovery: {
          runId: 'run',
          manifestHash: 'a'.repeat(64),
          createdAt: 'now',
        },
        now: () => 'now',
      })
    ).toThrow('Combat log archive selection requires confirmation');
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );

    selectCombatLogArchiveFamily(storage, {
      namespace: 'user:a',
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'selected-at',
    });
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      true
    );
    expect(isCombatLogArchiveParticipant(storage, 'user:a', 'campaign-a')).toBe(
      true
    );
    expect(isCombatLogArchiveParticipant(storage, 'user:b', 'campaign-a')).toBe(
      false
    );
    expect(isCombatLogArchiveParticipant(storage, 'user:a', 'campaign-b')).toBe(
      false
    );
    expect(
      readCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')
    ).toMatchObject({
      version: 1,
      family: 'combat_log_archive',
      namespace: 'user:a',
      campaignId: 'campaign-a',
      selectedAt: 'selected-at',
      recovery: { runId: 'run', manifestHash: 'a'.repeat(64) },
    });
    expect(
      readCombatLogArchiveSelection(storage, 'user:a', 'campaign-b')
    ).toBeNull();
  });

  it('stays a non-participant while the client flag is off even when selected', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    selectCombatLogArchiveFamily(storage, {
      namespace: 'user:a',
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    });
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      true
    );
    // Flag is not stubbed true in this test, so it reads as off.
    expect(isCombatLogArchiveParticipant(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
  });

  it('rejects guest, invalid receipts, malformed records, and mismatched scopes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const base = {
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    } as const;
    expect(() =>
      selectCombatLogArchiveFamily(storage, { ...base, namespace: 'guest' })
    ).toThrow('Owner account namespace is required');
    expect(() =>
      selectCombatLogArchiveFamily(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'bad' },
      })
    ).toThrow('Matching recovery manifest receipt is required');
    expect(() =>
      selectCombatLogArchiveFamily(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'A'.repeat(64) },
      })
    ).toThrow('Matching recovery manifest receipt is required');

    const key = 'rollkeeper:combat-log-archive-selection:user:a:campaign-a';
    values.set(key, '{');
    expect(
      readCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')
    ).toBeNull();
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:b',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'encounter_definition',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    // A selection whose family field names another family (not merely a
    // dissimilar one) still reads as absent.
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'combat_log',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    values.set(
      key,
      JSON.stringify({
        version: 2,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        selectedAt: 'now',
        recovery: { runId: 'run', createdAt: 'now' },
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        selectedAt: 42,
        recovery: base.recovery,
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'combat_log_archive',
        selectedAt: 'now',
        recovery: { runId: 7, manifestHash: 'a'.repeat(64), createdAt: 'now' },
      })
    );
    expect(hasCombatLogArchiveSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
  });
});
