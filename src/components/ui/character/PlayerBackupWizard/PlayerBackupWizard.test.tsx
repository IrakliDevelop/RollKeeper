import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectPlayerBackupVocabulary } from '@/test/helpers';

import { PlayerBackupWizard } from './index';
import {
  PLAYER_BACKUP_WIZARD_SCENARIOS,
  createIdlePlayerBackupWizardActions,
  createPlayerBackupWizardFixture,
  type PlayerBackupWizardScenario,
} from './PlayerBackupWizard.fixtures';

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  };
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function renderWizard(
  scenarioOrView:
    | PlayerBackupWizardScenario
    | ReturnType<typeof createPlayerBackupWizardFixture>,
  actions = createIdlePlayerBackupWizardActions()
) {
  cleanup();
  document.body.replaceChildren();
  const view =
    typeof scenarioOrView === 'string'
      ? createPlayerBackupWizardFixture(scenarioOrView)
      : scenarioOrView;
  return render(<PlayerBackupWizard view={view} actions={actions} />);
}

const SCENARIO_EXPECTATIONS: Record<
  PlayerBackupWizardScenario,
  {
    heading: string;
    copy: string;
    control?: { name: string; disabled?: boolean };
  }
> = {
  'signed-out': {
    heading: COPY.account.title,
    copy: COPY.account.signedOut,
    control: { name: COPY.account.signedOutAction },
  },
  'account-ready': {
    heading: COPY.account.title,
    copy: COPY.account.signedIn('player@example.com'),
    control: { name: COPY.account.recheck },
  },
  'account-check-failed': {
    heading: COPY.account.title,
    copy: COPY.errors.account,
  },
  'safety-file-needed': {
    heading: COPY.safety.title,
    copy: COPY.safety.download,
    control: { name: COPY.safety.fileInput },
  },
  'safety-file-checked': {
    heading: COPY.safety.title,
    copy: COPY.safety.verifiedTitle,
  },
  'wrong-file': {
    heading: COPY.safety.title,
    copy: COPY.safety.mismatchTitle,
  },
  'file-still-matches': {
    heading: COPY.safety.title,
    copy: COPY.safety.stillMatches,
  },
  'choose-characters': {
    heading: COPY.selection.title,
    copy: COPY.selection.ongoingButton,
  },
  'one-copy-only': {
    heading: COPY.selection.title,
    copy: COPY.selection.oneTimeButton,
  },
  'account-changed': {
    heading: COPY.selection.title,
    copy: COPY.selection.accountChanged,
    control: { name: COPY.selection.ongoingButton, disabled: true },
  },
  'backing-up': {
    heading: COPY.result.backingUpTitle,
    copy: COPY.result.backingUpHeadline(2),
  },
  'result-protected': {
    heading: COPY.result.protectedTitle,
    copy: COPY.result.ongoingComplete(2),
  },
  'result-copies-saved': {
    heading: COPY.result.protectedTitle,
    copy: COPY.result.oneTimeComplete(2),
  },
  'result-needs-attention': {
    heading: COPY.result.partialTitle,
    copy: COPY.result.partialDescription(1, 1),
  },
  'result-offline': {
    heading: COPY.result.offlineTitle,
    copy: COPY.result.offlineHeadline,
  },
  'conflict-choice': {
    heading: COPY.result.partialTitle,
    copy: COPY.conflict.keepMine,
  },
  'needs-newer-version': {
    heading: COPY.result.partialTitle,
    copy: COPY.conflict.futureTitle,
    control: { name: COPY.conflict.downloadRecovery, disabled: true },
  },
  'manage-backups': {
    heading: COPY.management.title,
    copy: COPY.management.summary(1, 1, 1),
  },
  'recovery-required': {
    heading: COPY.recovery.title,
    copy: COPY.recovery.description,
  },
};

