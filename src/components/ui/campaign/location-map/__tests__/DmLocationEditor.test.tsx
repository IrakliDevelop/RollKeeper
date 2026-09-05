import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Viewport } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';

import DmLocationEditor from '@/components/ui/campaign/location-map/DmLocationEditor';
import type { DmLocationEditorState } from '@/components/ui/campaign/location-map/DmLocationEditor.hooks';
import type { LocationMap } from '@/types/location';

// Full component render (real Canvas -> real Viewport) needs a live canvas
// element unavailable in jsdom; the editor's own state machine is already
// covered by DmLocationEditor.hooks.test.ts. Here we stub the hook so this
// test can focus purely on wiring: does the editor's render site forward
// `selectionControls` into the shared tool options bar once a viewport
// exists?
vi.mock('../DmLocationEditor.hooks', () => ({
  useDmLocationEditor: vi.fn(),
}));

// FieldNotesCanvas would otherwise try to instantiate a real @fieldnotes/core
// Viewport against the DOM node — irrelevant here since the stubbed hook
// above already supplies `viewport` directly.
vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: () => null,
  };
});

// DmLocationToolbar renders real @fieldnotes/react hooks (useHistory etc.)
// that expect a fully-featured viewport; stub it out since this test only
// cares about the options-bar wiring below it.
vi.mock('../DmLocationToolbar', () => ({
  default: () => null,
}));

vi.mock('../DmLocationToolOptions', () => ({
  default: vi.fn(() => null),
}));

vi.mock('@/components/ui/forms/CompactRichTextEditor', () => ({
  CompactRichTextEditor: ({
    content,
    ariaLabel,
  }: {
    content: string;
    ariaLabel?: string;
  }) => <textarea aria-label={ariaLabel} value={content} readOnly />,
}));

import DmLocationToolOptions from '../DmLocationToolOptions';
import { useDmLocationEditor } from '../DmLocationEditor.hooks';

