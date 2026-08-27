import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { confirmationCopy } from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupCharacterRow,
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from './PlayerBackupWizard.types';

export const PLAYER_BACKUP_WIZARD_SCENARIOS = [
  'signed-out',
  'account-ready',
  'account-check-failed',
  'safety-file-needed',
  'safety-file-checked',
  'wrong-file',
  'file-still-matches',
  'choose-characters',
  'one-copy-only',
  'account-changed',
  'backing-up',
  'result-protected',
  'result-copies-saved',
  'result-needs-attention',
  'result-offline',
  'conflict-choice',
  'needs-newer-version',
  'manage-backups',
  'recovery-required',
] as const;

export type PlayerBackupWizardScenario =
  (typeof PLAYER_BACKUP_WIZARD_SCENARIOS)[number];

const EMAIL = 'player@example.com';

const CHARACTERS: PlayerBackupCharacterRow[] = [
  {
    id: 'aveline',
    name: 'Sister Aveline',
    archived: false,
    eligible: true,
    selected: true,
    statusLabel: COPY.selection.notProtected,
    note: 'Ready to protect with this account.',
    tone: 'none',
  },
  {
    id: 'thalia',
    name: 'Thalia Reed',
    archived: true,
    eligible: true,
    selected: true,
    statusLabel: COPY.selection.notProtected,
    note: 'Archived in this browser. Still available to protect.',
    tone: 'none',
  },
  {
    id: 'roderick',
    name: 'Sir Roderick',
    archived: false,
    eligible: false,
    selected: false,
    statusLabel: COPY.selection.unavailable,
    note: COPY.selection.unavailableDescription,
    tone: 'bad',
  },
];

function rail(
  step: PlayerBackupWizardView['step']
): PlayerBackupWizardView['rail'] {
  const order: PlayerBackupWizardView['step'][] = [
    'account',
    'safety',
    'selection',
    'result',
  ];
  const labels = ['Account', 'Safety file', 'Characters', 'Result'] as const;
  const current = order.indexOf(step);
  return order.map((key, index) => {
    const state = index < current ? 'done' : index === current ? 'now' : 'todo';
    const statusLabel =
      key === 'account' && index < current
        ? 'ready'
        : key === 'safety' && index < current
          ? 'checked'
          : key === 'selection' && index < current
            ? '2 chosen'
            : state === 'now'
              ? 'now'
              : '';
    return { key, label: labels[index], statusLabel, state };
  });
}

function footer(
  step: PlayerBackupWizardView['step'],
  nextDisabled: boolean,
  nextLabel: string
): PlayerBackupWizardView['footer'] {
  const index = ['account', 'safety', 'selection', 'result'].indexOf(step);
  const done = step === 'result';
  return {
    progressText: done ? 'Setup finished' : `Step ${index + 1} of 3`,
    progressNote: done
      ? 'Every character is reported on its own.'
      : 'Nothing is copied before the last step.',
    progressPercent: done ? 100 : Math.round(((index + 1) / 3) * 100),
    backLabel: 'Back',
    nextLabel,
    nextDisabled,
  };
}

