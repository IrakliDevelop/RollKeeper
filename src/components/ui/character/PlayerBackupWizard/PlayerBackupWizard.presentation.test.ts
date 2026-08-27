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
  it('groups durable results and leaves pause/resume/remove disabled', () => {
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
            name: 'Sister Aveline',
            description: COPY.conflict.description,
            pendingApplication: true,
            choices: [],
          },
        ],
      },
      futureDefaultOn: true,
    });
    expect(management.futureDefaultEnabled).toBe(false);
    expect(management.rows[0]?.actions[0]).toMatchObject({
      action: 'choose',
      enabled: true,
    });
    expect(
      management.rows
        .flatMap(row => row.actions)
        .filter(action => action.action === 'pause')
    ).toEqual([]);
  });
});
