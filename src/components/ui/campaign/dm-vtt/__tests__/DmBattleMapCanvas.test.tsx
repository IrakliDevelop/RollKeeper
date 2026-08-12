import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Viewport, CameraView, FocusAudience } from '@fieldnotes/core';

import { DmBattleMapCanvas } from '@/components/ui/campaign/dm-vtt/DmBattleMapCanvas';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';
import type { BattleMapViewsControlProps } from '@/components/ui/campaign/location-map/BattleMapViewsControl';
import type { MarkerToolControls } from '@/components/ui/campaign/location-map/DmLocationToolOptions';
import type { MarkerPanelState } from '@/components/ui/campaign/location-map/MarkerDetailPanel/MarkerDetailPanel.types';

// Full component render (real Canvas -> real Viewport) needs a live canvas
// element unavailable in jsdom; the connection/attach wiring itself is
// covered by focusSync.test.ts (attachFocusBroadcast) and DmBattleMapCanvas
// composes that through the hook, stubbed here. This test focuses purely on
// wiring: does the canvas's render site forward a live `viewsControl` into
// the toolbar, and do its callbacks round-trip through the real
// battleMapStore (and the hook's camera-view callbacks) correctly?
const mockHookState = {
  viewport: {} as Viewport,
  status: 'live' as const,
  battleMap: undefined as BattleMap | undefined,
  tools: [],
  handleReady: vi.fn(),
  handleClearDrawings: vi.fn(),
  hiddenPlacementActive: false,
  handleToggleHiddenPlacement: vi.fn(),
  hiddenElementCount: 0,
  handleRevealAll: vi.fn(),
  selectedElementId: null,
  selectedElementIsDmOnly: false,
  handleToggleSelectedDmOnly: vi.fn(),
  measureSharing: false,
  handleSetMeasureSharing: vi.fn(),
  handleGoToCameraView: vi.fn(),
  handleSendCameraView: vi.fn(),
  markerControls: {
    kind: 'door',
    color: 'blue',
    onKindChange: vi.fn(),
    onColorChange: vi.fn(),
  } as MarkerToolControls,
  selectedElementIsMarker: false,
  markerAudienceNotice: null as string | null,
  markerPanelOpen: false,
  markerPanelState: {
    kind: 'invalid-data',
    reason: 'no element is selected',
  } as MarkerPanelState,
  handleCloseMarkerPanel: vi.fn(),
  handleSaveMarkerDetail: vi.fn(),
  handleDeleteMarker: vi.fn(),
};

// A handful of tests below mutate marker-related fields on `mockHookState`
// directly (`markerControls`, `selectedElementIsMarker`,
// `markerAudienceNotice`, `markerPanelOpen`, `markerPanelState`, `viewport`).
// `vi.clearAllMocks()` in `beforeEach` only resets mock call history, not
// these plain field values — without an explicit reset, a value set by one
// test leaks into every later test in this file.
function defaultMarkerHookFields() {
  return {
    viewport: {} as Viewport,
    markerControls: {
      kind: 'door',
      color: 'blue',
      onKindChange: vi.fn(),
      onColorChange: vi.fn(),
    } as MarkerToolControls,
    selectedElementIsMarker: false,
    markerAudienceNotice: null as string | null,
    markerPanelOpen: false,
    markerPanelState: {
      kind: 'invalid-data',
      reason: 'no element is selected',
    } as MarkerPanelState,
  };
}

vi.mock('../DmBattleMapCanvas.hooks', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../DmBattleMapCanvas.hooks')>();
  return {
    ...actual,
    useDmBattleMapCanvas: vi.fn(() => mockHookState),
  };
});

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: () => null,
  };
});

vi.mock('@/components/ui/campaign/location-map/BattleMapMinimap', () => ({
  BattleMapMinimap: () => null,
}));

vi.mock('../DmVttToolbar', () => ({
  DmVttToolbar: vi.fn(() => null),
}));

import { DmVttToolbar } from '../DmVttToolbar';

const CAMPAIGN_CODE = 'TEST01';
const BATTLE_MAP_ID = 'bm-1';

