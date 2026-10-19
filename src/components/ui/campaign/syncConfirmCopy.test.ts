import { describe, expect, it } from 'vitest';

import { SYNC_FAMILIES, syncConfirm } from './syncConfirmCopy';

describe('syncConfirm copy', () => {
  it('reads naturally for plural and singular data types', () => {
    expect(syncConfirm.turnOnBackup(SYNC_FAMILIES.npcs)).toMatchObject({
      title: 'Turn on backup for NPCs?',
      message: 'They are copied to your account.',
    });
    expect(syncConfirm.turnOnBackup(SYNC_FAMILIES.calendar)).toMatchObject({
      title: 'Turn on backup for the calendar?',
      message: 'It is copied to your account.',
    });
    expect(syncConfirm.stopBackup(SYNC_FAMILIES.calendar).title).toBe(
      'Stop backing up the calendar?'
    );
    expect(
      syncConfirm.selectFamily(SYNC_FAMILIES.calendar, 'Ashfall').confirmLabel
    ).toBe('Continue with the calendar');
  });

  it('counts documents where a data type has several', () => {
    expect(syncConfirm.loadFromAccount(SYNC_FAMILIES.combatLogs, 1).title).toBe(
      'Load 1 combat log from your account?'
    );
    expect(
      syncConfirm.loadFromAccount(SYNC_FAMILIES.encounters, 3)
    ).toMatchObject({
      title: 'Load 3 encounters from your account?',
      message:
        "They replace the encounters on this browser. Work that hasn't been backed up stops this.",
      tone: 'danger',
    });
    expect(syncConfirm.loadFromAccount(SYNC_FAMILIES.calendar)).toMatchObject({
      title: 'Load the calendar from your account?',
      message:
        "It replaces the calendar on this browser. Work that hasn't been backed up stops this.",
    });
  });

  it('uses "It" when loading a single document of a plural type', () => {
    expect(syncConfirm.loadFromAccount(SYNC_FAMILIES.npcs, 1).message).toBe(
      "It replaces the NPCs on this browser. Work that hasn't been backed up stops this."
    );
  });

  it('shortens fingerprints to a 12-character reference', () => {
    expect(
      syncConfirm.switchStorage(SYNC_FAMILIES.magicItems, 'abcdef0123456789')
        .message
    ).toBe('Your safety copy is already saved. Reference: abcdef012345');
    expect(syncConfirm.addBrowser('0123456789abcdef').message).toMatch(
      /Reference: 0123456789ab$/
    );
  });

  it('names the account and marks removals as destructive', () => {
    expect(
      syncConfirm.removeFromBrowser(SYNC_FAMILIES.campaignSettings, 'Ana')
    ).toMatchObject({
      title: "Remove Ana's campaign settings from this browser?",
      tone: 'danger',
    });
    expect(syncConfirm.unbackedWork().tone).toBe('danger');
    expect(syncConfirm.deleteCombatLog().tone).toBe('danger');
    expect(syncConfirm.restoreVersion(4).tone).toBeUndefined();
  });
});
