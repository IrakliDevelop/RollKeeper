import type { PlayerBackupConflictResolution } from '@/lib/playerBackup/playerBackupConflictCoordinator';

export type PlayerBackupWizardSurface = 'wizard' | 'manage' | 'recovery';

export type PlayerBackupWizardStep =
  | 'account'
  | 'safety'
  | 'selection'
  | 'result';

export type PlayerBackupRailState = 'todo' | 'now' | 'done';

export type PlayerBackupTone = 'ok' | 'warn' | 'info' | 'bad' | 'none';

export type PlayerBackupSafetyReceipt =
  | 'needed'
  | 'download-started'
  | 'checked'
  | 'still-matches'
  | 'mismatch';

export interface PlayerBackupRailItem {
  key: PlayerBackupWizardStep;
  label: string;
  statusLabel: string;
  state: PlayerBackupRailState;
}

export interface PlayerBackupCharacterRow {
  id: string;
  name: string;
  archived: boolean;
  eligible: boolean;
  selected: boolean;
  statusLabel: string;
  note: string;
  tone: PlayerBackupTone;
  cloudState?:
    | 'missing'
    | 'identical'
    | 'newer'
    | 'different'
    | 'removed'
    | 'future'
    | 'unavailable';
}

export interface PlayerBackupResultRow {
  id: string;
  name: string;
  statusLabel: string;
  note: string;
  tone: PlayerBackupTone;
}

export interface PlayerBackupConflictCard {
  conflictId: string;
  legacyId: string;
  applicationLegacyId: string;
  name: string;
  description: string;
  choices: Array<{
    resolution: PlayerBackupConflictResolution;
    label: string;
    body: string;
    enabled: boolean;
  }>;
  pendingApplication: boolean;
}

export interface PlayerBackupHeldAsideCard {
  legacyId: string;
  name: string;
  recoveryAvailable: boolean;
  downloadEnabled: boolean;
}

export interface PlayerBackupManagementRow {
  id: string;
  name: string;
  statusLabel: string;
  note: string;
  tone: PlayerBackupTone;
  actions: Array<{
    label: string;
    enabled: boolean;
    action:
      | 'choose'
      | 'pause'
      | 'resume'
      | 'backup-now'
      | 'restore-here'
      | 'restore-copy'
      | 'download-recovery'
      | 'remove';
  }>;
}

export interface PlayerBackupWizardView {
  surface: PlayerBackupWizardSurface;
  step: PlayerBackupWizardStep;
  pageTitle: string;
  headerNote: string;
  dialogTitle: string;
  dialogDescription: string;
  compactStepLabel: string;
  rail: PlayerBackupRailItem[];
  railCharacters: Array<{ id: string; name: string; included: boolean }>;
  characters: PlayerBackupCharacterRow[];
  account: {
    statusLine: string;
    statusDetail: string;
    actionLabel: string;
    signedIn: boolean;
    error: string | null;
  };
  safety: {
    description: string;
    receipt: PlayerBackupSafetyReceipt;
    badgeLabel: string;
    extraFileRequired: boolean;
    extraChecked: boolean;
    preparing: boolean;
    checking: boolean;
    pickedFileName: string | null;
    extraPickedFileName: string | null;
  };
  selection: {
    ongoingAvailable: boolean;
    ongoingChecked: boolean;
    confirmEnabled: boolean;
    confirmLabel: string;
    confirmBody: string;
    confirmHint: string;
    alert: string | null;
  };
  result: {
    title: string;
    headline: string;
    body: string;
    tone: PlayerBackupTone;
    rows: PlayerBackupResultRow[];
    conflicts: PlayerBackupConflictCard[];
    heldAside: PlayerBackupHeldAsideCard[];
    continueSetup: boolean;
    closeSafe: boolean;
  };
  management: {
    title: string;
    summary: string;
    rows: PlayerBackupManagementRow[];
    futureDefaultOn: boolean;
    futureDefaultEnabled: boolean;
  };
  recovery: {
    title: string;
    description: string;
  };
  footer: {
    progressText: string;
    progressNote: string;
    progressPercent: number;
    backLabel: string;
    nextLabel: string;
    nextDisabled: boolean;
  };
  liveStatus: string | null;
  actionError: string | null;
  busy: boolean;
}

export interface PlayerBackupWizardActions {
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSignIn: () => void;
  onCheckAccount: () => void;
  onSaveSafetyFile: () => void;
  onChooseSafetyFile: (file: File) => void;
  onSaveCurrentCharacterFile: () => void;
  onChooseCurrentCharacterFile: (file: File) => void;
  onToggleCharacter: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleOngoing: (checked: boolean) => void;
  onConfirm: () => void;
  onContinueSetup: () => void;
  onCheckNow: () => void;
  onResolveConflict: (
    conflictId: string,
    resolution: PlayerBackupConflictResolution
  ) => void;
  onApplyPending: (legacyId: string) => void;
  onProtectMore: () => void;
  onOpenRecovery: () => void;
  onOpenManage: () => void;
  onDownloadRecoveryCopy: (legacyId: string) => void;
  onPauseCharacter: (legacyId: string) => void;
  onResumeCharacter: (legacyId: string) => void;
  onBackupNow: (legacyId: string) => void;
  onRestoreHere: (legacyId: string) => void;
  onRestoreCopy: (legacyId: string) => void;
  onRemoveOnlineCopy: (legacyId: string) => void;
  onToggleFutureDefault: (enabled: boolean) => void;
}

export interface PlayerBackupWizardProps {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
}
