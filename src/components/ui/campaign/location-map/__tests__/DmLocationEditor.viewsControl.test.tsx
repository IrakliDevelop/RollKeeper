import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Viewport, CameraView, FocusAudience } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';

import DmLocationEditor from '../DmLocationEditor';
import type { DmLocationEditorState } from '../DmLocationEditor.hooks';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';
import type { BattleMapViewsControlProps } from '../BattleMapViewsControl';

// Mirrors DmLocationEditor.test.tsx's stubbing strategy (real Canvas needs a
// live canvas element unavailable in jsdom; the editor's own state machine is
// covered separately by DmLocationEditor.hooks.test.ts). This file's own
// focus is the Task 13 wiring: does the editor's render site forward a live
// `viewsControl` into the toolbar in battlemap mode, and does it round-trip
// through the real battleMapStore correctly?
vi.mock('../DmLocationEditor.hooks', () => ({
  useDmLocationEditor: vi.fn(),
}));

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: () => null,
  };
});

vi.mock('../DmLocationToolbar', () => ({
  default: vi.fn(() => null),
}));

vi.mock('../DmLocationToolOptions', () => ({
  default: vi.fn(() => null),
}));

import DmLocationToolbar from '../DmLocationToolbar';
import { useDmLocationEditor } from '../DmLocationEditor.hooks';

const CAMPAIGN_CODE = 'TEST01';
const MAP_ID = 'bm-1';

const baseBattleMap: BattleMap = {
  id: MAP_ID,
  campaignCode: CAMPAIGN_CODE,
  name: 'Test Map',
  mapImageUrl: '',
  mapImageSize: { w: 100, h: 100 },
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  cameraViews: [{ id: 'v1', name: 'Ambush', view: { x: 0, y: 0, w: 1, h: 1 } }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const handleGoToCameraView = vi.fn();
const handleSendCameraView = vi.fn();

function makeHookState(
  overrides: Partial<DmLocationEditorState> = {}
): DmLocationEditorState {
  return {
    mode: 'battlemap',
    canvasRef: { current: null },
    fileInputRef: { current: null },
    mapImageInputRef: { current: null },
    viewport: {} as Viewport,
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
    handleGoToCameraView,
    handleSendCameraView,
    getViewport: vi.fn(() => null),
    getDmOnlyElements: vi.fn(() => ({})),
    ...overrides,
  } as DmLocationEditorState & {
    canvasRef: React.RefObject<FieldNotesCanvasRef | null>;
  };
}

function renderEditor() {
  return render(
    <DmLocationEditor
      location={baseBattleMap}
      campaignCode={CAMPAIGN_CODE}
      dmId="dm-1"
      mode="battlemap"
      onSave={vi.fn()}
      onSyncToPlayers={vi.fn()}
    />
  );
}

/** Pull the live `viewsControl` element the editor passed to the (mocked)
 * toolbar on its most recent render. */
function getViewsControlProps(): BattleMapViewsControlProps {
  const lastCall = vi.mocked(DmLocationToolbar).mock.calls.at(-1);
  const viewsControl = lastCall?.[0]?.viewsControl as
    | ReactElement<BattleMapViewsControlProps>
    | undefined;
  expect(viewsControl).toBeDefined();
  return viewsControl!.props;
}

describe('DmLocationEditor viewsControl wiring (battlemap mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [MAP_ID]: baseBattleMap } },
    });
    vi.mocked(useDmLocationEditor).mockReturnValue(makeHookState());
  });

  afterEach(() => cleanup());

  it('reaches the toolbar with a live viewsControl once a viewport exists', () => {
    renderEditor();
    const lastProps = vi.mocked(DmLocationToolbar).mock.calls.at(-1)?.[0];
    expect(lastProps?.viewsControl).toBeTruthy();
  });

  it('onSaveView appends a NEW cameraViews array via updateBattleMap (store round-trip)', () => {
    renderEditor();
    const props = getViewsControlProps();
    const originalArray = baseBattleMap.cameraViews;
    const newView: CameraView = { x: 1, y: 2, w: 3, h: 4 };

    props.onSaveView(newView, 'Throne room');

    const stored = useBattleMapStore
      .getState()
      .getBattleMap(CAMPAIGN_CODE, MAP_ID);
    expect(stored?.cameraViews).not.toBe(originalArray);
    expect(stored?.cameraViews).toHaveLength(2);
    expect(stored?.cameraViews?.[1]).toMatchObject({
      name: 'Throne room',
      view: newView,
    });
  });

  it('onDeleteView removes the matching entry via a NEW filtered array', () => {
    renderEditor();
    const props = getViewsControlProps();
    const originalArray = baseBattleMap.cameraViews;

    props.onDeleteView('v1');

    const stored = useBattleMapStore
      .getState()
      .getBattleMap(CAMPAIGN_CODE, MAP_ID);
    expect(stored?.cameraViews).not.toBe(originalArray);
    expect(stored?.cameraViews).toHaveLength(0);
  });

  it('wires onGoToView/onSend straight through to the hook camera-view callbacks', () => {
    renderEditor();
    const props = getViewsControlProps();
    const view: CameraView = { x: 5, y: 6, w: 7, h: 8 };
    const audience: FocusAudience = 'display';

    props.onGoToView(view);
    expect(handleGoToCameraView).toHaveBeenCalledWith(view);

    props.onSend(view, audience);
    expect(handleSendCameraView).toHaveBeenCalledWith(view, audience);
  });
});
