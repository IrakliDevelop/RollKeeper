export const PLAYER_BACKUP_COPY = {
  dashboard: {
    title: 'Protect your characters',
    description:
      'Save a safety file, choose your characters, and protect them with your account.',
    action: 'Back up my characters online',
    manage: 'Manage backups',
    restore: 'Restore characters',
    notStarted: {
      title: 'Protect your characters',
      description:
        'Save a safety file, choose your characters, and protect them with your account.',
      action: 'Back up my characters online',
    },
    resumable: {
      title: 'Character backup is not finished',
      description:
        'Your completed steps are still safe. Continue when you are ready.',
      action: 'Continue character backup',
    },
    ongoing: {
      title: 'Online backup is on',
    },
    oneTime: {
      title: 'Online copies saved',
    },
    noCharacters: {
      title: 'No characters to back up',
      description: 'Create a character or restore one from a backup first.',
      action: 'Create a character',
      secondary: 'Restore characters',
    },
    unavailable: {
      title: 'Online backup is unavailable right now',
      description:
        'Your characters are still safe in this browser. You can save or restore a safety file.',
      action: 'Save a safety file',
      secondary: 'Restore characters',
    },
    counts: {
      protected: 'protected',
      paused: 'paused',
      waiting: 'backing up',
      attention: 'needs attention',
      copiesSaved: 'copies saved',
      thisBrowserOnly: 'this browser only',
    },
  },
  chrome: {
    back: 'Back to my characters',
    close: 'Close character backup',
    readsOnly: 'Reads only',
    continueSetup: 'Continue setup',
    done: 'Done',
    manage: 'Manage backups',
    tryAgain: 'Try again',
    checkNow: 'Check now',
    protectMore: 'Protect more characters',
    recoveryOptions: 'Recovery options',
  },
  account: {
    eyebrow: 'Step 1 of 3: Account',
    title: 'Protect your characters',
    description:
      'Sign in to keep private online copies of the characters you choose. Signing in alone does not copy or change anything.',
    signedOut: 'Not signed in',
    signedOutDetail:
      'You can keep playing without an account. Signing in is what makes online copies possible.',
    signedOutAction: 'Sign in to continue',
    signedIn: (email: string) => `Using ${email}`,
    signedInDetail: 'Only this account can see the copies you choose to save.',
    recheck: 'Check my account',
    stayPlayable:
      'Your characters stay playable in this browser the whole time. You choose what goes online on the last step.',
  },
  safety: {
    eyebrow: 'Step 2 of 3: Safety file',
    title: 'Save a safety file',
    description:
      'Save a private recovery file for RollKeeper data in this browser. RollKeeper will check whether one extra file is needed for your current characters.',
    oneFileDescription:
      'This file includes your current characters and campaign data saved in this browser. Keep it private and somewhere you can find later.',
    extraFileTitle: 'Save one more recovery file',
    extraFileDescription:
      'Some current character changes are not included in the first file. Save this extra file so those characters can be recovered too.',
    saveInstruction: '1. Save the file',
    download: 'Save safety file',
    chooseInstruction: '2. Choose the file you just saved',
    fileInput: 'Choose safety file',
    extraDownload: 'Save current character file',
    extraFileInput: 'Choose current character file',
    preparing: 'Preparing your safety file...',
    checkingCharacters: 'Checking your current characters...',
    downloadStarted:
      'Now choose the file you just saved so RollKeeper can check it.',
    checkFile: 'Check the file',
    verifiedTitle: 'Safety file checked',
    verifiedDescription:
      'The required file or files match the current data in this browser. You can continue safely.',
    stillMatches:
      'Your checked recovery files still match this browser, so you do not need to save them again.',
    mismatchTitle: 'That file does not match',
    mismatchDescription:
      'The data in this browser changed, or the file came from somewhere else. Save a new safety file and choose that one instead.',
    saveNew: 'Save a new safety file',
    badgeNeeded: 'Needed',
    badgeChecked: 'Checked',
    badgeStillMatches: 'Still matches',
    badgeMismatch: 'Not usable',
  },
  selection: {
    eyebrow: 'Step 3 of 3: Characters',
    title: 'Choose characters',
    description:
      'All available characters are selected. Clear any character you do not want to protect with this account.',
    selectAll: 'Select all',
    clearAll: 'Clear all',
    archived: 'Archived',
    alreadyProtected: 'Already protected',
    notProtected: 'Not backed up',
    oneTimeProtected: 'Saved online once',
    paused: 'Backup paused',
    different: 'Different online copy',
    newer: 'Online copy has newer changes',
    removed: 'Online copy was removed',
    unavailable: 'Cannot be backed up yet',
    unavailableDescription:
      'RollKeeper cannot safely read this character right now. Nothing will be changed.',
    switchOnTitle: 'Keep these backups up to date',
    switchOnDescription:
      'Recommended. After a change is saved in this browser, RollKeeper will update the online backup for you.',
    switchOffTitle: 'Save one online copy now',
    switchOffDescription:
      'Later changes will stay only in this browser until you choose Back up now.',
    ongoingButton: 'Turn on online backup',
    oneTimeButton: 'Save online copies',
    noSelection: 'Choose at least one character to continue.',
    accountChanged:
      'The signed-in account changed. Check the account and confirm again before anything is copied.',
    dataChanged:
      'Your character data changed after the safety file was checked. Save a new safety file before continuing.',
    confirmHeading: 'Before anything is copied',
    confirmHint: 'This is the only button that copies anything.',
    confirmUnavailable:
      'Online backup cannot start safely in this browser right now. Your characters were not changed. You can still save or restore a safety file.',
  },
  result: {
    eyebrow: 'Result',
    preparing: 'Preparing safe character saving in this browser',
    backingUpTitle: 'Backing up your characters',
    backingUpHeadline: (count: number) =>
      `Backing up ${count} ${count === 1 ? 'character' : 'characters'}`,
    backingUpBody:
      'Each character is copied and then read back to check it. You can leave this page open; nothing is lost if you close it.',
    protectedTitle: 'Your characters are protected',
    ongoingComplete: (count: number) =>
      `Online backup is on for ${count} ${count === 1 ? 'character' : 'characters'}.`,
    oneTimeComplete: (count: number) =>
      `Online copies were checked for ${count} ${count === 1 ? 'character' : 'characters'}.`,
    partialTitle: 'Some characters need attention',
    partialDescription: (protectedCount: number, attentionCount: number) =>
      `${protectedCount} ${protectedCount === 1 ? 'is' : 'are'} protected. ${attentionCount} still ${attentionCount === 1 ? 'needs' : 'need'} attention. Nothing was deleted.`,
    offlineTitle: 'Waiting for the connection',
    offlineHeadline: 'You appear to be offline',
    offlineBody:
      'Your changes are safe in this browser and online backup will continue when the connection returns.',
    continueSetup: 'Continue setup',
    continueSetupBody: 'Your confirmed choices are ready to continue safely.',
    resultNote:
      'Each character is checked on its own. A character is only called protected after its online copy is read back and matches.',
  },
  conflict: {
    title: 'Choose which copy to use',
    description:
      'RollKeeper kept both versions. Nothing will be discarded until you choose.',
    keepMine: 'Keep my changes',
    keepMineBody:
      'Use the version in this browser for the online backup. The online version stays in recovery history.',
    useOnline: 'Use online version',
    useOnlineBody:
      'Use the online version in this browser. Your current version stays in recovery history.',
    keepBoth: 'Keep both',
    keepBothBody:
      "Keep this browser's version and add the online version as another character. The added character will not be backed up until you choose it.",
    futureTitle: 'This online copy needs a newer RollKeeper version',
    futureDescription:
      'Nothing was replaced. Download a recovery copy, then update RollKeeper before trying to use it.',
    downloadRecovery: 'Download recovery copy',
    applyPending: 'Finish applying this choice',
    pendingBody:
      'Your choice is saved. Finish applying it so this character can be updated.',
  },
  management: {
    title: 'Character backups',
    summary: (
      protectedCount: number,
      pausedCount: number,
      attentionCount: number
    ) =>
      `${protectedCount} protected, ${pausedCount} paused, ${
        attentionCount === 1
          ? '1 needs attention'
          : `${attentionCount} need attention`
      }`,
    futureDefault: 'Protect new characters automatically',
    futureDefaultDescription:
      'New characters will use online backup after they are first saved in this browser.',
    pause: 'Pause updates',
    resume: 'Keep up to date',
    backupNow: 'Back up now',
    restoreHere: 'Restore here',
    restoreCopy: 'Restore as another character',
    remove: 'Remove online copy',
    removeSuccess:
      'The online copy was removed. The character in this browser was not changed.',
    pauseSuccess:
      'Online updates are paused. Existing local and online copies were kept.',
    resumeSuccess: 'Online backup is on again.',
    unavailable:
      'These backup changes are not available right now. Your characters were not changed.',
  },
  recovery: {
    title: 'Your characters need recovery',
    description:
      'RollKeeper could not safely open the current saved copy and did not fall back to an older one. Download the available recovery files before trying another action.',
    sectionTitle: 'Safety files and recovery',
    sectionDescription:
      'Save a fresh safety file, restore missing data, or open recovery options when something needs attention.',
    saveNew: 'Save a new safety file',
    restoreFrom: 'Restore from a safety file',
    options: 'Recovery options',
  },
  errors: {
    account:
      'RollKeeper could not check your account. Nothing in this browser was changed. Try again.',
    local:
      'RollKeeper could not finish preparing this browser. Your existing characters were not replaced. Try again, or open recovery options.',
    online:
      'Online backup could not finish just now. Your characters are still safe in this browser. Try again.',
    file: 'This browser could not read that file. Save a new safety file and try again.',
    currentCharacter:
      'RollKeeper could not verify a recovery file for your current characters. Nothing was changed. Try again, or open recovery options.',
  },
} as const;

