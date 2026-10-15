import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => ({
  scene: null as null | {
    sceneId: string;
    localWorkspaceId: string;
    defaultWorkspace: boolean;
  },
  calls: 0,
}));
vi.mock('@/lib/table/combatLibrary', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/table/combatLibrary')>()),
  findTableSceneForMap: vi.fn(async () => {
    lookup.calls += 1;
    return lookup.scene;
  }),
}));

import { DmVttTopBar } from '../DmVttTopBar';

function renderBar() {
  return render(
    <DmVttTopBar
      campaignCode="CAMP"
      battleMapId="map-1"
      dmId="dm-1"
      mapName="Map"
      gridMode="hex"
      onSetGridMode={() => {}}
      mode="play"
      onModeChange={() => {}}
    />
  );
}

beforeEach(() => {
  lookup.scene = null;
  lookup.calls = 0;
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Play mode Table entry (FU-8)', () => {
  it('links the adopted scene with "Open in Table"', async () => {
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'fork-1',
      defaultWorkspace: false,
    };
    renderBar();
    expect(
      await screen.findByRole('link', { name: /Open in Table/u })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table?scene=scene-9&tableWorkspace=fork-1'
    );
  });

  it('offers "Use in Table" (Scenes panel) when the map is not adopted', async () => {
    renderBar();
    expect(
      await screen.findByRole('link', { name: /Use in Table/u })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/table?panel=scenes');
  });

  it.each([
    [
      'Open in Table',
      { sceneId: 's', localWorkspaceId: 'w', defaultWorkspace: true },
    ],
    ['Use in Table', null],
  ])(
    'is compact below lg like Open display: icon, lg-only text, aria-label "%s" (R4-5)',
    async (label, scene) => {
      lookup.scene = scene;
      renderBar();
      const link = await screen.findByRole('link', { name: label });
      const button = link.querySelector('button')!;
      expect(button).toHaveAttribute('aria-label', label);
      expect(button.querySelector('svg')).not.toBeNull();
      const text = Array.from(button.querySelectorAll('span')).find(
        span => span.textContent === label
      );
      expect(text).toHaveClass('hidden', 'lg:inline');
    }
  );
});

describe('privacy label by Table state (PR08 repair 07 CC3)', () => {
  it('a map on the Table says it is a private copy and players see the scene', async () => {
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'fork-1',
      defaultWorkspace: true,
    };
    renderBar();
    expect(
      await screen.findByText(
        'Private copy. Players see the Table scene, not edits here.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText("Private. Players don't see this map.")
    ).toBeNull();
  });

  it('a map not on the Table says players do not see it', async () => {
    renderBar();
    await screen.findByRole('link', { name: /Use in Table/u });
    expect(
      screen.getByText("Private. Players don't see this map.")
    ).toBeVisible();
    expect(
      screen.queryByText(
        'Private copy. Players see the Table scene, not edits here.'
      )
    ).toBeNull();
  });
});