const baseBattleMap: BattleMap = {
  id: BATTLE_MAP_ID,
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

function renderCanvas() {
  return render(
    <DmBattleMapCanvas
      campaignCode={CAMPAIGN_CODE}
      battleMapId={BATTLE_MAP_ID}
      dmId="dm-1"
      tokenConfigRef={{ current: null }}
      tokenInfoToggle={{ mode: 'compact', onCycle: vi.fn() }}
      onExportError={vi.fn()}
    />
  );
}

/** Pull the live `viewsControl` element the component passed to the
 * (mocked) toolbar on its most recent render. */
function getViewsControlProps(): BattleMapViewsControlProps {
  const lastCall = vi.mocked(DmVttToolbar).mock.calls.at(-1);
  const viewsControl = lastCall?.[0]?.viewsControl as
    | ReactElement<BattleMapViewsControlProps>
    | undefined;
  if (!viewsControl) throw new Error('viewsControl was not rendered');
  return viewsControl.props;
}

describe('DmBattleMapCanvas wiring', () => {
  beforeEach(() => {
    useBattleMapStore.setState({ battleMaps: {} });
    mockHookState.battleMap = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    Object.assign(mockHookState, defaultMarkerHookFields());
  });

  it('reaches the toolbar with a live viewsControl once a viewport exists', () => {
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [BATTLE_MAP_ID]: baseBattleMap } },
    });
    mockHookState.battleMap = baseBattleMap;

    renderCanvas();

    const lastProps = vi.mocked(DmVttToolbar).mock.calls.at(-1)?.[0];
    expect(lastProps?.viewsControl).toBeTruthy();

    // Default-OFF gate (the only enforcement point for camera sharing):
    // the mount site must pass sharingEnabled=false, or a focus send could
    // move another client's camera before the DM opts in for the session.
    // Mutation-verified: flipping the mount site's `useState(false)` to
    // `useState(true)` fails this assertion.
    const props = getViewsControlProps();
    expect(props.sharingEnabled).toBe(false);
  });

  it('forwards the marker controls, marker selection flag and audience notice into the toolbar', () => {
    mockHookState.markerControls = {
      kind: 'trap',
      color: 'red',
      onKindChange: vi.fn(),
      onColorChange: vi.fn(),
    };
    mockHookState.selectedElementIsMarker = true;
    mockHookState.markerAudienceNotice = 'pins disagree';

    renderCanvas();

    const lastProps = vi.mocked(DmVttToolbar).mock.calls.at(-1)?.[0];
    expect(lastProps?.markerControls).toBe(mockHookState.markerControls);
    expect(lastProps?.selectedElementIsMarker).toBe(true);
    expect(lastProps?.markerAudienceNotice).toBe('pins disagree');
  });

  it('mounts the marker detail panel only while a marker is active', () => {
    mockHookState.markerPanelOpen = false;
    const { unmount } = renderCanvas();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    mockHookState.markerPanelOpen = true;
    mockHookState.markerPanelState = {
      kind: 'ready',
      data: { v: 1, kind: 'trap', ref: 'ref-1' },
      detail: { id: 'ref-1', title: 'Pit', body: 'Deep.', dmNotes: 'DC 15' },
    };
    renderCanvas();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // mode="dm" reaches the panel: the DM edit form (and only it) carries the
    // dmNotes field.
    expect(
      screen.getByLabelText(/DM notes — never shown to players/)
    ).toHaveTextContent('DC 15');
  });

  it('does not reach the toolbar before a viewport exists (viewport gate)', () => {
    // Mimic pre-ready state: the render site only mounts DmVttToolbar once
    // `viewport` is truthy.
    const original = mockHookState.viewport;
    // @ts-expect-error -- exercising the null-viewport gate deliberately
    mockHookState.viewport = null;
    renderCanvas();
    expect(DmVttToolbar).not.toHaveBeenCalled();
    mockHookState.viewport = original;
  });

  it('onSaveView appends a NEW cameraViews array via updateBattleMap (store round-trip)', () => {
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [BATTLE_MAP_ID]: baseBattleMap } },
    });
    mockHookState.battleMap = baseBattleMap;
    const spy = vi.spyOn(useBattleMapStore.getState(), 'updateBattleMap');

    renderCanvas();
    const props = getViewsControlProps();
    const originalArray = baseBattleMap.cameraViews;
    const newView: CameraView = { x: 1, y: 2, w: 3, h: 4 };

    props.onSaveView(newView, 'Throne room');

    expect(spy).toHaveBeenCalledTimes(1);
    const [campaignArg, mapIdArg, updates] = spy.mock.calls[0];
    expect(campaignArg).toBe(CAMPAIGN_CODE);
    expect(mapIdArg).toBe(BATTLE_MAP_ID);
    expect(updates.cameraViews).not.toBe(originalArray);
    expect(updates.cameraViews).toHaveLength(2);
    expect(updates.cameraViews?.[1]).toMatchObject({
      name: 'Throne room',
      view: newView,
    });

    // Round-trip: the store actually holds the new value afterward.
    const stored = useBattleMapStore
      .getState()
      .getBattleMap(CAMPAIGN_CODE, BATTLE_MAP_ID);
    expect(stored?.cameraViews).toHaveLength(2);
  });

  it('onRenameView replaces the matching entry with a NEW array, leaving others untouched', () => {
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [BATTLE_MAP_ID]: baseBattleMap } },
    });
    mockHookState.battleMap = baseBattleMap;

    renderCanvas();
    const props = getViewsControlProps();
    const originalArray = baseBattleMap.cameraViews;

    props.onRenameView('v1', 'Renamed');

    const stored = useBattleMapStore
      .getState()
      .getBattleMap(CAMPAIGN_CODE, BATTLE_MAP_ID);
    expect(stored?.cameraViews).not.toBe(originalArray);
    expect(stored?.cameraViews?.[0]).toMatchObject({
      id: 'v1',
      name: 'Renamed',
    });
  });

  it('onDeleteView removes the matching entry via a NEW filtered array', () => {
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [BATTLE_MAP_ID]: baseBattleMap } },
    });
    mockHookState.battleMap = baseBattleMap;

    renderCanvas();
    const props = getViewsControlProps();
    const originalArray = baseBattleMap.cameraViews;

    props.onDeleteView('v1');

    const stored = useBattleMapStore
      .getState()
      .getBattleMap(CAMPAIGN_CODE, BATTLE_MAP_ID);
    expect(stored?.cameraViews).not.toBe(originalArray);
    expect(stored?.cameraViews).toHaveLength(0);
  });

  it('wires onGoToView/onSend straight through to the hook camera-view callbacks', () => {
    useBattleMapStore.setState({
      battleMaps: { [CAMPAIGN_CODE]: { [BATTLE_MAP_ID]: baseBattleMap } },
    });
    mockHookState.battleMap = baseBattleMap;

    renderCanvas();
    const props = getViewsControlProps();
    const view: CameraView = { x: 5, y: 6, w: 7, h: 8 };
    const audience: FocusAudience = 'players';

    props.onGoToView(view);
    expect(mockHookState.handleGoToCameraView).toHaveBeenCalledWith(view);

    props.onSend(view, audience);
    expect(mockHookState.handleSendCameraView).toHaveBeenCalledWith(
      view,
      audience
    );
  });
});