export function dashboardOngoingDescription(
  protectedCount: number,
  attentionCount: number
): string {
  const protectedPhrase =
    protectedCount === 1
      ? '1 character is protected'
      : `${protectedCount} characters are protected`;
  const attentionPhrase =
    attentionCount === 1
      ? '1 needs attention'
      : `${attentionCount} need attention`;
  return `${protectedPhrase}. ${attentionPhrase}.`;
}

export function dashboardOneTimeDescription(
  protectedCount: number,
  pausedCount = 0
): string {
  if (protectedCount === 0 && pausedCount > 0) {
    const paused =
      pausedCount === 1
        ? '1 character is paused'
        : `${pausedCount} characters are paused`;
    return `${paused}. Existing local and online copies were kept.`;
  }
  const saved =
    protectedCount === 1
      ? '1 character was saved online'
      : `${protectedCount} characters were saved online`;
  return `${saved}. Later changes stay in this browser until you back up again.`;
}

export function managementSummaryCopy(
  protectedCount: number,
  pausedCount: number,
  attentionCount: number
): string {
  return PLAYER_BACKUP_COPY.management.summary(
    protectedCount,
    pausedCount,
    attentionCount
  );
}

export function managementRemoveConfirm(name: string): string {
  return `Remove the online copy of ${name}? The character in this browser will stay. RollKeeper keeps the removed online copy available for recovery.`;
}