const baseLocation: LocationMap = {
  id: 'loc-1',
  campaignCode: 'TEST01',
  name: 'Test Map',
  mapImageUrl: '',
  mapImageSize: { w: 100, h: 100 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeHookState(
  overrides: Partial<DmLocationEditorState> = {}
): DmLocationEditorState {
  return {
    mode: 'location',
    canvasRef: { current: null },
    fileInputRef: { current: null },
    mapImageInputRef: { current: null },
    viewport: { setFogStyle: vi.fn() } as unknown as Viewport,
    tools: [],
    layersPanelOpen: false,
    setLayersPanelOpen: vi.fn(),
    gridEnabled: false,
    gridType: 'hex',
    gridCellSize: 50,
    gridColor: '#94a3b8',
    gridOpacity: 0.5,
    handleSetGridType: vi.fn(),
    handleUpdateGridSettings: vi.fn(),
    dmOnlyElements: {},
    selectedElementId: null,
    isDmOnly: false,
    handleToggleDmOnly: vi.fn(),
    hiddenPlacementActive: false,
    handleToggleHiddenPlacement: vi.fn(),
    hiddenElementCount: 0,
    handleRevealAll: vi.fn(),
    syncing: false,
    imageUploading: false,
    setImageUploading: vi.fn(),
    hasUnsyncedChanges: false,
    lastSyncedAt: null,
    syncStatus: 'disabled',
    sharedWithPlayers: false,
    handleToggleShareWithPlayers: vi.fn(),
    handleReady: vi.fn(),
    handlePickImage: vi.fn(),
    handleClear: vi.fn(),
    handleSyncToPlayers: vi.fn(async () => {}),
    handleImageFileSelect: vi.fn(async () => {}),
    handlePickMapImage: vi.fn(),
    handleMapImageFileSelect: vi.fn(async () => {}),
    handleOpenTvDisplay: vi.fn(async () => {}),
    handleFitToMap: vi.fn(),
    arrangeMapsActive: false,
    handleToggleArrangeMaps: vi.fn(),
    publishLayerUpsert: vi.fn(),
    publishLayerRemove: vi.fn(),
    measureSharing: false,
    handleSetMeasureSharing: vi.fn(),
    getViewport: vi.fn(() => null),
    getDmOnlyElements: vi.fn(() => ({})),
    ...overrides,
  } as DmLocationEditorState & {
    canvasRef: React.RefObject<FieldNotesCanvasRef | null>;
  };
}

describe('DmLocationEditor wiring', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('hides the appearance selector while viewer propagation is gated off', () => {
    vi.mocked(useDmLocationEditor).mockReturnValue(makeHookState());

    render(
      <DmLocationEditor
        location={{ ...baseLocation, fogAppearance: 'cloudy' }}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );

    const lastProps = vi.mocked(DmLocationToolOptions).mock.calls.at(-1)?.[0];
    expect(lastProps?.fogAppearance).toBe('solid');
    expect(lastProps?.onFogAppearanceChange).toBeUndefined();
  });

  it('applies and exposes a normalized appearance when the rollout flag is on', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    const hookState = makeHookState();
    vi.mocked(useDmLocationEditor).mockReturnValue(hookState);

    render(
      <DmLocationEditor
        location={{ ...baseLocation, fogAppearance: 'cloudy' }}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );

    expect(hookState.viewport?.setFogStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        editorStyle: expect.objectContaining({ kind: 'procedural' }),
      })
    );
    const lastProps = vi.mocked(DmLocationToolOptions).mock.calls.at(-1)?.[0];
    expect(lastProps?.fogAppearance).toBe('cloudy');
    expect(lastProps?.onFogAppearanceChange).toBe(
      hookState.handleFogAppearanceChange
    );
  });

  it('passes selectionControls to the shared tool options bar once a viewport exists', () => {
    vi.mocked(useDmLocationEditor).mockReturnValue(makeHookState());

    render(
      <DmLocationEditor
        location={baseLocation}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );

    const lastProps = vi.mocked(DmLocationToolOptions).mock.calls.at(-1)?.[0];
    expect(lastProps).toEqual(
      expect.objectContaining({ mode: 'location', selectionControls: true })
    );
  });

  it('threads markerControls into the shared tool options bar', () => {
    const markerControls = {
      kind: 'secret' as const,
      color: 'purple' as const,
      onKindChange: vi.fn(),
      onColorChange: vi.fn(),
    };
    vi.mocked(useDmLocationEditor).mockReturnValue(
      makeHookState({ markerControls })
    );

    render(
      <DmLocationEditor
        location={baseLocation}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );

    const lastProps = vi.mocked(DmLocationToolOptions).mock.calls.at(-1)?.[0];
    expect(lastProps).toEqual(expect.objectContaining({ markerControls }));
  });

  it('mounts the marker detail panel only while a marker is active', () => {
    vi.mocked(useDmLocationEditor).mockReturnValue(
      makeHookState({ markerPanelOpen: false })
    );
    const { unmount } = render(
      <DmLocationEditor
        location={baseLocation}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    vi.mocked(useDmLocationEditor).mockReturnValue(
      makeHookState({
        markerPanelOpen: true,
        markerPanelState: {
          kind: 'ready',
          data: { v: 1, kind: 'trap', ref: 'ref-1' },
          detail: {
            id: 'ref-1',
            title: 'Pit',
            body: 'Deep.',
            dmNotes: 'DC 15',
          },
        },
      })
    );
    render(
      <DmLocationEditor
        location={baseLocation}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // mode="dm" reaches the panel: the DM edit form (and only it) carries the
    // dmNotes field.
    expect(
      screen.getByLabelText(/DM notes — never shown to players/)
    ).toHaveValue('DC 15');
  });

  it('saves, closes, and confirms a marker edit', async () => {
    const user = userEvent.setup();
    const handleSaveMarkerDetail = vi.fn();
    const handleCloseMarkerPanel = vi.fn();
    vi.mocked(useDmLocationEditor).mockReturnValue(
      makeHookState({
        markerPanelOpen: true,
        markerPanelState: {
          kind: 'ready',
          data: { v: 1, kind: 'note', ref: 'ref-1' },
          detail: {
            id: 'ref-1',
            title: 'Clue',
            body: 'Writing on the wall',
            dmNotes: 'Private context',
          },
        },
        handleSaveMarkerDetail,
        handleCloseMarkerPanel,
      })
    );

    render(
      <DmLocationEditor
        location={baseLocation}
        campaignCode="TEST01"
        dmId="dm-1"
        onSave={vi.fn()}
        onSyncToPlayers={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(handleSaveMarkerDetail).toHaveBeenCalledOnce();
    expect(handleCloseMarkerPanel).toHaveBeenCalledOnce();
    expect(screen.getByText('Marker saved')).toBeInTheDocument();
  });
});
