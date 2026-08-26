import { describe, expect, it } from 'vitest';

import {
  PLAYER_BACKUP_FLOW_STATES,
  projectCharacterBackupStatus,
  projectPlayerBackupStatus,
} from '../playerBackupStatus';

describe('player backup status projection', () => {
  it('projects every durable flow state to one plain status', () => {
    const keys = PLAYER_BACKUP_FLOW_STATES.map(
      kind => projectPlayerBackupStatus({ kind }).key
    );
    expect(keys).toHaveLength(PLAYER_BACKUP_FLOW_STATES.length);
    expect(new Set(keys).size).toBe(PLAYER_BACKUP_FLOW_STATES.length);
  });

  it('does not collapse one-time or paused copies into not backed up', () => {
    expect(
      projectCharacterBackupStatus({ acknowledged: true, preference: 'off' })
        .key
    ).toBe('saved-once');
    expect(
      projectCharacterBackupStatus({
        acknowledged: true,
        preference: 'off',
        explicitlyPaused: true,
      }).key
    ).toBe('paused');
  });

  it('prioritizes held-aside, conflict, sign-in, offline, and waiting evidence', () => {
    expect(projectCharacterBackupStatus({ heldAside: true }).key).toBe(
      'held-aside'
    );
    expect(projectCharacterBackupStatus({ conflict: true }).key).toBe(
      'needs-attention'
    );
    expect(projectCharacterBackupStatus({ authRequired: true }).key).toBe(
      'sign-in-required'
    );
    expect(projectCharacterBackupStatus({ offline: true }).key).toBe('offline');
    expect(projectCharacterBackupStatus({ queued: true }).key).toBe('queued');
  });
});
