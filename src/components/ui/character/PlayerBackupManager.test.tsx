import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectPlayerBackupVocabulary } from '@/test/helpers';

import { PlayerBackupManager } from './PlayerBackupManager';
import { createIdlePlayerBackupWizardActions } from './PlayerBackupWizard/PlayerBackupWizard.fixtures';
import { createPlayerBackupWizardFixture } from './PlayerBackupWizard/PlayerBackupWizard.fixtures';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('PlayerBackupManager', () => {
  it('renders check now, protect more, and confirms soft archive', async () => {
    const user = userEvent.setup();
    const actions = createIdlePlayerBackupWizardActions({
      onRemoveOnlineCopy: vi.fn(),
      onCheckNow: vi.fn(),
    });
    const view = createPlayerBackupWizardFixture('manage-backups');
    view.management.rows[0] = {
      ...view.management.rows[0]!,
      actions: [
        ...view.management.rows[0]!.actions,
        {
          label: COPY.management.remove,
          enabled: true,
          action: 'remove',
        },
      ],
    };
    const { container } = render(
      <PlayerBackupManager view={view} actions={actions} />
    );
    expect(
      screen.getByRole('heading', { name: COPY.management.title })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: COPY.chrome.checkNow })
    );
    expect(actions.onCheckNow).toHaveBeenCalled();
    const remove = screen.getAllByRole('button', {
      name: COPY.management.remove,
    })[0];
    if (remove) await user.click(remove);
    expect(
      screen.getByText(/The character in this browser will stay/)
    ).toBeInTheDocument();
    expectPlayerBackupVocabulary(container);
  });
});
