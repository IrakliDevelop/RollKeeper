import 'fake-indexeddb/auto';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEncounterSyncContext } from '@/components/ui/campaign/EncounterSyncControls';
import { useNpcSyncContext } from '@/components/ui/campaign/NpcSyncControls';
import { useDmStore } from '@/store/dmStore';

import CampaignRouteLayout from '../layout';

/** Reads both route-group owners from inside the layout tree. */
function OwnerProbe() {
  const npc = useNpcSyncContext();
  const encounter = useEncounterSyncContext();
  return (
    <p>{`npc:${npc ? 'owner' : 'none'} encounter:${encounter ? 'owner' : 'none'}`}</p>
  );
}

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'SYNTH1' }),
}));

describe('campaign route group layout', () => {
  beforeEach(() => {
    useDmStore.setState({
      campaigns: [
        { code: 'SYNTH1', name: 'Synthetic canary', createdAt: 'now' },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('mounts exactly one NPC owner and one encounter owner for the group', async () => {
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { container } = render(
      <CampaignRouteLayout>
        <OwnerProbe />
      </CampaignRouteLayout>
    );

    // Ruling 7: the encounter owner is nested inside the existing NPC owner,
    // so both contexts reach every route under the group.
    expect(screen.getByText('npc:owner encounter:owner')).toBeInTheDocument();
    expect(container.innerHTML).toBe('<p>npc:owner encounter:owner</p>');
    await Promise.resolve();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    open.mockRestore();
    fetchSpy.mockRestore();
  });

  it('renders the route content unchanged and does no NPC or encounter work by default', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { container } = render(
      <CampaignRouteLayout>
        <p>battlemap display</p>
      </CampaignRouteLayout>
    );

    expect(screen.getByText('battlemap display')).toBeInTheDocument();
    // The owner adds no DOM, so no route under the group changes its markup.
    expect(container.innerHTML).toBe('<p>battlemap display</p>');
    await Promise.resolve();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    getItem.mockRestore();
    setItem.mockRestore();
    open.mockRestore();
    fetchSpy.mockRestore();
  });
});
