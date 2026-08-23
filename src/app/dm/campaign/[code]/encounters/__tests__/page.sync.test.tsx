import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EncounterSyncProvider } from '@/components/ui/campaign/EncounterSyncControls';
import { useCharacterStore } from '@/store/characterStore';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';

import CampaignEncountersPage from '../page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: 'SYNTH1' }),
}));

const NOW = '2026-08-23T00:00:00.000Z';

function renderPage() {
  return render(
    <EncounterSyncProvider campaignCode="SYNTH1">
      <CampaignEncountersPage />
    </EncounterSyncProvider>
  );
}

describe('campaign encounters page cloud sync card', () => {
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: true });
    useDmStore.setState({
      campaigns: [{ code: 'SYNTH1', name: 'Encounters', createdAt: NOW }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    useEncounterStore.setState({ encounters: [], encounterTombstones: {} });
    localStorage.clear();
  });

  it('keeps the default-off card and its network work off the encounters page', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderPage();

    // The campaign exists, so the missing card is attributable to the flag.
    expect(useDmStore.getState().getCampaign('SYNTH1')).toBeDefined();
    expect(screen.queryByText('Encounter cloud sync')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('renders the card directly under the encounter list', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');

    const { container } = renderPage();

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(within(main!).getByText('Encounter cloud sync')).toBeVisible();
    // The card sits after the list, never above or outside it.
    expect(main!.lastElementChild?.textContent).toContain(
      'Encounter cloud sync'
    );
  });

  it('renders no card while the campaign is unknown to the DM store', () => {
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    useDmStore.setState({ campaigns: [] });

    renderPage();

    expect(screen.queryByText('Encounter cloud sync')).toBeNull();
  });
});
