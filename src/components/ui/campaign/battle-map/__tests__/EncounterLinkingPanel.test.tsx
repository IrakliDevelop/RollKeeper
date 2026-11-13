import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EncounterLinkingPanel from '../EncounterLinkingPanel';
import { useEncounterStore } from '@/store/encounterStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function resetEncounters() {
  const state = useEncounterStore.getState();
  for (const e of state.getEncountersByCampaign('ABC123')) {
    state.deleteEncounter(e.id);
  }
}

function renderPanel(linked: string[], ids: Record<string, string>) {
  const onLink = vi.fn();
  const onUnlink = vi.fn();
  render(
    <EncounterLinkingPanel
      campaignCode="ABC123"
      linkedEncounterIds={linked.map(n => ids[n])}
      onLink={onLink}
      onUnlink={onUnlink}
    />
  );
  return { onLink, onUnlink };
}

describe('EncounterLinkingPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    resetEncounters();
  });

  it('shows the heading and an empty line when the campaign has no encounters', () => {
    renderPanel([], {});
    expect(screen.getByText('Linked encounters')).toBeInTheDocument();
    expect(
      screen.getByText('No encounters in this campaign')
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('lists linked encounters with a named unlink button', () => {
    const store = useEncounterStore.getState();
    const ids = {
      Ambush: store.createEncounter('Ambush', 'ABC123'),
      Lair: store.createEncounter('Lair', 'ABC123'),
    };
    const { onUnlink } = renderPanel(['Ambush'], ids);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Ambush')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Ambush' }));
    expect(onUnlink).toHaveBeenCalledWith(ids.Ambush);
  });

  it('offers unlinked encounters in a labelled picker and links the choice', async () => {
    const user = userEvent.setup();
    const store = useEncounterStore.getState();
    const ids = {
      Ambush: store.createEncounter('Ambush', 'ABC123'),
      Lair: store.createEncounter('Lair', 'ABC123'),
    };
    const { onLink } = renderPanel(['Ambush'], ids);
    const trigger = screen.getByRole('combobox', {
      name: 'Link an encounter…',
    });
    expect(trigger).toHaveTextContent('Link an encounter…');

    await user.click(trigger);
    expect(
      screen.queryByRole('option', { name: 'Ambush' })
    ).not.toBeInTheDocument();
    const option = await screen.findByRole('option', { name: 'Lair' });
    fireEvent.click(option);
    await waitFor(() => expect(onLink).toHaveBeenCalledWith(ids.Lair));
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox')).toHaveTextContent(
      'Link an encounter…'
    );
  });

  it('hides the picker when every encounter is linked', () => {
    const store = useEncounterStore.getState();
    const ids = { Ambush: store.createEncounter('Ambush', 'ABC123') };
    renderPanel(['Ambush'], ids);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
