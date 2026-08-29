import { describe, expect, it } from 'vitest';

import { derivePlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import {
  EMPTY_RESULT,
  EMPTY_SAFETY,
  projectPlayerBackupManagement,
  projectPlayerBackupWizardView,
  type PlayerBackupWizardProjectionInput,
} from './PlayerBackupWizard.presentation';
import type { PlayerBackupCharacterRow } from './PlayerBackupWizard.types';

const CHARACTERS: PlayerBackupCharacterRow[] = [
  {
    id: 'aveline',
    name: 'Sister Aveline',
    archived: false,
    eligible: true,
    selected: true,
    statusLabel: COPY.selection.notProtected,
    note: 'Ready',
    tone: 'none',
  },
];

function capabilities(overrides: {
  lockAvailable?: boolean;
  manual?: boolean;
  cutover?: boolean;
  automatic?: boolean;
}) {
  return derivePlayerBackupCapabilities({
    wizardVisible: true,
    authConfigured: true,
    lockAvailable: overrides.lockAvailable ?? true,
    manual: overrides.manual ?? true,
    cutover: overrides.cutover ?? true,
    automatic: overrides.automatic ?? true,
  });
}

function input(
  overrides: Partial<PlayerBackupWizardProjectionInput> = {}
): PlayerBackupWizardProjectionInput {
  return {
    surface: 'wizard',
    step: 'selection',
    account: { signedIn: true, email: 'player@example.com', error: null },
    capabilities: capabilities({}),
    characters: CHARACTERS,
    safety: {
      ...EMPTY_SAFETY,
      receipt: 'checked',
      badgeLabel: COPY.safety.badgeChecked,
    },
    selection: { ongoingChecked: true, alert: null, selectedCount: 1 },
    result: EMPTY_RESULT,
    management: {
      title: COPY.management.title,
      summary: COPY.management.summary(0, 0, 0),
      rows: [],
      futureDefaultOn: false,
      futureDefaultEnabled: false,
    },
    recovery: {
      title: COPY.recovery.title,
      description: COPY.recovery.description,
    },
    liveStatus: null,
    busy: false,
    ...overrides,
  };
}

describe('projectPlayerBackupWizardView', () => {
  it('disables confirmation when exclusive lock support is missing', () => {
    const view = projectPlayerBackupWizardView(
      input({ capabilities: capabilities({ lockAvailable: false }) })
    );
    expect(view.selection.confirmEnabled).toBe(false);
    expect(view.selection.ongoingAvailable).toBe(false);
    expect(view.selection.confirmHint).toBe(COPY.selection.confirmUnavailable);
  });

  it('offers only one-time confirmation when automatic cloud is off', () => {
    const view = projectPlayerBackupWizardView(
      input({
        capabilities: capabilities({ automatic: false }),
        selection: { ongoingChecked: true, alert: null, selectedCount: 1 },
      })
    );
    expect(view.selection.ongoingAvailable).toBe(false);
    expect(view.selection.ongoingChecked).toBe(false);
    expect(view.selection.confirmLabel).toBe(COPY.selection.oneTimeButton);
    expect(view.selection.confirmEnabled).toBe(true);
  });

  it('keeps ongoing confirmation when every lower capability is on', () => {
    const view = projectPlayerBackupWizardView(input());
    expect(view.selection.ongoingAvailable).toBe(true);
    expect(view.selection.confirmLabel).toBe(COPY.selection.ongoingButton);
    expect(view.selection.confirmEnabled).toBe(true);
  });

  it('does not enable confirmation without a checked safety file', () => {
    const view = projectPlayerBackupWizardView(input({ safety: EMPTY_SAFETY }));
    expect(view.selection.confirmEnabled).toBe(false);
  });

  it('does not enable confirmation until the extra current-character file is checked', () => {
    const view = projectPlayerBackupWizardView(
      input({
        safety: {
          ...EMPTY_SAFETY,
          receipt: 'checked',
          extraFileRequired: true,
          extraChecked: false,
        },
      })
    );
    expect(view.selection.confirmEnabled).toBe(false);
  });

  it('does not enable confirmation when no character is selected', () => {
    const view = projectPlayerBackupWizardView(
      input({
        selection: { ongoingChecked: true, alert: null, selectedCount: 0 },
      })
    );
    expect(view.selection.confirmEnabled).toBe(false);
    expect(view.selection.confirmHint).toBe(COPY.selection.noSelection);
  });

  it('disables the selection footer so the consent card stays the only confirm control', () => {
    const view = projectPlayerBackupWizardView(input());
    expect(view.footer.nextLabel).toBe('Review and confirm');
    expect(view.footer.nextDisabled).toBe(true);
  });
});

describe('projectPlayerBackupManagement', () => {
  it('enables pause and restore when the matching capabilities are on', () => {
    const management = projectPlayerBackupManagement({
      characters: CHARACTERS,
      result: {
        ...EMPTY_RESULT,
        rows: [
          {
            id: 'aveline',
            name: 'Sister Aveline',
            statusLabel: COPY.selection.alreadyProtected,
            note: 'Kept up to date.',
            tone: 'ok',
          },
        ],
        conflicts: [],
      },
      futureDefaultOn: true,
      futureDefaultEnabled: true,
      manualMutation: true,
      automaticMutation: true,
      cloudLegacyIds: ['aveline'],
    });
    expect(management.futureDefaultEnabled).toBe(true);
    expect(management.rows[0]?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'pause', enabled: true }),
        expect.objectContaining({ action: 'remove', enabled: true }),
      ])
    );
  });

  it('keeps choose enabled for conflicted rows', () => {
    const management = projectPlayerBackupManagement({
      characters: CHARACTERS,
      result: {
        ...EMPTY_RESULT,
        rows: [
          {
            id: 'aveline',
            name: 'Sister Aveline',
            statusLabel: 'Protected',
            note: 'Kept up to date.',
            tone: 'ok',
          },
        ],
        conflicts: [
          {
            conflictId: 'conflict-aveline',
            legacyId: 'aveline',
            applicationLegacyId: 'aveline',
            name: 'Sister Aveline',
            description: COPY.conflict.description,
            pendingApplication: true,
            choices: [],
          },
        ],
      },
      futureDefaultOn: true,
    });
    expect(management.rows[0]?.actions[0]).toMatchObject({
      action: 'choose',
      enabled: true,
    });
  });

  it('does not let a stale protected result hide a current future-format row', () => {
    const management = projectPlayerBackupManagement({
      characters: [
        {
          ...CHARACTERS[0]!,
          statusLabel: 'Review needed first',
          note: COPY.conflict.futureDescription,
          tone: 'warn',
          cloudState: 'future',
        },
      ],
      cloudLegacyIds: ['aveline'],
      result: {
        ...EMPTY_RESULT,
        rows: [
          {
            id: 'aveline',
            name: 'Sister Aveline',
            statusLabel: 'Protected',
            note: 'Read back and matched.',
            tone: 'ok',
          },
        ],
      },
      futureDefaultOn: false,
      manualMutation: true,
    });

    expect(management.summary).toContain('1 needs attention');
    expect(management.rows[0]).toMatchObject({
      statusLabel: 'Review needed first',
      note: expect.stringContaining('newer RollKeeper version'),
      tone: 'warn',
    });
    expect(management.rows[0]?.actions).toEqual([
      expect.objectContaining({
        action: 'download-recovery',
        enabled: true,
      }),
    ]);
  });

  it('merges online-only copies and disables cloud actions without a cloud row', () => {
    const management = projectPlayerBackupManagement({
      characters: CHARACTERS,
      onlineOnly: [
        {
          id: 'cloud-only',
          name: 'Online Only',
          state: 'available',
        },
      ],
      cloudLegacyIds: ['cloud-only'],
      result: EMPTY_RESULT,
      futureDefaultOn: false,
      manualMutation: true,
      automaticMutation: true,
    });
    const local = management.rows.find(row => row.id === 'aveline');
    const online = management.rows.find(row => row.id === 'cloud-only');
    expect(online).toMatchObject({
      id: 'cloud-only',
      name: 'Online Only',
    });
    expect(online?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'restore-here', enabled: true }),
        expect.objectContaining({ action: 'remove', enabled: true }),
      ])
    );
    expect(local?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'restore-here',
          enabled: false,
        }),
        expect.objectContaining({ action: 'remove', enabled: false }),
        expect.objectContaining({
          action: 'download-recovery',
          enabled: false,
        }),
      ])
    );
  });

  it('keeps removed and future online-only copies distinct', () => {
    const management = projectPlayerBackupManagement({
      characters: [],
      onlineOnly: [
        { id: 'removed', name: 'Removed', state: 'removed' },
        { id: 'future', name: 'Future', state: 'future' },
      ],
      cloudLegacyIds: ['removed', 'future'],
      result: EMPTY_RESULT,
      futureDefaultOn: false,
      manualMutation: true,
      automaticMutation: true,
    });
    const removed = management.rows.find(row => row.id === 'removed');
    const future = management.rows.find(row => row.id === 'future');
    expect(removed?.statusLabel).toBe(COPY.selection.removed);
    expect(removed?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'restore-here', enabled: true }),
        expect.objectContaining({ action: 'remove', enabled: false }),
      ])
    );
    expect(future?.statusLabel).toBe(COPY.selection.unavailable);
    expect(future?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'restore-here', enabled: false }),
        expect.objectContaining({
          action: 'download-recovery',
          enabled: true,
        }),
        expect.objectContaining({ action: 'remove', enabled: false }),
      ])
    );
  });
});
