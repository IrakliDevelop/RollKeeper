import { describe, expect, it } from 'vitest';

import { SIGNED_IN_ACCOUNT_LABEL } from '@/lib/supabase/accountLabel';

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
        "They replace the encounters on this browser. If this browser has changes that aren't backed up, nothing is loaded.",
      tone: 'danger',
    });
    expect(syncConfirm.loadFromAccount(SYNC_FAMILIES.calendar)).toMatchObject({
      title: 'Load the calendar from your account?',
      message:
        "It replaces the calendar on this browser. If this browser has changes that aren't backed up, nothing is loaded.",
    });
  });

  it('uses "It" when loading a single document of a plural type', () => {
    expect(syncConfirm.loadFromAccount(SYNC_FAMILIES.npcs, 1).message).toBe(
      "It replaces the NPCs on this browser. If this browser has changes that aren't backed up, nothing is loaded."
    );
  });

  it('shortens fingerprints to a 12-character reference', () => {
    expect(
      syncConfirm.switchStorage(SYNC_FAMILIES.magicItems, 'abcdef0123456789')
        .message
    ).toBe('Your safety copy is already saved. Reference: abcdef012345');
    expect(
      syncConfirm.addBrowser(SYNC_FAMILIES.npcs, '0123456789abcdef')
    ).toMatchObject({
      title: 'Add this browser to the backup for NPCs?',
      message:
        'The NPCs on this browser are kept and never uploaded on their own. Reference: 0123456789ab',
    });
    expect(
      syncConfirm.addBrowser(SYNC_FAMILIES.calendar, '0123456789abcdef').message
    ).toBe(
      'The calendar on this browser is kept and never uploaded on its own. Reference: 0123456789ab'
    );
  });

  it('names the data and the account, and marks removals as destructive', () => {
    expect(
      syncConfirm.removeFromBrowser(
        SYNC_FAMILIES.campaignSettings,
        'ana@example.test'
      )
    ).toMatchObject({
      title: 'Remove the campaign settings from this browser?',
      message: 'Your account (ana@example.test) keeps everything.',
      tone: 'danger',
    });
    expect(
      syncConfirm.removeFromBrowser(
        SYNC_FAMILIES.calendar,
        SIGNED_IN_ACCOUNT_LABEL
      ).message
    ).toBe('Your account keeps everything.');
    expect(syncConfirm.unbackedWork().tone).toBe('danger');
    expect(syncConfirm.deleteCombatLog().tone).toBe('danger');
    expect(syncConfirm.restoreVersion(4).tone).toBeUndefined();
  });
});
