import type React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEncounterStore } from '@/store/encounterStore';

const links = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/components/ui/campaign/table/combat/useSceneRunLinks', () => ({
  useSceneRunLinks: () => links.value,
  SceneRunLinksProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { EncounterBattleMapButton } from '../EncounterBattleMapButton';
import { EncounterList } from '../EncounterList';

afterEach(cleanup);
beforeEach(() => {
  links.value = [];
  useEncounterStore.setState({
    encounters: [
      {
        id: 'enc-1',
        name: 'Old fight',
        campaignCode: 'CAMP',
        entities: [],
        currentTurn: 0,
        round: 0,
        isActive: false,
        sortOrder: 'initiative',
        createdAt: '2026-10-07T00:00:00.000Z',
        updatedAt: '2026-10-07T00:00:00.000Z',
      },
    ],
  });
});

describe('"Open scene run" library affordance (D10)', () => {
  it('is absent when the workspace has no matching scene run', () => {
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(screen.queryByText(/Open scene run/)).toBeNull();
    render(<EncounterList campaignCode="CAMP" />);
    expect(screen.queryByText(/Open scene run/)).toBeNull();
  });

  it('links the encounter header and card to the Table scene with the run selected', () => {
    links.value = [
      {
        runId: 'run-0',
        sceneId: 'scene-1',
        label: 'Adopted fight',
        localWorkspaceId: 'workspace-1',
        defaultWorkspace: true,
      },
    ];
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    const header = screen.getByRole('link', { name: /Open scene run/ });
    expect(header).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-1&run=run-0'
    );
    expect(screen.getAllByText(/saved on this device/i)[0]).toBeVisible();
    cleanup();
    render(<EncounterList campaignCode="CAMP" />);
    expect(
      screen.getByRole('link', { name: /Open scene run/ })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-1&run=run-0'
    );
    // The original encounter link is unchanged (never redirected).
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/encounters/enc-1'
    );
  });

  it('keeps an imported workspace selection in the link', () => {
    links.value = [
      {
        runId: 'run-9',
        sceneId: 'scene-2',
        label: 'Fork',
        localWorkspaceId: 'fork-1',
        defaultWorkspace: false,
      },
    ];
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(
      screen.getByRole('link', { name: /Open scene run/ })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-2&run=run-9&tableWorkspace=fork-1'
    );
  });

  it('offers an explicit run selector when the encounter has several copies (W7)', () => {
    links.value = [
      {
        runId: 'run-a',
        sceneId: 'scene-tavern',
        label: 'Bandit ambush',
        localWorkspaceId: 'workspace-1',
        defaultWorkspace: true,
        sceneName: 'Tavern',
        createdAt: '2026-10-07T00:00:00.000Z',
      },
      {
        runId: 'run-b',
        sceneId: 'scene-forest',
        label: 'Bandit ambush (2)',
        localWorkspaceId: 'workspace-1',
        defaultWorkspace: true,
        sceneName: 'Forest',
        createdAt: '2026-10-08T00:00:00.000Z',
      },
    ];
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(screen.queryByRole('link', { name: /Open scene run/ })).toBeNull();
    const toggle = screen.getByRole('button', { name: /Open scene run \(2\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const tavern = screen.getByRole('link', { name: /Tavern · Bandit ambush/ });
    expect(tavern).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-tavern&run=run-a'
    );
    expect(tavern.textContent).toContain(
      new Date('2026-10-07T00:00:00.000Z').toLocaleDateString()
    );
    expect(
      screen.getByRole('link', { name: /Forest · Bandit ambush \(2\)/ })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-forest&run=run-b'
    );
  });
});
