import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

const FLAG = 'NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED';
const saved = process.env[FLAG];

function renderBar() {
  return render(
    <DmVttTopBar
      campaignCode="CAMP"
      battleMapId="map-1"
      dmId="dm-1"
      mapName="Map"
      status="live"
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
  if (saved === undefined) delete process.env[FLAG];
  else process.env[FLAG] = saved;
});

describe('Play mode Table entry (FU-8)', () => {
  it('links the adopted scene with "Open in Table" under the flag', async () => {
    process.env[FLAG] = 'true';
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
    process.env[FLAG] = 'true';
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
      process.env[FLAG] = 'true';
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

  it('flag off: no Table link and no lookup (unchanged Play mode)', async () => {
    delete process.env[FLAG];
    lookup.scene = {
      sceneId: 'scene-9',
      localWorkspaceId: 'w',
      defaultWorkspace: true,
    };
    renderBar();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Play' })).toBeVisible()
    );
    expect(screen.queryByRole('link', { name: /in Table/u })).toBeNull();
    expect(lookup.calls).toBe(0);
  });
});
