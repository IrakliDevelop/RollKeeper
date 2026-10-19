import type { ConfirmDialogOptions } from '@/components/ui/feedback/confirm-dialog';

/**
 * Dialog copy for the cloud-sync cards (combat logs, NPCs, encounters, magic
 * items, campaign settings, calendar). Every card asks the same questions at
 * the same steps, so the wording lives here once, per data type.
 */
export interface SyncFamily {
  /** Bare noun, e.g. "combat logs" or "calendar". */
  noun: string;
  /** Takes "the" in a title or label ("Turn on backup for the calendar?"). */
  article: boolean;
  /** Plural nouns read "They are…", singular ones "It is…". */
  plural: boolean;
  /** "1 combat log", "3 combat logs"; omitted for single-document families. */
  count?: (n: number) => string;
}

const counted =
  (one: string, many: string) =>
  (n: number): string =>
    n === 1 ? `1 ${one}` : `${n} ${many}`;

export const SYNC_FAMILIES = {
  combatLogs: {
    noun: 'combat logs',
    article: false,
    plural: true,
    count: counted('combat log', 'combat logs'),
  },
  npcs: {
    noun: 'NPCs',
    article: false,
    plural: true,
    count: counted('NPC', 'NPCs'),
  },
  encounters: {
    noun: 'encounters',
    article: false,
    plural: true,
    count: counted('encounter', 'encounters'),
  },
  magicItems: {
    noun: 'magic items',
    article: false,
    plural: true,
    count: counted('magic item', 'magic items'),
  },
  campaignSettings: { noun: 'campaign settings', article: false, plural: true },
  calendar: { noun: 'calendar', article: true, plural: false },
} satisfies Record<string, SyncFamily>;

const named = (family: SyncFamily) =>
  family.article ? `the ${family.noun}` : family.noun;
const pronoun = (family: SyncFamily) => (family.plural ? 'They' : 'It');
const reference = (fingerprint: string) =>
  `Reference: ${fingerprint.slice(0, 12)}`;

export const syncConfirm = {
  /** After the safety copy is checked, before the data type is selected. */
  selectFamily(family: SyncFamily, campaignName: string): ConfirmDialogOptions {
    return {
      title: 'Safety copy checked',
      message: `Continue with the ${family.noun} for ${campaignName}? Nothing is moved or backed up yet.`,
      confirmLabel: `Continue with ${named(family)}`,
    };
  },

  /** Campaign settings select straight after the download starts. */
  selectAfterDownload(
    family: SyncFamily,
    campaignName: string
  ): ConfirmDialogOptions {
    return {
      title: 'Safety copy downloaded',
      message: `Continue with the ${family.noun} for ${campaignName}? Nothing is moved or backed up yet.`,
      confirmLabel: `Continue with ${named(family)}`,
    };
  },

  switchStorage(family: SyncFamily, fingerprint: string): ConfirmDialogOptions {
    return {
      title: `Switch this browser to the new storage for ${named(family)}?`,
      message: `Your safety copy is already saved. ${reference(fingerprint)}`,
      confirmLabel: 'Switch storage',
    };
  },

  turnOnBackup(family: SyncFamily): ConfirmDialogOptions {
    return {
      title: `Turn on backup for ${named(family)}?`,
      message: `${pronoun(family)} ${family.plural ? 'are' : 'is'} copied to your account.`,
      confirmLabel: 'Turn on backup',
    };
  },

  addBrowser(previewFingerprint: string): ConfirmDialogOptions {
    return {
      title: "Add this browser to your account's backup?",
      message: `What is on this browser is kept and is never uploaded on its own. ${reference(previewFingerprint)}`,
      confirmLabel: 'Add browser',
    };
  },

  loadFromAccount(family: SyncFamily, count?: number): ConfirmDialogOptions {
    const what =
      family.count && count !== undefined ? family.count(count) : named(family);
    // "Load 1 NPC… It replaces…": a single loaded document reads singular.
    const several = family.plural && count !== 1;
    return {
      title: `Load ${what} from your account?`,
      message: `${several ? 'They replace' : 'It replaces'} the ${family.noun} on this browser. Work that hasn't been backed up stops this.`,
      confirmLabel: 'Load from account',
      tone: 'danger',
    };
  },

  restoreVersion(version: number): ConfirmDialogOptions {
    return {
      title: `Restore version ${version}?`,
      message:
        'It is added as a new version, and every earlier version is kept.',
      confirmLabel: 'Restore version',
    };
  },

  stopBackup(family: SyncFamily): ConfirmDialogOptions {
    return {
      title: `Stop backing up ${named(family)}?`,
      message: 'Everything already backed up is kept.',
      confirmLabel: 'Stop backup',
    };
  },

  removeFromBrowser(
    family: SyncFamily,
    accountLabel: string
  ): ConfirmDialogOptions {
    return {
      title: `Remove ${accountLabel}'s ${family.noun} from this browser?`,
      message: 'Your account keeps everything.',
      confirmLabel: 'Remove from browser',
      tone: 'danger',
    };
  },

  /** Second step of removal when some local work was never backed up. */
  unbackedWork(): ConfirmDialogOptions {
    return {
      title: "Some changes aren't backed up",
      message: 'They will be lost from this browser.',
      confirmLabel: 'Remove anyway',
      tone: 'danger',
    };
  },

  deleteCombatLog(): ConfirmDialogOptions {
    return {
      title: 'Delete this combat log?',
      message: 'It stays in your account history if backup is on.',
      confirmLabel: 'Delete combat log',
      tone: 'danger',
    };
  },
};