export function safetyFileCopy(input: {
  authority: 'legacy' | 'active';
  mirrorParityProved: boolean;
}): { description: string; requiresCurrentCharacterFile: boolean } {
  const requiresCurrentCharacterFile =
    input.authority === 'active' && !input.mirrorParityProved;
  return {
    requiresCurrentCharacterFile,
    description: requiresCurrentCharacterFile
      ? PLAYER_BACKUP_COPY.safety.extraFileDescription
      : PLAYER_BACKUP_COPY.safety.oneFileDescription,
  };
}

export type DegradedCharacterState =
  | 'different'
  | 'newer'
  | 'removed'
  | 'unavailable'
  | 'future';

const DEGRADED_REASONS: Record<DegradedCharacterState, string> = {
  different:
    'This account already has another copy of this character. This backup option cannot safely choose between them. Nothing will be changed.',
  newer:
    'The online copy has changes that are not in this browser. This character cannot be included here.',
  removed:
    'A removed online copy already exists. This character cannot be included here.',
  unavailable:
    'RollKeeper could not safely check the online copy. Try again before including this character.',
  future:
    'This online copy needs a newer RollKeeper version. Nothing will be changed.',
};

export function degradedCharacterCopy(state: DegradedCharacterState) {
  return {
    selectable: false as const,
    selected: false as const,
    status: 'Review needed first' as const,
    description: DEGRADED_REASONS[state],
    nextAction: 'Download online recovery copy' as const,
  };
}

export function confirmationCopy(input: {
  mode: 'ongoing' | 'one-time';
  count: number;
  email: string;
  integratedLocalPath: boolean;
  authority: 'legacy' | 'active';
}): string {
  const prepare = input.integratedLocalPath && input.authority === 'legacy';
  const selection = `${input.count} selected ${
    input.count === 1 ? 'character' : 'characters'
  }`;
  if (input.mode === 'ongoing') {
    return prepare
      ? `RollKeeper will prepare character saving in this browser, copy ${selection} to ${input.email}, and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.`
      : `RollKeeper will copy ${selection} to ${input.email} and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.`;
  }
  return prepare
    ? `RollKeeper will prepare character saving in this browser and save one online copy of ${selection} to ${input.email}. Later changes stay here until you back up again. Nothing is deleted.`
    : `RollKeeper will save one online copy of ${selection} to ${input.email}. Later changes stay in this browser until you back up again. Your characters stay available here. Nothing is deleted or moved.`;
}

export type PlayerBackupErrorChannel =
  | 'account'
  | 'local'
  | 'online'
  | 'file'
  | 'current-character';

export function mapPlayerBackupError(
  channel: PlayerBackupErrorChannel,
  cause: unknown
): string {
  void cause;
  if (channel === 'current-character')
    return PLAYER_BACKUP_COPY.errors.currentCharacter;
  return PLAYER_BACKUP_COPY.errors[channel];
}