function baseView(): PlayerBackupWizardView {
  return {
    surface: 'wizard',
    step: 'account',
    pageTitle: COPY.dashboard.action,
    headerNote: COPY.account.signedOut,
    dialogTitle: COPY.dashboard.action,
    dialogDescription: `${COPY.dashboard.description} Nothing is copied until you confirm, and nothing is ever deleted.`,
    compactStepLabel: COPY.account.eyebrow,
    rail: rail('account'),
    railCharacters: CHARACTERS.map(character => ({
      id: character.id,
      name: character.name,
      included: character.selected,
    })),
    characters: CHARACTERS,
    account: {
      statusLine: COPY.account.signedOut,
      statusDetail: COPY.account.signedOutDetail,
      actionLabel: COPY.account.signedOutAction,
      signedIn: false,
      error: null,
    },
    safety: {
      description: COPY.safety.description,
      receipt: 'needed',
      badgeLabel: COPY.safety.badgeNeeded,
      extraFileRequired: false,
      extraChecked: false,
      preparing: false,
      checking: false,
      pickedFileName: null,
      extraPickedFileName: null,
    },
    selection: {
      ongoingAvailable: true,
      ongoingChecked: true,
      confirmEnabled: true,
      confirmLabel: COPY.selection.ongoingButton,
      confirmBody: confirmationCopy({
        mode: 'ongoing',
        count: 2,
        email: EMAIL,
        integratedLocalPath: true,
        authority: 'legacy',
      }),
      confirmHint: COPY.selection.confirmHint,
      alert: null,
    },
    result: {
      title: COPY.result.protectedTitle,
      headline: COPY.result.ongoingComplete(2),
      body: 'New characters will also be protected unless you turn backup off for them.',
      tone: 'ok',
      rows: [],
      conflicts: [],
      heldAside: [],
      continueSetup: false,
      closeSafe: false,
    },
    management: {
      title: COPY.management.title,
      summary: COPY.management.summary(1, 1, 1),
      rows: [],
      futureDefaultOn: true,
      futureDefaultEnabled: false,
    },
    recovery: {
      title: COPY.recovery.title,
      description: COPY.recovery.description,
    },
    footer: footer('account', true, 'Continue'),
    liveStatus: null,
    busy: false,
  };
}

function resultRows(
  kind:
    | 'running'
    | 'protected'
    | 'once'
    | 'partial'
    | 'offline'
    | 'conflict'
    | 'future'
): PlayerBackupWizardView['result']['rows'] {
  const protectedNote =
    kind === 'once'
      ? 'One online copy saved and checked. Later changes stay here.'
      : 'Read back from your account and matches this browser';
  return [
    {
      id: 'aveline',
      name: 'Sister Aveline',
      statusLabel:
        kind === 'partial' || kind === 'conflict'
          ? 'Needs attention'
          : kind === 'running'
            ? 'Protected'
            : kind === 'once'
              ? 'Saved online once'
              : 'Protected',
      note:
        kind === 'partial' || kind === 'conflict'
          ? 'A different online copy exists. Both versions were kept.'
          : protectedNote,
      tone: kind === 'partial' || kind === 'conflict' ? 'warn' : 'ok',
    },
    {
      id: 'thalia',
      name: 'Thalia Reed',
      statusLabel:
        kind === 'running'
          ? 'Backing up'
          : kind === 'offline'
            ? 'Waiting'
            : kind === 'once'
              ? 'Saved online once'
              : 'Protected',
      note:
        kind === 'running'
          ? 'Copying to your account'
          : kind === 'offline'
            ? 'Will be backed up when the connection is ready'
            : protectedNote,
      tone: kind === 'running' || kind === 'offline' ? 'info' : 'ok',
    },
    {
      id: 'roderick',
      name: 'Sir Roderick',
      statusLabel:
        kind === 'future'
          ? 'Needs a newer version'
          : kind === 'partial'
            ? 'Waiting'
            : COPY.selection.unavailable,
      note:
        kind === 'future'
          ? 'Nothing was replaced. A recovery copy is available.'
          : kind === 'partial'
            ? 'Will be backed up when the connection is ready'
            : COPY.selection.unavailableDescription,
      tone: kind === 'future' || kind === 'partial' ? 'warn' : 'bad',
    },
  ];
}

