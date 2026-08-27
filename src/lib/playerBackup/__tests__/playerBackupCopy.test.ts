import { describe, expect, it } from 'vitest';

import {
  PLAYER_BACKUP_COPY,
  confirmationCopy,
  dashboardOngoingDescription,
  dashboardOneTimeDescription,
  degradedCharacterCopy,
  managementRemoveConfirm,
  managementSummaryCopy,
  mapPlayerBackupError,
  safetyFileCopy,
} from '../playerBackupCopy';

describe('player backup copy', () => {
  it('claims broad-file character coverage only when it is proved', () => {
    expect(
      safetyFileCopy({ authority: 'active', mirrorParityProved: true })
    ).toMatchObject({ requiresCurrentCharacterFile: false });
    const stale = safetyFileCopy({
      authority: 'active',
      mirrorParityProved: false,
    });
    expect(stale.requiresCurrentCharacterFile).toBe(true);
    expect(stale.description).toBe(
      PLAYER_BACKUP_COPY.safety.extraFileDescription
    );
  });

  it('mentions preparation only for the integrated legacy path', () => {
    expect(
      confirmationCopy({
        mode: 'ongoing',
        count: 2,
        email: 'hero@example.com',
        integratedLocalPath: true,
        authority: 'legacy',
      })
    ).toContain('prepare character saving');
    expect(
      confirmationCopy({
        mode: 'one-time',
        count: 2,
        email: 'hero@example.com',
        integratedLocalPath: false,
        authority: 'legacy',
      })
    ).not.toContain('prepare character saving');
    expect(
      confirmationCopy({
        mode: 'ongoing',
        count: 2,
        email: 'hero@example.com',
        integratedLocalPath: true,
        authority: 'active',
      })
    ).not.toContain('prepare character saving');
  });

  it.each(['ongoing', 'one-time'] as const)(
    'uses singular confirmation copy for one %s character',
    mode => {
      const copy = confirmationCopy({
        mode,
        count: 1,
        email: 'hero@example.com',
        integratedLocalPath: true,
        authority: 'legacy',
      });
      expect(copy).toContain('1 selected character');
      expect(copy).not.toContain('1 selected characters');
    }
  );

  it.each(['different', 'newer', 'removed', 'unavailable', 'future'] as const)(
    'makes degraded %s rows unavailable and unchecked',
    state => {
      expect(degradedCharacterCopy(state)).toMatchObject({
        selectable: false,
        selected: false,
        status: 'Review needed first',
      });
    }
  );

  it('uses the six approved dashboard states and exact action labels', () => {
    expect(PLAYER_BACKUP_COPY.dashboard.notStarted).toEqual({
      title: 'Protect your characters',
      description:
        'Save a safety file, choose your characters, and protect them with your account.',
      action: 'Back up my characters online',
    });
    expect(PLAYER_BACKUP_COPY.dashboard.title).toBe(
      PLAYER_BACKUP_COPY.dashboard.notStarted.title
    );
    expect(PLAYER_BACKUP_COPY.dashboard.action).toBe(
      PLAYER_BACKUP_COPY.dashboard.notStarted.action
    );
    expect(PLAYER_BACKUP_COPY.dashboard.resumable).toEqual({
      title: 'Character backup is not finished',
      description:
        'Your completed steps are still safe. Continue when you are ready.',
      action: 'Continue character backup',
    });
    expect(PLAYER_BACKUP_COPY.dashboard.ongoing.title).toBe(
      'Online backup is on'
    );
    expect(PLAYER_BACKUP_COPY.dashboard.oneTime.title).toBe(
      'Online copies saved'
    );
    expect(PLAYER_BACKUP_COPY.dashboard.noCharacters).toEqual({
      title: 'No characters to back up',
      description: 'Create a character or restore one from a backup first.',
      action: 'Create a character',
      secondary: 'Restore characters',
    });
    expect(PLAYER_BACKUP_COPY.dashboard.unavailable).toEqual({
      title: 'Online backup is unavailable right now',
      description:
        'Your characters are still safe in this browser. You can save or restore a safety file.',
      action: 'Save a safety file',
      secondary: 'Restore characters',
    });
    expect(PLAYER_BACKUP_COPY.dashboard.manage).toBe('Manage backups');
    expect(PLAYER_BACKUP_COPY.dashboard.restore).toBe('Restore characters');
  });

  it('uses singular and plural dashboard and management count copy', () => {
    expect(dashboardOngoingDescription(1, 1)).toBe(
      '1 character is protected. 1 needs attention.'
    );
    expect(dashboardOngoingDescription(3, 2)).toBe(
      '3 characters are protected. 2 need attention.'
    );
    expect(dashboardOneTimeDescription(1)).toBe(
      '1 character was saved online. Later changes stay in this browser until you back up again.'
    );
    expect(dashboardOneTimeDescription(4)).toBe(
      '4 characters were saved online. Later changes stay in this browser until you back up again.'
    );
    expect(dashboardOneTimeDescription(0, 2)).toBe(
      '2 characters are paused. Existing local and online copies were kept.'
    );
    expect(managementSummaryCopy(1, 1, 1)).toBe(
      '1 protected, 1 paused, 1 needs attention'
    );
    expect(managementSummaryCopy(3, 2, 2)).toBe(
      '3 protected, 2 paused, 2 need attention'
    );
  });

  it('states that soft archive keeps the local character and recoverable online copy', () => {
    expect(managementRemoveConfirm('Lyra')).toBe(
      'Remove the online copy of Lyra? The character in this browser will stay. RollKeeper keeps the removed online copy available for recovery.'
    );
    expect(PLAYER_BACKUP_COPY.management.removeSuccess).toBe(
      'The online copy was removed. The character in this browser was not changed.'
    );
    expect(PLAYER_BACKUP_COPY.management.pauseSuccess).toBe(
      'Online updates are paused. Existing local and online copies were kept.'
    );
    expect(PLAYER_BACKUP_COPY.management.resumeSuccess).toBe(
      'Online backup is on again.'
    );
  });

  it('maps unknown lower-layer errors without rendering their text', () => {
    const raw = new Error('IndexedDB schema mutation failed');
    expect(mapPlayerBackupError('local', raw)).toBe(
      PLAYER_BACKUP_COPY.errors.local
    );
    expect(mapPlayerBackupError('account', raw)).toBe(
      PLAYER_BACKUP_COPY.errors.account
    );
    expect(mapPlayerBackupError('online', raw)).not.toContain(raw.message);
  });
});
