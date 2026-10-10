import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableSceneRecordV1 } from '@/lib/table/schema';

import { TableSceneBrowser, TableScenesToggle } from './TableSceneBrowser';

const AT = '2026-10-08T00:00:00.000Z';

function scene(
  sceneId: string,
  name: string,
  mapImageUrl = ''
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey: 'guest/workspace:w1',
    sceneId,
    originalMapId: null,
    map: {
      name,
      mapImageUrl,
      mapImageSize: { w: 0, h: 0 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members: [],
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

const SCENES = [
  scene(
    'scene-cave',
    'Cave',
    'https://bucket.s3.eu-west-1.amazonaws.com/cave.mp4'
  ),
  scene('scene-forest', 'Forest'),
  scene('scene-tavern', 'Tavern', 'https://example.test/tavern.webp'),
];

function renderBrowser(
  overrides: Partial<Parameters<typeof TableSceneBrowser>[0]> = {}
) {
  const props: Parameters<typeof TableSceneBrowser>[0] = {
    open: true,
    onClose: vi.fn(),
    scenes: SCENES,
    selectedSceneId: 'scene-forest',
    presentation: { sceneId: 'scene-tavern', blanked: false },
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    adoptable: [{ id: 'map-crypt', name: 'Crypt' }],
    onAdopt: vi.fn(),
    battleMapsHref: '/dm/campaign/CAMP/battlemaps',
    ...overrides,
  };
  render(<TableSceneBrowser {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('W5 private scene browser', () => {
  it('lists scenes as buttons with Selected/Shown badges from the descriptor', () => {
    renderBrowser();
    const list = screen.getByRole('list', { name: 'Scenes on this table' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map(button => button.textContent)).toEqual([
      expect.stringContaining('Cave'),
      expect.stringContaining('Forest'),
      expect.stringContaining('Tavern'),
    ]);
    const forest = screen.getByRole('button', { name: /Forest/u });
    expect(forest).toHaveAttribute('aria-current', 'true');
    expect(within(forest).getByText('Selected')).toBeInTheDocument();
    const tavern = screen.getByRole('button', { name: /Tavern/u });
    expect(tavern).not.toHaveAttribute('aria-current');
    expect(within(tavern).getByText('Shown')).toBeInTheDocument();
    expect(within(tavern).queryByText('Blanked')).not.toBeInTheDocument();
  });

  it('shows Blanked instead of Shown for a blanked presented scene', () => {
    renderBrowser({ presentation: { sceneId: 'scene-tavern', blanked: true } });
    const tavern = screen.getByRole('button', { name: /Tavern/u });
    expect(within(tavern).getByText('Blanked')).toBeInTheDocument();
    expect(within(tavern).queryByText('Shown')).not.toBeInTheDocument();
  });

  it('renders thumbnails from local data only, as private <img> with fallbacks', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderBrowser();
    const tavern = screen.getByRole('button', { name: /Tavern/u });
    const image = tavern.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://example.test/tavern.webp');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('loading', 'lazy');
    // Blank scene and video map: placeholder, never a <video>.
    const forest = screen.getByRole('button', { name: /Forest/u });
    expect(within(forest).getByText('No image')).toBeInTheDocument();
    const cave = screen.getByRole('button', { name: /Cave/u });
    expect(within(cave).getByText('No image')).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
    fireEvent.error(image!);
    expect(within(tavern).getByText('No image')).toBeInTheDocument();
    expect(tavern.querySelector('img')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('selects privately and offers create, adopt and the bundle link', () => {
    const props = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: /Tavern/u }));
    expect(props.onSelect).toHaveBeenCalledWith('scene-tavern');
    fireEvent.click(screen.getByRole('button', { name: 'New scene' }));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add Crypt' }));
    expect(props.onAdopt).toHaveBeenCalledWith('map-crypt');
    expect(
      screen.getByRole('link', {
        name: /Export or import tables on Battle Maps/u,
      })
    ).toHaveAttribute('href', '/dm/campaign/CAMP/battlemaps');
  });

  it('closes on Escape from inside the panel and renders nothing when closed', () => {
    const props = renderBrowser();
    fireEvent.keyDown(screen.getByRole('button', { name: /Forest/u }), {
      key: 'Escape',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    cleanup();
    renderBrowser({ open: false });
    expect(
      screen.queryByRole('region', { name: 'Scenes' })
    ).not.toBeInTheDocument();
  });

  it('exposes the panel toggle with aria-expanded and aria-controls', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <TableScenesToggle open={false} onToggle={onToggle} />
    );
    const toggle = screen.getByRole('button', { name: 'Scenes' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'table-scenes-panel');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<TableScenesToggle open onToggle={onToggle} />);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('says when the workspace has no scenes yet', () => {
    renderBrowser({ scenes: [], selectedSceneId: null });
    expect(
      screen.getByText('No scenes yet. Create one or add a battle map.')
    ).toBeInTheDocument();
  });

  it('keeps a raw add-map outcome code in the tooltip only (O7-3)', () => {
    renderBrowser({
      status: {
        tone: 'alert',
        text: "The battle map wasn't added.",
        detail: 'limit-exceeded',
      },
    });
    const line = screen.getByRole('alert');
    expect(line).toHaveTextContent("The battle map wasn't added.");
    expect(line).toHaveAttribute('title', 'limit-exceeded');
  });
});
