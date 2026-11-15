import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportCharacterPage from './ImportCharacterPage';
import { usePlayerStore } from '@/store/playerStore';
import type { CharacterExport } from '@/types/character';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function exportData(avatar?: string): CharacterExport {
  return {
    version: '1',
    exportDate: '2026-01-01',
    character: makeCharacter({ name: 'Mira', race: 'Half-elf', avatar }),
  } as CharacterExport;
}

describe('ImportCharacterPage', () => {
  let saved: ReturnType<typeof usePlayerStore.getState>;
  let importCharacter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push.mockReset();
    saved = usePlayerStore.getState();
    importCharacter = vi.fn(() => 'new-id');
    usePlayerStore.setState({
      importCharacter: importCharacter as never,
    });
  });

  afterEach(() => {
    cleanup();
    usePlayerStore.setState(saved, true);
  });

  it('shows the character with one Import character button', () => {
    render(<ImportCharacterPage exportData={exportData()} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Import character' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Mira' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Half-elf · Fighter · Level 5')
    ).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Import character' });
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(
      document.body.querySelectorAll('[data-variant="primary"]')
    ).toHaveLength(1);
    expect(
      screen.getByText('Adds this character to your roster on this device.')
    ).toBeInTheDocument();
  });

  it('imports and opens the new sheet', async () => {
    const user = userEvent.setup();
    const data = exportData();
    render(<ImportCharacterPage exportData={data} />);
    await user.click(screen.getByRole('button', { name: 'Import character' }));
    expect(importCharacter).toHaveBeenCalledTimes(1);
    expect(importCharacter).toHaveBeenCalledWith(data);
    expect(push).toHaveBeenCalledWith('/player/characters/new-id');
    expect(screen.getByRole('button', { name: 'Importing…' })).toBeDisabled();
  });

  it('treats the portrait as decorative', () => {
    const { container } = render(
      <ImportCharacterPage
        exportData={exportData('https://example.test/mira.png')}
      />
    );
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img', { name: 'Mira' })).toBeNull();
  });
});
