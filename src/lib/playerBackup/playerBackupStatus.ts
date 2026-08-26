export const PLAYER_BACKUP_FLOW_STATES = [
  'signed-out',
  'no-local-database',
  'no-characters',
  'eligible-local-characters',
  'safety-file-required',
  'active-characters-not-covered',
  'safety-file-ready',
  'degraded-contested-character',
  'ready',
  'confirmed-not-prepared',
  'preparing',
  'already-active-new-run',
  'active-profile-missing-evidence',
  'backing-up',
  'protected-ongoing',
  'protected-one-time',
  'paused',
  'offline',
  'sign-in-required',
  'conflict',
  'recovery-required',
  'current-character-file-staged',
  'restore-verifying',
  'unsupported-future-data',
  'account-changed',
  'run-replaced',
  'lock-unavailable',
  'partial-success',
  'retry',
  'closed-before-confirmation',
  'closed-after-confirmation',
] as const;

export type PlayerBackupFlowState = (typeof PLAYER_BACKUP_FLOW_STATES)[number];

export interface PlayerBackupPlainStatus {
  key: PlayerBackupFlowState;
  title: string;
  description: string;
}

const FLOW_COPY: Record<
  PlayerBackupFlowState,
  Omit<PlayerBackupPlainStatus, 'key'>
> = {
  'signed-out': {
    title: 'Not signed in',
    description: 'Sign in to continue. Nothing in this browser was changed.',
  },
  'no-local-database': {
    title: 'Protect your characters',
    description: 'No earlier character backup setup was found.',
  },
  'no-characters': {
    title: 'No characters to back up',
    description: 'Create a character or restore one from a backup first.',
  },
  'eligible-local-characters': {
    title: 'Choose characters',
    description: 'Choose which available characters to protect.',
  },
  'safety-file-required': {
    title: 'Save a safety file',
    description: 'Save the file and choose it again before continuing.',
  },
  'active-characters-not-covered': {
    title: 'Save one more recovery file',
    description: 'One extra file is needed for your current characters.',
  },
  'safety-file-ready': {
    title: 'Safety file checked',
    description: 'The required files still match this browser.',
  },
  'degraded-contested-character': {
    title: 'Review needed first',
    description: 'This character cannot be safely included yet.',
  },
  ready: {
    title: 'Ready to confirm',
    description: 'Review the account, character count, and result.',
  },
  'confirmed-not-prepared': {
    title: 'Continue character backup',
    description: 'Your confirmed choices are ready to continue.',
  },
  preparing: {
    title: 'Preparing safe character saving in this browser',
    description: 'Your existing characters remain available.',
  },
  'already-active-new-run': {
    title: 'Checking this browser',
    description: 'RollKeeper is checking the existing character setup.',
  },
  'active-profile-missing-evidence': {
    title: 'Earlier character setup needs attention',
    description: 'Save a current character recovery file before continuing.',
  },
  'backing-up': {
    title: 'Backing up characters',
    description: 'RollKeeper is checking each selected online copy.',
  },
  'protected-ongoing': {
    title: 'Online backup is on',
    description: 'Later saved changes will update the online backup.',
  },
  'protected-one-time': {
    title: 'Online copy saved',
    description: 'Later changes stay in this browser until you back up again.',
  },
  paused: {
    title: 'Backup paused',
    description: 'Existing local and online copies were kept.',
  },
  offline: {
    title: 'Waiting for internet',
    description: 'Your changes are safe in this browser.',
  },
  'sign-in-required': {
    title: 'Sign in again',
    description: 'Your local characters and waiting changes were kept.',
  },
  conflict: {
    title: 'Choose which copy to use',
    description: 'RollKeeper kept both versions until you choose.',
  },
  'recovery-required': {
    title: 'Your characters need recovery',
    description: 'RollKeeper did not fall back to an older copy.',
  },
  'current-character-file-staged': {
    title: 'Your current characters are ready to restore',
    description: 'The characters already in this browser have not changed.',
  },
  'restore-verifying': {
    title: 'Checking restored characters',
    description: 'RollKeeper is checking the characters after loading again.',
  },
  'unsupported-future-data': {
    title: 'This online copy needs a newer RollKeeper version',
    description: 'Nothing was replaced. Save a recovery copy before updating.',
  },
  'account-changed': {
    title: 'The signed-in account changed',
    description:
      'Check the account and confirm again before anything is copied.',
  },
  'run-replaced': {
    title: 'Backup choices changed in another tab',
    description: 'Nothing new was copied. Review the current choices.',
  },
  'lock-unavailable': {
    title: 'Online backup is unavailable right now',
    description: 'You can still save or restore a safety file.',
  },
  'partial-success': {
    title: 'Some characters need attention',
    description: 'Finished characters stay protected. Nothing was deleted.',
  },
  retry: {
    title: 'Try again',
    description: 'RollKeeper kept the earlier attempt for a safe retry.',
  },
  'closed-before-confirmation': {
    title: 'Character backup is not finished',
    description: 'Your completed safety check is still available.',
  },
  'closed-after-confirmation': {
    title: 'Continue setup',
    description: 'Your confirmed choices are ready to continue safely.',
  },
};

export function projectPlayerBackupStatus(input: {
  kind: PlayerBackupFlowState;
}): PlayerBackupPlainStatus {
  return { key: input.kind, ...FLOW_COPY[input.kind] };
}

export type CharacterBackupStatusKey =
  | 'not-backed-up'
  | 'saved-once'
  | 'ongoing'
  | 'paused'
  | 'queued'
  | 'backing-up'
  | 'offline'
  | 'sign-in-required'
  | 'needs-attention'
  | 'failed'
  | 'held-aside';

export interface CharacterBackupEvidence {
  acknowledged?: boolean;
  preference?: 'on' | 'off' | null;
  explicitlyPaused?: boolean;
  queued?: boolean;
  backingUp?: boolean;
  offline?: boolean;
  authRequired?: boolean;
  conflict?: boolean;
  failed?: boolean;
  heldAside?: boolean;
}

const CHARACTER_LABELS: Record<CharacterBackupStatusKey, string> = {
  'not-backed-up': 'Not backed up',
  'saved-once': 'Saved online once',
  ongoing: 'Online backup is on',
  paused: 'Backup paused',
  queued: 'Waiting to back up',
  'backing-up': 'Backing up',
  offline: 'Waiting for internet',
  'sign-in-required': 'Sign in again',
  'needs-attention': 'Needs attention',
  failed: 'Could not finish',
  'held-aside': 'Needs a newer RollKeeper version',
};

export function projectCharacterBackupStatus(
  evidence: CharacterBackupEvidence
): { key: CharacterBackupStatusKey; label: string } {
  let key: CharacterBackupStatusKey = 'not-backed-up';
  if (evidence.heldAside) key = 'held-aside';
  else if (evidence.conflict) key = 'needs-attention';
  else if (evidence.authRequired) key = 'sign-in-required';
  else if (evidence.offline) key = 'offline';
  else if (evidence.failed) key = 'failed';
  else if (evidence.backingUp) key = 'backing-up';
  else if (evidence.queued) key = 'queued';
  else if (evidence.acknowledged && evidence.preference === 'on')
    key = 'ongoing';
  else if (evidence.acknowledged && evidence.explicitlyPaused) key = 'paused';
  else if (evidence.acknowledged) key = 'saved-once';
  return { key, label: CHARACTER_LABELS[key] };
}