export function createPlayerBackupWizardFixture(
  scenario: PlayerBackupWizardScenario
): PlayerBackupWizardView {
  const view = baseView();
  switch (scenario) {
    case 'signed-out':
      return view;
    case 'account-ready':
      return {
        ...view,
        headerNote: COPY.account.signedIn(EMAIL),
        account: {
          statusLine: COPY.account.signedIn(EMAIL),
          statusDetail: COPY.account.signedInDetail,
          actionLabel: COPY.account.recheck,
          signedIn: true,
          error: null,
        },
        footer: footer('account', false, 'Continue'),
      };
    case 'account-check-failed':
      return {
        ...view,
        account: {
          ...view.account,
          error: COPY.errors.account,
        },
        liveStatus: COPY.errors.account,
      };
    case 'safety-file-needed':
      return {
        ...view,
        step: 'safety',
        compactStepLabel: COPY.safety.eyebrow,
        rail: rail('safety'),
        headerNote: COPY.account.signedIn(EMAIL),
        footer: footer('safety', true, 'Continue'),
      };
    case 'safety-file-checked':
      return {
        ...view,
        step: 'safety',
        compactStepLabel: COPY.safety.eyebrow,
        rail: rail('safety'),
        headerNote: COPY.account.signedIn(EMAIL),
        safety: {
          ...view.safety,
          receipt: 'checked',
          badgeLabel: COPY.safety.badgeChecked,
        },
        footer: footer('safety', false, 'Continue'),
      };
    case 'wrong-file':
      return {
        ...view,
        step: 'safety',
        compactStepLabel: COPY.safety.eyebrow,
        rail: rail('safety'),
        headerNote: COPY.account.signedIn(EMAIL),
        safety: {
          ...view.safety,
          receipt: 'mismatch',
          badgeLabel: COPY.safety.badgeMismatch,
          pickedFileName: 'other-file.json',
        },
        liveStatus: COPY.safety.mismatchTitle,
        footer: footer('safety', true, 'Continue'),
      };
    case 'file-still-matches':
      return {
        ...view,
        step: 'safety',
        compactStepLabel: COPY.safety.eyebrow,
        rail: rail('safety'),
        headerNote: COPY.account.signedIn(EMAIL),
        safety: {
          ...view.safety,
          receipt: 'still-matches',
          badgeLabel: COPY.safety.badgeStillMatches,
        },
        footer: footer('safety', false, 'Continue'),
      };
    case 'choose-characters':
      return {
        ...view,
        step: 'selection',
        compactStepLabel: COPY.selection.eyebrow,
        rail: rail('selection'),
        headerNote: COPY.account.signedIn(EMAIL),
        footer: footer('selection', false, 'Review and confirm'),
      };
    case 'one-copy-only':
      return {
        ...view,
        step: 'selection',
        compactStepLabel: COPY.selection.eyebrow,
        rail: rail('selection'),
        headerNote: COPY.account.signedIn(EMAIL),
        selection: {
          ...view.selection,
          ongoingChecked: false,
          confirmLabel: COPY.selection.oneTimeButton,
          confirmBody: confirmationCopy({
            mode: 'one-time',
            count: 2,
            email: EMAIL,
            integratedLocalPath: true,
            authority: 'legacy',
          }),
        },
        footer: footer('selection', false, 'Review and confirm'),
      };
    case 'account-changed':
      return {
        ...view,
        step: 'selection',
        compactStepLabel: COPY.selection.eyebrow,
        rail: rail('selection'),
        headerNote: COPY.account.signedIn(EMAIL),
        selection: {
          ...view.selection,
          confirmEnabled: false,
          alert: COPY.selection.accountChanged,
        },
        liveStatus: COPY.selection.accountChanged,
        footer: footer('selection', true, 'Review and confirm'),
      };
    case 'backing-up':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          title: COPY.result.backingUpTitle,
          headline: COPY.result.backingUpHeadline(2),
          body: COPY.result.backingUpBody,
          tone: 'info',
          rows: resultRows('running'),
          closeSafe: true,
        },
        liveStatus: COPY.result.backingUpHeadline(2),
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'result-protected':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          rows: resultRows('protected'),
          closeSafe: true,
        },
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'result-copies-saved':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          headline: COPY.result.oneTimeComplete(2),
          body: 'Later changes stay in this browser until you back up again.',
          rows: resultRows('once'),
          closeSafe: true,
        },
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'result-needs-attention':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          title: COPY.result.partialTitle,
          headline: COPY.result.partialDescription(1, 1),
          body: 'Nothing was deleted. You can retry only the characters that need attention.',
          tone: 'warn',
          rows: resultRows('partial'),
          closeSafe: true,
        },
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'result-offline':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          title: COPY.result.offlineTitle,
          headline: COPY.result.offlineHeadline,
          body: COPY.result.offlineBody,
          tone: 'warn',
          rows: resultRows('offline'),
          closeSafe: true,
        },
        liveStatus: COPY.result.offlineHeadline,
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'conflict-choice':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          title: COPY.result.partialTitle,
          headline: 'One character has two versions',
          body: COPY.conflict.description,
          tone: 'warn',
          rows: resultRows('conflict'),
          closeSafe: true,
          conflicts: [
            {
              conflictId: 'conflict-aveline',
              legacyId: 'aveline',
              name: 'Sister Aveline',
              description: COPY.conflict.description,
              pendingApplication: false,
              choices: [
                {
                  resolution: 'keep-mine',
                  label: COPY.conflict.keepMine,
                  body: COPY.conflict.keepMineBody,
                  enabled: true,
                },
                {
                  resolution: 'use-cloud',
                  label: COPY.conflict.useOnline,
                  body: COPY.conflict.useOnlineBody,
                  enabled: true,
                },
                {
                  resolution: 'keep-both',
                  label: COPY.conflict.keepBoth,
                  body: COPY.conflict.keepBothBody,
                  enabled: true,
                },
              ],
            },
          ],
        },
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'needs-newer-version':
      return {
        ...view,
        step: 'result',
        compactStepLabel: COPY.result.eyebrow,
        rail: rail('result'),
        headerNote: COPY.account.signedIn(EMAIL),
        result: {
          ...view.result,
          title: COPY.result.partialTitle,
          headline: 'One online copy could not be read safely',
          body: 'Nothing was replaced. Your characters in this browser are unchanged.',
          tone: 'warn',
          rows: resultRows('future'),
          closeSafe: true,
          heldAside: [
            {
              legacyId: 'roderick',
              name: 'Sir Roderick',
              recoveryAvailable: true,
            },
          ],
        },
        footer: footer('result', false, COPY.chrome.manage),
      };
    case 'manage-backups':
      return {
        ...view,
        surface: 'manage',
        step: 'result',
        pageTitle: COPY.dashboard.action,
        headerNote: COPY.account.signedIn(EMAIL),
        compactStepLabel: COPY.management.title,
        management: {
          title: COPY.management.title,
          summary: COPY.management.summary(1, 1, 1),
          futureDefaultOn: true,
          futureDefaultEnabled: false,
          rows: [
            {
              id: 'aveline',
              name: 'Sister Aveline',
              statusLabel: 'Protected',
              note: 'Kept up to date.',
              tone: 'ok',
              actions: [
                {
                  label: COPY.management.pause,
                  enabled: false,
                  action: 'pause',
                },
              ],
            },
            {
              id: 'thalia',
              name: 'Thalia Reed',
              statusLabel: COPY.selection.paused,
              note: 'Both copies were kept. Updates are not being sent.',
              tone: 'info',
              actions: [
                {
                  label: COPY.management.resume,
                  enabled: false,
                  action: 'resume',
                },
              ],
            },
            {
              id: 'roderick',
              name: 'Sir Roderick',
              statusLabel: 'Needs attention',
              note: 'Two versions are waiting for your choice. Nothing was discarded.',
              tone: 'warn',
              actions: [
                {
                  label: COPY.conflict.title,
                  enabled: true,
                  action: 'choose',
                },
              ],
            },
          ],
        },
      };
    case 'recovery-required':
      return {
        ...view,
        surface: 'recovery',
        step: 'result',
        pageTitle: 'Recovery',
        headerNote: 'Nothing was changed while this is open',
        compactStepLabel: COPY.recovery.title,
      };
  }
}

export function createIdlePlayerBackupWizardActions(
  overrides: Partial<PlayerBackupWizardActions> = {}
): PlayerBackupWizardActions {
  const idle = () => undefined;
  return {
    onClose: idle,
    onBack: idle,
    onNext: idle,
    onSignIn: idle,
    onCheckAccount: idle,
    onSaveSafetyFile: idle,
    onChooseSafetyFile: idle,
    onSaveCurrentCharacterFile: idle,
    onChooseCurrentCharacterFile: idle,
    onToggleCharacter: idle,
    onSelectAll: idle,
    onClearAll: idle,
    onToggleOngoing: idle,
    onConfirm: idle,
    onContinueSetup: idle,
    onCheckNow: idle,
    onResolveConflict: idle,
    onApplyPending: idle,
    onProtectMore: idle,
    onOpenRecovery: idle,
    onOpenManage: idle,
    onDownloadRecoveryCopy: idle,
    ...overrides,
  };
}