describe('PlayerBackupWizard', () => {
  it.each(PLAYER_BACKUP_WIZARD_SCENARIOS)(
    'renders the %s design fixture with approved copy',
    scenario => {
      const { baseElement } = renderWizard(scenario);
      const expected = SCENARIO_EXPECTATIONS[scenario];
      expect(
        screen.getByRole('heading', { name: expected.heading })
      ).toBeInTheDocument();
      expect(baseElement).toHaveTextContent(expected.copy);
      if (expected.control) {
        const control =
          screen.queryByRole('button', { name: expected.control.name }) ??
          screen.queryByLabelText(expected.control.name);
        expect(control).toBeTruthy();
        if (expected.control.disabled && control) {
          expect(control).toBeDisabled();
        }
      }
      expect(screen.queryByText(/design states/i)).not.toBeInTheDocument();
      expect(baseElement.textContent).not.toMatch(/1\.4\s*MB/i);
      expectPlayerBackupVocabulary(baseElement);
    }
  );

  it('does not mutate on passive viewing or pre-confirmation selection', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onSaveSafetyFile = vi.fn();
    const { baseElement } = renderWizard('choose-characters', {
      ...createIdlePlayerBackupWizardActions(),
      onConfirm,
      onSaveSafetyFile,
    });
    await user.click(
      screen.getByRole('button', { name: COPY.selection.selectAll })
    );
    await user.click(
      screen.getByRole('button', { name: COPY.selection.clearAll })
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onSaveSafetyFile).not.toHaveBeenCalled();
    expectPlayerBackupVocabulary(baseElement);
  });

  it('keeps confirmation as the first mutation control', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWizard(
      'choose-characters',
      createIdlePlayerBackupWizardActions({ onConfirm })
    );
    await user.click(
      screen.getByRole('button', { name: COPY.selection.ongoingButton })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('surfaces mutation failures as a visible alert', () => {
    renderWizard({
      ...createPlayerBackupWizardFixture('choose-characters'),
      actionError: COPY.errors.online,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(COPY.errors.online);
  });

  it('offers a labeled restore-from-safety-file control on the recovery surface', () => {
    const { baseElement } = renderWizard('recovery-required');
    const restore = screen.getByLabelText(COPY.recovery.restoreFrom);
    expect(restore).toBeEnabled();
    expect(restore).toHaveAttribute('type', 'file');
    expect(
      screen.getByRole('button', { name: COPY.recovery.options })
    ).toBeInTheDocument();
    expectPlayerBackupVocabulary(baseElement);
  });

  it('lists restore actions for online copies on the recovery surface', () => {
    const onRestoreHere = vi.fn();
    const view = createPlayerBackupWizardFixture('recovery-required');
    view.management = {
      ...view.management,
      rows: [
        {
          id: 'nyx',
          name: 'Nyx Emberveil',
          statusLabel: COPY.selection.oneTimeProtected,
          note: '',
          tone: 'info',
          actions: [
            {
              label: COPY.management.restoreHere,
              enabled: true,
              action: 'restore-here',
            },
            {
              label: COPY.management.restoreCopy,
              enabled: true,
              action: 'restore-copy',
            },
            {
              label: COPY.conflict.downloadRecovery,
              enabled: true,
              action: 'download-recovery',
            },
            {
              label: COPY.management.remove,
              enabled: false,
              action: 'remove',
            },
          ],
        },
        {
          id: 'archived',
          name: 'Archived Hero',
          statusLabel: COPY.selection.removed,
          note: '',
          tone: 'warn',
          actions: [
            {
              label: COPY.management.restoreHere,
              enabled: true,
              action: 'restore-here',
            },
            {
              label: COPY.management.remove,
              enabled: false,
              action: 'remove',
            },
          ],
        },
      ],
    };
    const { baseElement } = renderWizard(
      view,
      createIdlePlayerBackupWizardActions({ onRestoreHere })
    );
    const restoreHere = screen.getAllByRole('button', {
      name: COPY.management.restoreHere,
    });
    expect(restoreHere).toHaveLength(2);
    expect(restoreHere[0]).toBeEnabled();
    expect(restoreHere[1]).toBeEnabled();
    expect(
      screen.getByRole('button', { name: COPY.management.restoreCopy })
    ).toBeEnabled();
    expect(screen.getByText('Nyx Emberveil')).toBeInTheDocument();
    expect(screen.getByText('Archived Hero')).toBeInTheDocument();
    expectPlayerBackupVocabulary(baseElement);
  });

  it('names the safety file input and exposes mismatch as an alert', () => {
    renderWizard('wrong-file');
    expect(screen.getByLabelText(COPY.safety.fileInput)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      COPY.safety.mismatchTitle
    );
  });

  it('keeps the 390px dialog body from overflowing horizontally', () => {
    const { baseElement } = renderWizard('choose-characters');
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/overflow-x-hidden/);
    expect(within(dialog).getByText(COPY.selection.title)).toBeInTheDocument();
    expectPlayerBackupVocabulary(baseElement);
  });

  it('routes close back to the character list', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWizard(
      'signed-out',
      createIdlePlayerBackupWizardActions({ onClose })
    );
    await user.click(screen.getByRole('button', { name: COPY.chrome.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('link', { name: COPY.chrome.back })
    ).toHaveAttribute('href', '/player');
  });

  it('shows finish applying when a conflict still owes a roster write', () => {
    const base = createPlayerBackupWizardFixture('conflict-choice');
    const view = {
      ...base,
      result: {
        ...base.result,
        conflicts: base.result.conflicts.map(conflict => ({
          ...conflict,
          pendingApplication: true,
        })),
      },
    };
    const { baseElement } = renderWizard(view);
    expect(
      screen.getByRole('button', { name: COPY.conflict.applyPending })
    ).toBeEnabled();
    expectPlayerBackupVocabulary(baseElement);
  });

  it('moves focus to a validation alert', () => {
    renderWizard('wrong-file');
    expect(document.activeElement).toHaveAttribute('role', 'alert');
  });
});
