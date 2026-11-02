import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore, type PlayerCharacter } from '@/store/playerStore';
import { LauncherTable } from './LauncherTable';

function character(
  id: string,
  name: string,
  lastPlayed: string,
  isArchived = false
): PlayerCharacter {
  return {
    id,
    name,
    lastPlayed: new Date(lastPlayed),
    isArchived,
  } as PlayerCharacter;
}

describe('LauncherTable', () => {
  beforeEach(() => {
    // The medallions' score editor asks for (min-width: 640px).
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
    );
    useCharacterStore.setState({ hasHydrated: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    usePlayerStore.setState({ characters: [] });
  });

  it('opens the two lists', () => {
    usePlayerStore.setState({ characters: [] });
    render(<LauncherTable />);
    expect(screen.getByRole('link', { name: /^Characters/ })).toHaveAttribute(
      'href',
      '/player'
    );
    expect(screen.getByRole('link', { name: /^Campaigns/ })).toHaveAttribute(
      'href',
      '/dm'
    );
    expect(screen.queryByRole('link', { name: /sheet$/ })).toBeNull();
  });

  it('continues with the character played most recently, skipping archived ones', () => {
    usePlayerStore.setState({
      characters: [
        character('a', 'Asteroth Nightveil', '2026-10-01T00:00:00Z'),
        character('e', 'Eric Ravenshaw', '2026-10-20T00:00:00Z'),
        character('o', 'Odette Clermont', '2026-10-30T00:00:00Z', true),
      ],
    });
    render(<LauncherTable />);
    expect(
      screen.getByRole('link', { name: "Open Eric Ravenshaw's sheet" })
    ).toHaveAttribute('href', '/player/characters/e');
  });
});
