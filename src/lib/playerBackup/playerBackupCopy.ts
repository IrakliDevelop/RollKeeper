export const PLAYER_BACKUP_COPY = {
  dashboard: {
    title: 'Protect your characters',
    description:
      'Save a safety file, choose your characters, and protect them with your account.',
    action: 'Back up my characters online',
  },
  safety: {
    description:
      'Save a private recovery file for RollKeeper data in this browser. RollKeeper will check whether one extra file is needed for your current characters.',
    oneFileDescription:
      'This file includes your current characters and campaign data saved in this browser. Keep it private and somewhere you can find later.',
    extraFileDescription:
      'Some current character changes are not included in the first file. Save this extra file so those characters can be recovered too.',
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
  if (input.mode === 'ongoing') {
    return prepare
      ? `RollKeeper will prepare character saving in this browser, copy ${input.count} selected characters to ${input.email}, and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.`
      : `RollKeeper will copy ${input.count} selected characters to ${input.email} and keep their online backups up to date. New characters will also be protected unless you turn backup off for them. Your characters stay available here. Nothing is deleted.`;
  }
  return prepare
    ? `RollKeeper will prepare character saving in this browser and save one online copy of ${input.count} selected characters to ${input.email}. Later changes stay here until you back up again. Nothing is deleted.`
    : `RollKeeper will save one online copy of ${input.count} selected characters to ${input.email}. Later changes stay in this browser until you back up again. Your characters stay available here. Nothing is deleted or moved.`;
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
