import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  combatLogArchiveAuthorityKey,
  combatLogArchiveUsesIndexedDbAuthority,
  readCombatLogArchiveAuthorityMarker,
  writeCombatLogArchiveAuthorityMarker,
  type CombatLogArchiveAuthorityMarker,
} from './combatLogArchiveLegacyAuthority';

function marker(
  campaignCode: string,
  authority: CombatLogArchiveAuthorityMarker['authority']
): CombatLogArchiveAuthorityMarker {
  return {
    version: 1,
    campaignCode,
    authority,
    epoch: 4,
    accountId: 'account-abc',
    campaignId: 'cloud-abc',
  };
}

describe('combat log archive family authority marker', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reads no marker and touches no storage while the client flag is off', () => {
    writeCombatLogArchiveAuthorityMarker(
      localStorage,
      marker('ABC123', 'postgres')
    );
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    expect(
      readCombatLogArchiveAuthorityMarker(localStorage, 'ABC123')
    ).toBeNull();
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      false
    );
    expect(getItem).not.toHaveBeenCalled();
  });

  it('rejects malformed and partial markers', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    const key = combatLogArchiveAuthorityKey('ABC123');
    const read = () =>
      readCombatLogArchiveAuthorityMarker(localStorage, 'ABC123');

    expect(read()).toBeNull();
    localStorage.setItem(key, '{bad');
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('ABC123', 'postgres'), version: 2 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('ABC123', 'postgres'), authority: 'redis' })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...marker('ABC123', 'postgres'), epoch: 1.5 })
    );
    expect(read()).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        campaignCode: 'ABC123',
        authority: 'postgres',
        epoch: 4,
      })
    );
    expect(read()).toBeNull();
    localStorage.setItem(key, JSON.stringify(marker('DEF456', 'postgres')));
    expect(read()).toBeNull();
    // A marker that cannot be parsed or validated never routes the family.
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      false
    );
    localStorage.setItem(key, '{bad');
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      false
    );
  });

  it('round-trips a written marker and classifies which authorities own the family', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    expect(combatLogArchiveAuthorityKey('ABC123')).toBe(
      'rollkeeper:combat-log-archive-authority:ABC123'
    );

    writeCombatLogArchiveAuthorityMarker(
      localStorage,
      marker('ABC123', 'postgres')
    );
    expect(readCombatLogArchiveAuthorityMarker(localStorage, 'ABC123')).toEqual(
      marker('ABC123', 'postgres')
    );
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      true
    );

    writeCombatLogArchiveAuthorityMarker(
      localStorage,
      marker('ABC123', 'indexedDB')
    );
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      true
    );

    writeCombatLogArchiveAuthorityMarker(
      localStorage,
      marker('ABC123', 'localStorage')
    );
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'ABC123')).toBe(
      false
    );
    expect(combatLogArchiveUsesIndexedDbAuthority(localStorage, 'DEF456')).toBe(
      false
    );
  });
});
