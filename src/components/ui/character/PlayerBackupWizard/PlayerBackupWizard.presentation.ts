import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import {
  confirmationCopy,
  degradedCharacterCopy,
} from '@/lib/playerBackup/playerBackupCopy';
import type { PlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';

import type {
  PlayerBackupCharacterRow,
  PlayerBackupWizardStep,
  PlayerBackupWizardSurface,
  PlayerBackupWizardView,
} from './PlayerBackupWizard.types';

export interface PlayerBackupWizardProjectionInput {
  surface: PlayerBackupWizardSurface;
  step: PlayerBackupWizardStep;
  account: {
    signedIn: boolean;
    email: string | null;
    error: string | null;
  };
  capabilities: PlayerBackupCapabilities;
  characters: PlayerBackupCharacterRow[];
  safety: PlayerBackupWizardView['safety'];
  selection: {
    ongoingChecked: boolean;
    alert: string | null;
    selectedCount: number;
  };
  result: PlayerBackupWizardView['result'];
  management: PlayerBackupWizardView['management'];
  recovery: PlayerBackupWizardView['recovery'];
  liveStatus: string | null;
  actionError?: string | null;
  busy: boolean;
}

function rail(step: PlayerBackupWizardStep): PlayerBackupWizardView['rail'] {
  const order: PlayerBackupWizardStep[] = [
    'account',
    'safety',
    'selection',
    'result',
  ];
  const labels = ['Account', 'Safety file', 'Characters', 'Result'] as const;
  const current = order.indexOf(step);
  return order.map((key, index) => ({
    key,
    label: labels[index],
    statusLabel:
      index < current
        ? key === 'account'
          ? 'ready'
          : key === 'safety'
            ? 'checked'
            : key === 'selection'
              ? 'chosen'
              : ''
        : index === current
          ? 'now'
          : '',
    state: index < current ? 'done' : index === current ? 'now' : 'todo',
  }));
}

export function projectPlayerBackupWizardView(
  input: PlayerBackupWizardProjectionInput
): PlayerBackupWizardView {
  const email = input.account.email ?? 'your account';
  const signedIn = input.account.signedIn;
  const lockOk = input.capabilities.calls.confirm;
  const ongoingAvailable =
    lockOk && input.capabilities.modes.includes('ongoing');
  const oneTimeOnly =
    lockOk &&
    input.capabilities.modes.length === 1 &&
    input.capabilities.modes[0] === 'one-time';
  const ongoingChecked = ongoingAvailable && input.selection.ongoingChecked;
  const selectedCount = input.selection.selectedCount;
  const safetyReady =
    (input.safety.receipt === 'checked' ||
      input.safety.receipt === 'still-matches') &&
    (!input.safety.extraFileRequired || input.safety.extraChecked);
  const confirmEnabled =
    lockOk && selectedCount > 0 && safetyReady && !input.selection.alert;
  const confirmLabel = ongoingChecked
    ? COPY.selection.ongoingButton
    : COPY.selection.oneTimeButton;
  const confirmBody = confirmationCopy({
    mode: ongoingChecked ? 'ongoing' : 'one-time',
    count: selectedCount,
    email,
    integratedLocalPath: input.capabilities.calls.localAuthorityMutation,
    authority: 'legacy',
  });
  const confirmHint = !lockOk
    ? COPY.selection.confirmUnavailable
    : selectedCount === 0
      ? COPY.selection.noSelection
      : !safetyReady
        ? COPY.selection.dataChanged
        : COPY.selection.confirmHint;
  const stepIndex = ['account', 'safety', 'selection', 'result'].indexOf(
    input.step
  );
  const resultDone = input.step === 'result';
  const nextDisabled =
    input.step === 'selection' ||
    (input.step === 'account' && !signedIn) ||
    (input.step === 'safety' && !safetyReady);

  return {
    surface: input.surface,
    step: input.step,
    pageTitle:
      input.surface === 'recovery' ? 'Recovery' : COPY.dashboard.action,
    headerNote: signedIn
      ? COPY.account.signedIn(email)
      : COPY.account.signedOut,
    dialogTitle: COPY.dashboard.action,
    dialogDescription: `${COPY.dashboard.description} Nothing is copied until you confirm, and nothing is ever deleted.`,
    compactStepLabel:
      input.step === 'account'
        ? COPY.account.eyebrow
        : input.step === 'safety'
          ? COPY.safety.eyebrow
          : input.step === 'selection'
            ? COPY.selection.eyebrow
            : COPY.result.eyebrow,
    rail: rail(input.step),
    railCharacters: input.characters.map(character => ({
      id: character.id,
      name: character.name,
      included: character.selected,
    })),
    characters: input.characters,
    account: {
      statusLine: signedIn
        ? COPY.account.signedIn(email)
        : COPY.account.signedOut,
      statusDetail: signedIn
        ? COPY.account.signedInDetail
        : COPY.account.signedOutDetail,
      actionLabel: signedIn
        ? COPY.account.recheck
        : COPY.account.signedOutAction,
      signedIn,
      error: input.account.error,
    },
    safety: input.safety,
    selection: {
      ongoingAvailable,
      ongoingChecked: oneTimeOnly ? false : ongoingChecked,
      confirmEnabled,
      confirmLabel,
      confirmBody,
      confirmHint,
      alert: input.selection.alert,
    },
    result: input.result,
    management: input.management,
    recovery: input.recovery,
    footer: {
      progressText: resultDone
        ? 'Setup finished'
        : `Step ${stepIndex + 1} of 3`,
      progressNote: resultDone
        ? 'Every character is reported on its own.'
        : 'Nothing is copied before the last step.',
      progressPercent: resultDone
        ? 100
        : Math.round(((stepIndex + 1) / 3) * 100),
      backLabel: 'Back',
      nextLabel:
        input.step === 'result'
          ? COPY.chrome.manage
          : input.step === 'selection'
            ? 'Review and confirm'
            : 'Continue',
      nextDisabled,
    },
    liveStatus: input.liveStatus,
    actionError: input.actionError ?? null,
    busy: input.busy,
  };
}

export const EMPTY_RESULT: PlayerBackupWizardView['result'] = {
  title: COPY.result.protectedTitle,
  headline: COPY.result.ongoingComplete(0),
  body: COPY.result.continueSetupBody,
  tone: 'ok',
  rows: [],
  conflicts: [],
  heldAside: [],
  continueSetup: false,
  closeSafe: false,
};

export const EMPTY_MANAGEMENT: PlayerBackupWizardView['management'] = {
  title: COPY.management.title,
  summary: COPY.management.summary(0, 0, 0),
  rows: [],
  futureDefaultOn: false,
  futureDefaultEnabled: false,
};

const CURRENT_CLOUD_ATTENTION_STATES = new Set<
  NonNullable<PlayerBackupCharacterRow['cloudState']>
>(['newer', 'removed', 'future', 'unavailable']);

function cloudManagementActions(options: {
  hasCloudRow: boolean;
  manual: boolean;
  runScoped?: boolean;
  /** An already-removed online copy can be restored, not removed again. */
  removed?: boolean;
}): PlayerBackupWizardView['management']['rows'][number]['actions'] {
  const restore = options.manual && options.hasCloudRow;
  const runMutate = restore && options.runScoped === true;
  return [
    {
      label: COPY.management.restoreHere,
      enabled: restore,
      action: 'restore-here',
    },
    {
      label: COPY.management.restoreCopy,
      enabled: restore,
      action: 'restore-copy',
    },
    {
      label: COPY.conflict.downloadRecovery,
      enabled: options.hasCloudRow,
      action: 'download-recovery',
    },
    {
      label: COPY.management.remove,
      enabled: runMutate && options.removed !== true,
      action: 'remove',
    },
  ];
}

export function projectPlayerBackupManagement(input: {
  characters: PlayerBackupCharacterRow[];
  onlineOnly?: ReadonlyArray<{
    id: string;
    name: string;
    state: 'available' | 'removed' | 'future';
  }>;
  cloudLegacyIds?: readonly string[];
  result: PlayerBackupWizardView['result'];
  futureDefaultOn: boolean;
  futureDefaultEnabled?: boolean;
  manualMutation?: boolean;
  automaticMutation?: boolean;
  runScoped?: boolean;
}): PlayerBackupWizardView['management'] {
  const conflictIds = new Set(
    input.result.conflicts.map(conflict => conflict.legacyId)
  );
  const heldAsideIds = new Set(
    input.result.heldAside.map(item => item.legacyId)
  );
  const cloudLegacyIds = new Set(input.cloudLegacyIds ?? []);
  const manual = input.manualMutation === true;
  const automatic = input.automaticMutation === true;
  const runScoped = input.runScoped === true;
  const localIds = new Set(input.characters.map(character => character.id));
  const localRows = input.characters.map(character => {
    const conflicted = conflictIds.has(character.id);
    const heldAside =
      heldAsideIds.has(character.id) || character.cloudState === 'future';
    const resultRow = input.result.rows.find(row => row.id === character.id);
    // A current online read that a durable result cannot explain wins over the
    // stale result label. `different` is excluded on purpose: local edits made
    // after a one-time copy read as `different` (local ahead), which is the
    // ordinary "later changes stay here until you choose Back up now" state.
    const currentCloudAttention =
      character.cloudState !== undefined &&
      CURRENT_CLOUD_ATTENTION_STATES.has(character.cloudState);
    const currentCloudCopy = currentCloudAttention
      ? degradedCharacterCopy(
          character.cloudState as Parameters<typeof degradedCharacterCopy>[0]
        )
      : null;
    // Actions always derive from durable evidence so a transient online read
    // cannot hide Back up now or offer ongoing-only controls.
    const durableLabel = resultRow?.statusLabel ?? character.statusLabel;
    const removedOnline = character.cloudState === 'removed';
    const statusLabel = removedOnline
      ? COPY.selection.removed
      : currentCloudAttention
        ? character.statusLabel
        : durableLabel;
    const paused = durableLabel === COPY.selection.paused;
    const savedOnce = durableLabel === COPY.selection.oneTimeProtected;
    const protectedOngoing =
      durableLabel === COPY.selection.alreadyProtected ||
      resultRow?.tone === 'ok';
    const hasCloudRow = cloudLegacyIds.has(character.id);
    return {
      id: character.id,
      name: character.name,
      statusLabel,
      note: currentCloudAttention
        ? (currentCloudCopy?.description ?? character.note)
        : (resultRow?.note ?? character.note),
      tone: currentCloudAttention
        ? 'warn'
        : (resultRow?.tone ?? character.tone),
      actions: conflicted
        ? [
            {
              label: COPY.conflict.title,
              enabled: true,
              action: 'choose' as const,
            },
          ]
        : heldAside
          ? [
              {
                label: COPY.conflict.downloadRecovery,
                enabled: hasCloudRow,
                action: 'download-recovery' as const,
              },
            ]
          : [
              ...(protectedOngoing && !paused && !savedOnce
                ? [
                    {
                      label: COPY.management.pause,
                      enabled: automatic && runScoped,
                      action: 'pause' as const,
                    },
                  ]
                : []),
              ...(paused || savedOnce
                ? [
                    {
                      label: COPY.management.resume,
                      enabled: automatic && runScoped,
                      action: 'resume' as const,
                    },
                    {
                      label: COPY.management.backupNow,
                      enabled: manual && runScoped,
                      action: 'backup-now' as const,
                    },
                  ]
                : []),
              ...cloudManagementActions({
                hasCloudRow,
                manual,
                runScoped,
                removed: removedOnline,
              }),
            ],
    };
  });
  const onlineRows = (input.onlineOnly ?? [])
    .filter(entry => !localIds.has(entry.id))
    .map(entry => {
      const hasCloudRow = cloudLegacyIds.has(entry.id);
      const actions = cloudManagementActions({
        hasCloudRow,
        manual,
        runScoped,
      }).map(action =>
        entry.state === 'future'
          ? {
              ...action,
              enabled: action.action === 'download-recovery' && hasCloudRow,
            }
          : entry.state === 'removed' && action.action === 'remove'
            ? { ...action, enabled: false }
            : action
      );
      return {
        id: entry.id,
        name: entry.name,
        statusLabel:
          entry.state === 'removed'
            ? COPY.selection.removed
            : entry.state === 'future'
              ? COPY.selection.unavailable
              : COPY.selection.oneTimeProtected,
        note: '',
        tone: entry.state === 'future' ? ('warn' as const) : ('info' as const),
        actions,
      };
    });
  const rows = [...localRows, ...onlineRows];
  const protectedCount = rows.filter(row => row.tone === 'ok').length;
  const pausedCount = rows.filter(
    row => row.statusLabel === COPY.selection.paused
  ).length;
  const attentionCount = rows.filter(
    row => row.tone === 'warn' || row.tone === 'bad'
  ).length;
  return {
    title: COPY.management.title,
    summary: COPY.management.summary(
      protectedCount,
      pausedCount,
      attentionCount
    ),
    rows,
    futureDefaultOn: input.futureDefaultOn,
    futureDefaultEnabled: input.futureDefaultEnabled === true && runScoped,
  };
}

// The recovery surface is reached through routine actions (restore a
// character, save a safety file), so its default view must not claim that
// recovery is required. COPY.recovery.title/description stay reserved for the
// genuine unopenable-authority state surfaced by PersistenceBootstrap.
export const EMPTY_RECOVERY: PlayerBackupWizardView['recovery'] = {
  title: COPY.recovery.routineTitle,
  description: COPY.recovery.routineDescription,
};

export const EMPTY_SAFETY: PlayerBackupWizardView['safety'] = {
  description: COPY.safety.description,
  receipt: 'needed',
  badgeLabel: COPY.safety.badgeNeeded,
  extraFileRequired: false,
  extraChecked: false,
  preparing: false,
  checking: false,
  pickedFileName: null,
  extraPickedFileName: null,
};
