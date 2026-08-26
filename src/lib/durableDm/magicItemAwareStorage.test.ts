import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMagicItemAwareStorage } from './magicItemAwareStorage';
import {
  magicItemAuthorityKey,
  magicItemUsesIndexedDbAuthority,
  readMagicItemAuthorityMarker,
  writeMagicItemAuthorityMarker,
  type MagicItemAuthorityMarker,
} from './magicItemLegacyAuthority';

const KEY = 'rollkeeper-dm-magic-item-library';

function marker(
  authority: MagicItemAuthorityMarker['authority']
): MagicItemAuthorityMarker {
  return { version: 1, authority, epoch: 4, campaignId: 'cloud-abc' };
}

function item(campaignCode: string, name: string) {
  return {
    id: `magic-${name}`,
    campaignCode,
    name,
    category: 'wondrous',
    rarity: 'rare',
    description: '',
    properties: [],
    requiresAttunement: false,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function envelope(itemsByCampaign: Record<string, unknown[]>) {
  return JSON.stringify({ state: { itemsByCampaign }, version: 1 });
}

describe('magic item family authority marker', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reads no marker and touches no storage while the client flag is off', () => {
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(readMagicItemAuthorityMarker(localStorage, 'ABC123')).toBeNull();
    expect(magicItemUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('rejects malformed and partial markers', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const key = magicItemAuthorityKey('ABC123');
    const read = () => readMagicItemAuthorityMarker(localStorage, 'ABC123');

    expect(read()).toBeNull();
    localStorage.setItem(key, '{bad');
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), version: 2 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), authority: 'redis' })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('postgres'), epoch: 1.5 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, authority: 'postgres', epoch: 4 })
    );
    expect(read()).toBeNull();
  });

  it('round-trips a written marker and classifies which authorities own the family', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    expect(magicItemAuthorityKey('ABC123')).toBe(
      'rollkeeper:magic-item-authority:ABC123'
    );

    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    expect(readMagicItemAuthorityMarker(localStorage, 'ABC123')).toEqual(
      marker('postgres')
    );
    expect(magicItemUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));
    expect(magicItemUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeMagicItemAuthorityMarker(
      localStorage,
      'ABC123',
      marker('legacy_restored')
    );
    expect(magicItemUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(magicItemUsesIndexedDbAuthority(localStorage, 'DEF456')).toBe(false);
  });
});

describe('magic item authority-aware Zustand storage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('passes unrelated keys through to the backing store', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const aware = createMagicItemAwareStorage(localStorage);

    aware.setItem('rollkeeper-theme', 'dark');
    expect(localStorage.getItem('rollkeeper-theme')).toBe('dark');
    expect(aware.getItem('rollkeeper-theme')).toBe('dark');

    aware.removeItem('rollkeeper-theme');
    expect(localStorage.getItem('rollkeeper-theme')).toBeNull();
  });

  it('writes the envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const previous = envelope({ ABC123: [item('ABC123', 'lantern')] });
    const next = envelope({
      ABC123: [item('ABC123', 'lantern'), item('ABC123', 'rope')],
      DEF456: [item('DEF456', 'orb')],
    });
    localStorage.setItem(KEY, previous);

    createMagicItemAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('freezes only the campaigns whose family authority moved off legacy', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const frozen = [item('ABC123', 'lantern')];
    localStorage.setItem(
      KEY,
      envelope({ ABC123: frozen, DEF456: [item('DEF456', 'orb')] })
    );
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createMagicItemAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [item('ABC123', 'lantern'), item('ABC123', 'rope')],
        DEF456: [item('DEF456', 'orb'), item('DEF456', 'wand')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.state.itemsByCampaign.ABC123).toEqual(frozen);
    expect(persisted.state.itemsByCampaign.DEF456).toHaveLength(2);
    expect(persisted.version).toBe(1);
  });

  it('drops a campaign key first added while the family is under cloud authority', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    localStorage.setItem(KEY, envelope({ DEF456: [item('DEF456', 'orb')] }));
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));

    createMagicItemAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [item('ABC123', 'lantern')],
        DEF456: [item('DEF456', 'orb'), item('DEF456', 'wand')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect('ABC123' in persisted.state.itemsByCampaign).toBe(false);
    expect(persisted.state.itemsByCampaign.DEF456).toHaveLength(2);
  });

  it('skips the write entirely when routing reproduces the previous envelope', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    const previous = envelope({ ABC123: [item('ABC123', 'lantern')] });
    localStorage.setItem(KEY, previous);
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createMagicItemAwareStorage(localStorage);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    aware.setItem(KEY, envelope({ ABC123: [item('ABC123', 'rope')] }));

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(previous);
  });

  it('drops routed campaigns from the first envelope write on a fresh device', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createMagicItemAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [item('ABC123', 'lantern')],
        DEF456: [item('DEF456', 'orb')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(Object.keys(persisted.state.itemsByCampaign)).toEqual(['DEF456']);
    expect(persisted.state.itemsByCampaign.DEF456).toHaveLength(1);
  });

  it('writes the first envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const next = envelope({ DEF456: [item('DEF456', 'orb')] });

    createMagicItemAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('writes the next envelope as-is when the previous value cannot be routed', () => {
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    writeMagicItemAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createMagicItemAwareStorage(localStorage);
    const next = envelope({ ABC123: [item('ABC123', 'lantern')] });

    localStorage.setItem(KEY, '{bad');
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, JSON.stringify({ state: {}, version: 1 }));
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, next);
    const malformedNext = JSON.stringify({ state: { itemsByCampaign: [] } });
    aware.setItem(KEY, malformedNext);
    expect(localStorage.getItem(KEY)).toBe(malformedNext);
  });
});
