import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectCloudProductVocabulary } from '@/test/helpers';
import { expectPlayerBackupVocabulary } from '@/test/helpers';
import * as coordinator from '@/lib/playerBackup/playerBackupCoordinator';
import { usePlayerStore, type PlayerCharacter } from '@/store/playerStore';

import {
  clickConfirmDialogButton,
  findConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

import PlayerDashboardPage from '../page';

const originalWizard = process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  usePlayerStore.setState({ characters: [], activeCharacterId: null });
  if (originalWizard === undefined) {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
  } else {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = originalWizard;
  }
});

describe('PlayerDashboardPage', () => {
  it('renders without a Next app router when account sign-in is disabled', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const { container } = render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /player dashboard/i });
    expect(
      screen.queryByRole('button', { name: 'Sign in' })
    ).not.toBeInTheDocument();
    expectCloudProductVocabulary(container);
  });

  it('renders the "Full browser recovery" heading with R17-clean product vocabulary', async () => {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const { container } = render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /full browser recovery/i });
    expectCloudProductVocabulary(container);
    expect(
      screen.getByRole('button', { name: /join campaign/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^import$/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /new character/i }).length
    ).toBeGreaterThan(0);
  });

  it('does not construct a player-backup coordinator when the wizard flag is off', () => {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const ctor = vi.spyOn(coordinator, 'PlayerBackupReadOnlyCoordinator');
    render(<PlayerDashboardPage />);
    expect(ctor).not.toHaveBeenCalled();
    ctor.mockRestore();
  });

  it('renders a roster entry that is missing tags instead of crashing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    usePlayerStore.setState({
      characters: [{ id: 'legacy' } as PlayerCharacter],
      activeCharacterId: null,
    });
    render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /player dashboard/i });
    expect(
      screen.getByRole('heading', { name: /active characters/i })
    ).toBeInTheDocument();
  });

  it('hides legacy backup surfaces when the wizard flag is on', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    const { container } = render(<PlayerDashboardPage />);
    expect(
      screen.queryByRole('heading', { name: /full browser recovery/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /export all/i })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: COPY.dashboard.noCharacters.title,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /join campaign/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^import$/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /new character/i }).length
    ).toBeGreaterThan(0);
    expectPlayerBackupVocabulary(container);
  });

  describe('character actions ask in the shared dialog', () => {
    const seed = (name: string) =>
      usePlayerStore.getState().createCharacter(name);

    const renderPage = async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED;
      delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
      renderConfirmDialogHost();
      render(<PlayerDashboardPage />);
      await screen.findByRole('heading', { name: /player dashboard/i });
    };

    const byId = (id: string) =>
      usePlayerStore.getState().characters.find(c => c.id === id);

    it('archives only after the player confirms', async () => {
      const id = seed('Thalia Vane');
      await renderPage();

      fireEvent.click(
        screen.getByRole('button', { name: 'Archive Character' })
      );
      expect(await findConfirmDialog()).toHaveAccessibleName(
        'Archive Thalia Vane?'
      );
      await clickConfirmDialogButton('Cancel');
      expect(byId(id)?.isArchived).toBeFalsy();

      fireEvent.click(
        screen.getByRole('button', { name: 'Archive Character' })
      );
      await clickConfirmDialogButton('Archive character');
      expect(byId(id)?.isArchived).toBe(true);
    });

    it('deletes an archived character after the destructive confirm', async () => {
      const id = seed('Thalia Vane');
      usePlayerStore.getState().archiveCharacter(id);
      await renderPage();

      fireEvent.click(
        await screen.findByRole('button', { name: 'Delete Permanently' })
      );
      const dialog = await findConfirmDialog();
      expect(dialog).toHaveAttribute('role', 'alertdialog');
      expect(dialog).toHaveAccessibleName('Delete Thalia Vane?');
      await clickConfirmDialogButton('Delete character');

      expect(byId(id)).toBeUndefined();
    });

    it('duplicates with the name typed into the prompt', async () => {
      seed('Thalia Vane');
      await renderPage();

      fireEvent.click(
        screen.getByRole('button', { name: 'Duplicate Character' })
      );
      const dialog = await findConfirmDialog();
      const field = screen.getByLabelText('Name');
      expect(field).toHaveValue('Thalia Vane (Copy)');
      expect(dialog).toHaveAccessibleName('Duplicate Thalia Vane');
      fireEvent.change(field, { target: { value: 'Thalia the Second' } });
      await clickConfirmDialogButton('Duplicate character');

      expect(
        usePlayerStore
          .getState()
          .characters.some(c => c.name === 'Thalia the Second')
      ).toBe(true);
    });

    it('offers to open an imported character in one dialog', async () => {
      await renderPage();
      const input = document.querySelector<HTMLInputElement>(
        'input[type="file"][accept=".json"]'
      );
      expect(input).not.toBeNull();
      const file = new File(
        [JSON.stringify({ name: 'Borin Ashfall', level: 3 })],
        'borin.json',
        { type: 'application/json' }
      );
      fireEvent.change(input!, { target: { files: [file] } });

      expect(await findConfirmDialog()).toHaveAccessibleName(
        'Borin Ashfall imported'
      );
      await clickConfirmDialogButton('Stay here');
      await waitFor(() =>
        expect(
          usePlayerStore
            .getState()
            .characters.some(c => c.name === 'Borin Ashfall')
        ).toBe(true)
      );
    });
  });
});
