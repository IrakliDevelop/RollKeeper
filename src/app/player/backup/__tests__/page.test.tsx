import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { expectPlayerBackupVocabulary } from '@/test/helpers';

import PlayerBackupPage from '../page';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
});

describe('/player/backup', () => {
  it('is a 404 while the umbrella flag is off', async () => {
    await expect(PlayerBackupPage()).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('renders a non-vacuous default-off foundation shell when enabled', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    const { container } = render(await PlayerBackupPage());
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Protect your characters',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Save a safety file' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to characters/i })
    ).toHaveAttribute('href', '/player');
    expectPlayerBackupVocabulary(container);
  });
});
