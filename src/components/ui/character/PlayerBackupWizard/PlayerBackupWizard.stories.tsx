import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PlayerBackupWizard } from './index';
import {
  PLAYER_BACKUP_WIZARD_SCENARIOS,
  createIdlePlayerBackupWizardActions,
  createPlayerBackupWizardFixture,
} from './PlayerBackupWizard.fixtures';

const meta: Meta<typeof PlayerBackupWizard> = {
  component: PlayerBackupWizard,
  parameters: { layout: 'fullscreen' },
  args: {
    actions: createIdlePlayerBackupWizardActions(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const titles: Record<(typeof PLAYER_BACKUP_WIZARD_SCENARIOS)[number], string> =
  {
    'signed-out': 'SignedOut',
    'account-ready': 'AccountReady',
    'account-check-failed': 'AccountCheckFailed',
    'safety-file-needed': 'SafetyFileNeeded',
    'safety-file-checked': 'SafetyFileChecked',
    'wrong-file': 'WrongFile',
    'file-still-matches': 'FileStillMatches',
    'choose-characters': 'ChooseCharacters',
    'one-copy-only': 'OneCopyOnly',
    'account-changed': 'AccountChanged',
    'backing-up': 'BackingUp',
    'result-protected': 'ResultProtected',
    'result-copies-saved': 'ResultCopiesSaved',
    'result-needs-attention': 'ResultNeedsAttention',
    'result-offline': 'ResultOffline',
    'conflict-choice': 'ConflictChoice',
    'needs-newer-version': 'NeedsNewerVersion',
    'manage-backups': 'ManageBackups',
    'recovery-required': 'RecoveryRequired',
  };

const stories = Object.fromEntries(
  PLAYER_BACKUP_WIZARD_SCENARIOS.map(scenario => [
    titles[scenario],
    {
      args: { view: createPlayerBackupWizardFixture(scenario) },
    } satisfies Story,
  ])
) as Record<string, Story>;

export const SignedOut = stories.SignedOut;
export const AccountReady = stories.AccountReady;
export const AccountCheckFailed = stories.AccountCheckFailed;
export const SafetyFileNeeded = stories.SafetyFileNeeded;
export const SafetyFileChecked = stories.SafetyFileChecked;
export const WrongFile = stories.WrongFile;
export const FileStillMatches = stories.FileStillMatches;
export const ChooseCharacters = stories.ChooseCharacters;
export const OneCopyOnly = stories.OneCopyOnly;
export const AccountChanged = stories.AccountChanged;
export const BackingUp = stories.BackingUp;
export const ResultProtected = stories.ResultProtected;
export const ResultCopiesSaved = stories.ResultCopiesSaved;
export const ResultNeedsAttention = stories.ResultNeedsAttention;
export const ResultOffline = stories.ResultOffline;
export const ConflictChoice = stories.ConflictChoice;
export const NeedsNewerVersion = stories.NeedsNewerVersion;
export const ManageBackups = stories.ManageBackups;
export const RecoveryRequired = stories.RecoveryRequired;

export const ChooseCharactersDark: Story = {
  args: { view: createPlayerBackupWizardFixture('choose-characters') },
  globals: { theme: 'dark' },
};

export const ChooseCharactersParchment: Story = {
  args: { view: createPlayerBackupWizardFixture('choose-characters') },
  globals: { theme: 'parchment' },
};

export const ResultProtectedDark: Story = {
  args: { view: createPlayerBackupWizardFixture('result-protected') },
  globals: { theme: 'dark' },
};

export const ResultProtectedParchment: Story = {
  args: { view: createPlayerBackupWizardFixture('result-protected') },
  globals: { theme: 'parchment' },
};
