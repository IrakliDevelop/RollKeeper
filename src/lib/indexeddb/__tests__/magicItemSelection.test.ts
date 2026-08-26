import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasMagicItemSelection,
  isMagicItemParticipant,
  magicItemSelectionKey,
  readMagicItemSelection,
  selectMagicItemLibrary,
} from '../magicItemSelection';

describe('magic item library explicit selection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('namespaces the selection receipt by account and campaign', () => {
    expect(magicItemSelectionKey('user:a', 'campaign-a')).toBe(
      'rollkeeper:magic-item-selection:user:a:campaign-a'
    );
  });

  it('is disabled and unselected by default without reading storage', () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(isMagicItemParticipant(storage, 'user:a', 'campaign-a')).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('requires client visibility plus exact account/campaign selection', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(() =>
      selectMagicItemLibrary(storage, {
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
    ).toThrow(/confirmation/i);
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);

    selectMagicItemLibrary(storage, {
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
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(true);
    expect(isMagicItemParticipant(storage, 'user:a', 'campaign-a')).toBe(true);
    expect(isMagicItemParticipant(storage, 'user:b', 'campaign-a')).toBe(false);
    expect(isMagicItemParticipant(storage, 'user:a', 'campaign-b')).toBe(false);
    expect(
      readMagicItemSelection(storage, 'user:a', 'campaign-a')
    ).toMatchObject({
      version: 1,
      family: 'magic_item',
      namespace: 'user:a',
      campaignId: 'campaign-a',
      selectedAt: 'selected-at',
      recovery: { runId: 'run', manifestHash: 'a'.repeat(64) },
    });
    expect(readMagicItemSelection(storage, 'user:a', 'campaign-b')).toBeNull();
  });

  it('stays a non-participant while the client flag is off even when selected', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    selectMagicItemLibrary(storage, {
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
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(true);
    expect(isMagicItemParticipant(storage, 'user:a', 'campaign-a')).toBe(false);
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
      selectMagicItemLibrary(storage, { ...base, namespace: 'guest' })
    ).toThrow(/owner/i);
    expect(() =>
      selectMagicItemLibrary(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'bad' },
      })
    ).toThrow(/receipt/i);
    expect(() =>
      selectMagicItemLibrary(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'A'.repeat(64) },
      })
    ).toThrow(/receipt/i);

    const key = 'rollkeeper:magic-item-selection:user:a:campaign-a';
    values.set(key, '{');
    expect(readMagicItemSelection(storage, 'user:a', 'campaign-a')).toBeNull();
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:b',
        campaignId: 'campaign-a',
        family: 'magic_item',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'calendar',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
    values.set(
      key,
      JSON.stringify({
        version: 2,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'magic_item',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'magic_item',
        selectedAt: 'now',
        recovery: { runId: 'run', createdAt: 'now' },
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'magic_item',
        selectedAt: 42,
        recovery: base.recovery,
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
    values.set(
      key,
      JSON.stringify({
        version: 1,
        namespace: 'user:a',
        campaignId: 'campaign-a',
        family: 'magic_item',
        selectedAt: 'now',
        recovery: { runId: 7, manifestHash: 'a'.repeat(64), createdAt: 'now' },
      })
    );
    expect(hasMagicItemSelection(storage, 'user:a', 'campaign-a')).toBe(false);
  });
});
