import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNpcAwareStorage } from './npcAwareStorage';
import {
  npcAuthorityKey,
  npcUsesIndexedDbAuthority,
  readNpcAuthorityMarker,
  writeNpcAuthorityMarker,
  type NpcAuthorityMarker,
} from './npcLegacyAuthority';

const KEY = 'rollkeeper-npc-data';

function marker(
  authority: NpcAuthorityMarker['authority']
): NpcAuthorityMarker {
  return { version: 1, authority, epoch: 4, campaignId: 'cloud-abc' };
}

function npc(campaignCode: string, name: string) {
  return {
    id: `npc-${name}`,
    campaignCode,
    name,
    armorClass: '12',
    maxHp: 9,
    speed: '30 ft.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function envelope(npcsByCampaign: Record<string, unknown[]>) {
  return JSON.stringify({ state: { npcsByCampaign }, version: 4 });
}

describe('npc family authority marker', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reads no marker and touches no storage while the client flag is off', () => {
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(readNpcAuthorityMarker(localStorage, 'ABC123')).toBeNull();
    expect(npcUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('rejects malformed and partial markers', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const key = npcAuthorityKey('ABC123');
    const read = () => readNpcAuthorityMarker(localStorage, 'ABC123');

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
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    expect(npcAuthorityKey('ABC123')).toBe('rollkeeper:npc-authority:ABC123');

    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    expect(readNpcAuthorityMarker(localStorage, 'ABC123')).toEqual(
      marker('postgres')
    );
    expect(npcUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));
    expect(npcUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(true);

    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('legacy_restored'));
    expect(npcUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(false);
    expect(npcUsesIndexedDbAuthority(localStorage, 'DEF456')).toBe(false);
  });
});

describe('npc authority-aware Zustand storage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('passes unrelated keys through to the backing store', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const aware = createNpcAwareStorage(localStorage);

    aware.setItem('rollkeeper-theme', 'dark');
    expect(localStorage.getItem('rollkeeper-theme')).toBe('dark');
    expect(aware.getItem('rollkeeper-theme')).toBe('dark');

    aware.removeItem('rollkeeper-theme');
    expect(localStorage.getItem('rollkeeper-theme')).toBeNull();
  });

  it('writes the envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const previous = envelope({ ABC123: [npc('ABC123', 'bob')] });
    const next = envelope({
      ABC123: [npc('ABC123', 'bob'), npc('ABC123', 'guard')],
      DEF456: [npc('DEF456', 'orc')],
    });
    localStorage.setItem(KEY, previous);

    createNpcAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('freezes only the campaigns whose family authority moved off legacy', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const frozen = [npc('ABC123', 'bob')];
    localStorage.setItem(
      KEY,
      envelope({ ABC123: frozen, DEF456: [npc('DEF456', 'orc')] })
    );
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createNpcAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [npc('ABC123', 'bob'), npc('ABC123', 'guard')],
        DEF456: [npc('DEF456', 'orc'), npc('DEF456', 'goblin')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(persisted.state.npcsByCampaign.ABC123).toEqual(frozen);
    expect(persisted.state.npcsByCampaign.DEF456).toHaveLength(2);
    expect(persisted.version).toBe(4);
  });

  it('drops a campaign key first added while the family is under cloud authority', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    localStorage.setItem(KEY, envelope({ DEF456: [npc('DEF456', 'orc')] }));
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('indexedDB'));

    createNpcAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [npc('ABC123', 'bob')],
        DEF456: [npc('DEF456', 'orc'), npc('DEF456', 'goblin')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect('ABC123' in persisted.state.npcsByCampaign).toBe(false);
    expect(persisted.state.npcsByCampaign.DEF456).toHaveLength(2);
  });

  it('skips the write entirely when routing reproduces the previous envelope', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    const previous = envelope({ ABC123: [npc('ABC123', 'bob')] });
    localStorage.setItem(KEY, previous);
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createNpcAwareStorage(localStorage);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    aware.setItem(KEY, envelope({ ABC123: [npc('ABC123', 'guard')] }));

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(previous);
  });

  it('drops routed campaigns from the first envelope write on a fresh device', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));

    createNpcAwareStorage(localStorage).setItem(
      KEY,
      envelope({
        ABC123: [npc('ABC123', 'bob')],
        DEF456: [npc('DEF456', 'orc')],
      })
    );

    const persisted = JSON.parse(localStorage.getItem(KEY)!);
    expect(Object.keys(persisted.state.npcsByCampaign)).toEqual(['DEF456']);
    expect(persisted.state.npcsByCampaign.DEF456).toHaveLength(1);
  });

  it('writes the first envelope byte-identically when no campaign is routed', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const next = envelope({ DEF456: [npc('DEF456', 'orc')] });

    createNpcAwareStorage(localStorage).setItem(KEY, next);

    expect(localStorage.getItem(KEY)).toBe(next);
  });

  it('writes the next envelope as-is when the previous value cannot be routed', () => {
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    writeNpcAuthorityMarker(localStorage, 'ABC123', marker('postgres'));
    const aware = createNpcAwareStorage(localStorage);
    const next = envelope({ ABC123: [npc('ABC123', 'bob')] });

    localStorage.setItem(KEY, '{bad');
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, JSON.stringify({ state: {}, version: 4 }));
    aware.setItem(KEY, next);
    expect(localStorage.getItem(KEY)).toBe(next);

    localStorage.setItem(KEY, next);
    const malformedNext = JSON.stringify({ state: { npcsByCampaign: [] } });
    aware.setItem(KEY, malformedNext);
    expect(localStorage.getItem(KEY)).toBe(malformedNext);
  });

  it('writes the next envelope without reading storage while the flag is off', () => {
    const aware = createNpcAwareStorage(localStorage);
    const next = envelope({ ABC123: [npc('ABC123', 'bob')] });
    localStorage.setItem(KEY, envelope({ ABC123: [npc('ABC123', 'ann')] }));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    aware.setItem(KEY, next);

    // Default-off must not pay for a read and a parse on every store write.
    expect(getItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(next);
  });
});
