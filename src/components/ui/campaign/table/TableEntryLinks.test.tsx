import fs from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

const FLAG = 'NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED';
let previous: string | undefined;
beforeEach(() => {
  previous = process.env[FLAG];
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
  if (previous === undefined) delete process.env[FLAG];
  else process.env[FLAG] = previous;
});

const flag = (on: boolean) => {
  if (on) process.env[FLAG] = 'true';
  else delete process.env[FLAG];
};

describe('A6 entry points under the existing Table v1 flag', () => {
  it('dashboard "Open Table" links the workspace with the flag on, nothing with it off', () => {
    flag(true);
    render(<CampaignTableLauncher code="CAMP 1" />);
    expect(screen.getByRole('link', { name: /Open Table/u })).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP%201/table'
    );
    cleanup();
    flag(false);
    const { container } = render(<CampaignTableLauncher code="CAMP" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the dashboard renders the launcher beside the display launcher', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../../app/dm/campaign/[code]/page.tsx'),
      'utf8'
    );
    expect(source).toContain('<CampaignTableLauncher code={code} />');
  });

  it('"Prepare on map" opens the workspace with the encounter (flag on only)', () => {
    flag(true);
    render(<PrepareOnMapLink campaignCode="CAMP" encounterId="enc-1" />);
    expect(
      screen.getByRole('link', { name: /Prepare on map/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?prepareEncounter=enc-1');
    cleanup();
    flag(false);
    const { container } = render(
      <PrepareOnMapLink campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('the encounter header and card offer "Prepare on map" only with the flag on', () => {
    flag(true);
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
    cleanup();
    flag(false);
    render(
      <EncounterBattleMapButton campaignCode="CAMP" encounterId="enc-1" />
    );
    expect(screen.queryByRole('link', { name: /Prepare on map/u })).toBeNull();
    expect(screen.getByRole('button', { name: 'Battle map' })).toBeVisible();
    cleanup();
    render(<EncounterList campaignCode="CAMP" />);
    expect(screen.queryByRole('link', { name: /Prepare on map/u })).toBeNull();
  });

  it('the original map route offers "Open in Table" for an adopted map', async () => {
    flag(true);
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
    flag(true);
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
    flag(true);
    render(<TableMapEntryLink campaignCode="CAMP" mapId="map-2" />);
    expect(
      await screen.findByRole('link', { name: /Use in Table/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?panel=scenes');
  });

  it('shows nothing on the original map route with the flag off', async () => {
    flag(false);
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'w',
      defaultWorkspace: true,
    };
    const { container } = render(
      <TableMapEntryLink campaignCode="CAMP" mapId="map-1" />
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
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
      '<TableMapEntryLink campaignCode={code} mapId={id} />'
    );
  });
});
