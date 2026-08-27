import { describe, expect, it } from 'vitest';

import {
  PLAYER_BACKUP_COPY,
  confirmationCopy,
  degradedCharacterCopy,
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
