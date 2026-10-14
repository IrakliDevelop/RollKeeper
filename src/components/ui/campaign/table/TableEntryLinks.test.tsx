import fs from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEncounterStore } from '@/store/encounterStore';

const lookup = vi.hoisted(() => ({
  scene: null as null | {
    sceneId: string;
    localWorkspaceId: string;
    defaultWorkspace: boolean;
  },
}));
vi.mock('@/lib/table/combatLibrary', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/table/combatLibrary')>()),
  findTableSceneForMap: vi.fn(async () => lookup.scene),
  findSceneRunsForCampaign: vi.fn(async () => new Map()),
  findSceneRunsForEncounter: vi.fn(async () => []),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { EncounterBattleMapButton } from '@/components/ui/encounter/EncounterBattleMapButton';
import { EncounterList } from '@/components/ui/encounter/EncounterList';

import {
  CampaignTableLauncher,
  PrepareOnMapLink,
  TableMapEntryLink,
} from './TableEntryLinks';

beforeEach(() => {
  lookup.scene = null;
  useEncounterStore.setState({
    encounters: [
      {
        id: 'enc-1',
        name: 'Bandit ambush',
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
  } as never);
});
afterEach(() => {
  cleanup();
});

describe('A6 Table entry points', () => {
  it('dashboard "Open Table" links the workspace', () => {
    render(<CampaignTableLauncher code="CAMP 1" />);
    expect(screen.getByRole('link', { name: /Open Table/u })).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP%201/table'
    );
  });

  it('the dashboard renders the launcher beside the display launcher', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../../app/dm/campaign/[code]/page.tsx'),
      'utf8'
    );
    expect(source).toContain('<CampaignTableLauncher code={code} />');
  });

  it('"Prepare on map" opens the workspace with the encounter', () => {
    render(<PrepareOnMapLink campaignCode="CAMP" encounterId="enc-1" />);
    expect(
      screen.getByRole('link', { name: /Prepare on map/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?prepareEncounter=enc-1');
  });

  it('the encounter header and card offer "Prepare on map"', () => {
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(screen.getByRole('link', { name: /Prepare on map/u })).toBeVisible();
    // The legacy picker stays available.
    expect(screen.getByRole('button', { name: 'Battle map' })).toBeVisible();
    cleanup();
    render(<EncounterList campaignCode="CAMP" />);
    expect(
      screen.getByRole('link', { name: /Prepare on map/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?prepareEncounter=enc-1');
  });

  it('the original map route offers "Open in Table" for an adopted map', async () => {
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'workspace-1',
      defaultWorkspace: true,
    };
    render(<TableMapEntryLink campaignCode="CAMP" mapId="map-1" />);
    expect(
      await screen.findByRole('link', { name: /Open in Table/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?scene=scene-9');
  });

  it('keeps an imported workspace selection in "Open in Table"', async () => {
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'fork-1',
      defaultWorkspace: false,
    };
    render(<TableMapEntryLink campaignCode="CAMP" mapId="map-1" />);
    expect(
      await screen.findByRole('link', { name: /Open in Table/u })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-9&tableWorkspace=fork-1'
    );
  });

  it('offers "Use in Table" with the Scenes panel for an unadopted map', async () => {
    render(<TableMapEntryLink campaignCode="CAMP" mapId="map-2" />);
    expect(
      await screen.findByRole('link', { name: /Use in Table/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?panel=scenes');
  });

  it('the original map route renders the affordance', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../app/dm/campaign/[code]/battlemaps/[id]/page.tsx'
      ),
      'utf8'
    );
    expect(source).toContain(
      '<TableMapEntryLink campaignCode={code} mapId={id} compact />'
    );
  });
});
