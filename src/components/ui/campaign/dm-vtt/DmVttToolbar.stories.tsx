import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  FieldNotesCanvas,
  useActiveTool,
  useElements,
  useHistory,
  useToolOptions,
  useViewport,
} from '@fieldnotes/react';
import {
  HandTool,
  SelectTool,
  PencilTool,
  ArrowTool,
  ShapeTool,
  TextTool,
  NoteTool,
  EraserTool,
  LaserTool,
  PingTool,
  type Viewport,
} from '@fieldnotes/core';
import { FogTool, MeasureTool, PathTool, TemplateTool } from '@fieldnotes/vtt';
import { Button } from '@/components/ui/forms/button';
import { BattleMapExportControl } from '@/components/ui/campaign/location-map/BattleMapExportControl';
import { BattleMapViewsControl } from '@/components/ui/campaign/location-map/BattleMapViewsControl';
import type { MarkerKind } from '@/components/ui/campaign/location-map/markerData';
import { DmMarkerTool } from '@/components/ui/campaign/location-map/DmMarkerTool';
import { useDmFogControls } from '@/components/ui/campaign/location-map/fog';
import {
  createRollKeeperFogPlugin,
  getViewportFogManager,
} from '@/lib/fieldnotesVtt';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import type { SavedCameraView } from '@/types/battlemap';
import { DmVttToolbar } from './DmVttToolbar';
import { DmVttTopBar } from './DmVttTopBar';
import { DmBattleMapSetupToolbar } from './DmBattleMapSetupToolbar';

type DemoProps = {
  setup?: boolean;
  privateEditor?: boolean;
  enableFog?: boolean;
  initialTool?: string;
  selection?: boolean;
};
const noop = () => undefined;
function DemoControls(props: DemoProps) {
  const viewport = useViewport();
  const [activeTool] = useActiveTool();
  const elements = useElements();
  const history = useHistory();
  const [toolOptions] = useToolOptions(activeTool ?? '');
  const [hidden, setHidden] = useState(false);
  const [selectedHidden, setSelectedHidden] = useState(false);
  const [dash, setDash] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [grid, setGrid] = useState<'hex' | 'square' | 'off'>('square');
  const [views, setViews] = useState<SavedCameraView[]>([
    { id: 'gate', name: 'Gate', view: { x: 0, y: 0, w: 400, h: 300 } },
  ]);
  const [kind, setKind] = useState<MarkerKind>('trap');
  const fog = useDmFogControls({
    viewport,
    getBounds: () => ({ x: 0, y: 0, w: 1000, h: 800 }),
  });
  const viewControl = (
    <BattleMapViewsControl
      getViewport={() => viewport}
      views={views}
      canShare={!props.privateEditor}
      sharingEnabled={sharing}
      onSharingChange={setSharing}
      onSaveView={(view, name) =>
        setViews(current => [
          ...current,
          { id: crypto.randomUUID(), name, view },
        ])
      }
      onRenameView={(id, name) =>
        setViews(current =>
          current.map(view => (view.id === id ? { ...view, name } : view))
        )
      }
      onDeleteView={id =>
        setViews(current => current.filter(view => view.id !== id))
      }
      onGoToView={noop}
      onSend={noop}
    />
  );
  const exportControl = (
    <BattleMapExportControl
      getViewport={() => viewport}
      name="synthetic-map"
      getDmOnlyElements={() => ({})}
      onError={noop}
    />
  );
  const common = {
    onClearDrawings: noop,
    tokenInfoToggle: { mode: 'compact' as const, onCycle: noop },
    hiddenPlacementActive: hidden,
    onToggleHiddenPlacement: () => setHidden(value => !value),
    hiddenElementCount: 2,
    onRevealAll: noop,
    selectedElementId: props.selection ? 'shape' : null,
    selectedElementIsDmOnly: selectedHidden,
    onToggleSelectedDmOnly: () => setSelectedHidden(value => !value),
    markerControls: {
      kind,
      color: 'red' as const,
      onKindChange: (value: typeof kind) => setKind(value),
      onColorChange: noop,
    },
    movementControls: {
      dash: { enabled: dash, onChange: setDash },
      sharing: props.privateEditor
        ? undefined
        : { enabled: sharing, onChange: setSharing },
    },
    measureSharing: props.privateEditor
      ? undefined
      : { enabled: sharing, onChange: setSharing },
    fogControls: fog,
    viewsControl: viewControl,
    exportControl,
  };
  const header = (
    <DmVttTopBar
      campaignCode="SYNTHETIC"
      battleMapId="synthetic-map"
      dmId="synthetic-dm"
      mapName="The long battle map name beyond the northern mountains"
      gridMode={props.setup ? undefined : grid}
      onSetGridMode={setGrid}
      mode={props.setup ? 'setup' : 'play'}
      onModeChange={noop}
      showDisplay={!props.setup}
    />
  );
  return (
    <>
      {props.setup ? (
        <div className="fixed inset-x-0 top-0 z-20">
          {header}
          <DmBattleMapSetupToolbar
            onPickImage={noop}
            onPickMapImage={noop}
            onClear={noop}
            onFitToMap={noop}
            gridEnabled={grid !== 'off'}
            gridType={grid === 'hex' ? 'hex' : 'square'}
            gridCellSize={50}
            gridColor="#64748b"
            gridOpacity={0.5}
            onSetGridType={setGrid}
            onUpdateGridSettings={noop}
            onSyncToPlayers={noop}
            syncing={false}
            hasUnsyncedChanges={false}
            lastSyncedAt={null}
            selectedElementId={common.selectedElementId}
            isDmOnly={selectedHidden}
            onToggleDmOnly={common.onToggleSelectedDmOnly}
            hiddenPlacementActive={hidden}
            onToggleHiddenPlacement={common.onToggleHiddenPlacement}
            hiddenElementCount={2}
            onRevealAll={noop}
            mode="battlemap"
            syncStatus="disabled"
            onToggleArrangeMaps={noop}
            markerControls={common.markerControls}
            movementControls={common.movementControls}
            fogControls={fog}
            exportControl={exportControl}
            viewsControl={viewControl}
          />
        </div>
      ) : (
        <DmVttToolbar
          {...common}
          sessionControls={header}
          hiddenTools={props.privateEditor ? ['ping'] : undefined}
          editMapControl={
            props.privateEditor ? undefined : (
              <Button variant="ghost" size="sm" className="min-h-11 px-2">
                Edit map
              </Button>
            )
          }
        />
      )}
      <output data-testid="sdk-state" className="sr-only">
        {JSON.stringify({
          activeTool,
          elements: elements.length,
          elementData: elements.map(element =>
            Object.fromEntries(
              Object.entries(element).filter(([key]) => key !== 'version')
            )
          ),
          canRedo: history.canRedo,
          options: toolOptions,
          dash,
          sharing,
          hidden,
        })}
      </output>
    </>
  );
}
function Demo(props: DemoProps) {
  const viewportRef = useRef<Viewport | null>(null);
  const [plugin] = useState(() => createRollKeeperFogPlugin());
  const tools = useMemo(
    () => [
      new HandTool(),
      new SelectTool(),
      ...(!props.setup ? [new PencilTool()] : []),
      new ArrowTool(),
      new ShapeTool(),
      new TextTool(),
      new NoteTool(),
      new EraserTool(),
      new MeasureTool(),
      new PathTool(),
      new TemplateTool(),
      new LaserTool(),
      new PingTool(),
      new DmMarkerTool({ current: 'trap' }, { current: 'red' }, noop),
    ],
    [props.setup]
  );
  return (
    <div className="fixed inset-0">
      <FieldNotesCanvas
        tools={tools}
        defaultTool={props.initialTool ?? 'hand'}
        className="h-full w-full"
        options={{ plugins: [plugin] }}
        onReady={viewport => {
          viewportRef.current = viewport;
          const manager = getViewportFogManager(viewport);
          if (!props.enableFog)
            manager.initialize({
              bounds: { x: 0, y: 0, w: 1000, h: 800 },
              base: 'covered',
              cellSize: 32,
            });
          viewport.toolManager.register(new FogTool(manager));
          const id = viewport.addShape({
            position: { x: 400, y: 400 },
            size: { w: 100, h: 100 },
            strokeColor: '#334155',
          });
          if (props.selection)
            viewport.toolManager
              .getTool<SelectTool>('select')!
              .setSelection([id]);
        }}
      >
        <DemoControls {...props} />
      </FieldNotesCanvas>
    </div>
  );
}
const VIEWPORTS = Object.fromEntries(
  [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 800],
  ].map(([width, height]) => [
    `width${width}`,
    {
      name: `${width}px`,
      styles: { width: `${width}px`, height: `${height}px` },
      type: width < 600 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop',
    },
  ])
);
const meta: Meta<typeof Demo> = {
  title: 'Campaign/DM map toolbar',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: { options: VIEWPORTS },
  },
  globals: { viewport: { value: 'width1440', isRotated: false } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const sdk = () => JSON.parse(canvas.getByTestId('sdk-state').textContent!);
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Drawing' })).toBeVisible()
    );
    await expect(
      canvasElement.ownerDocument.documentElement.scrollWidth
    ).toBeLessThanOrEqual(window.innerWidth);
    await expect(canvas.getByRole('button', { name: 'Setup' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(canvas.getByText(/Private/)).toBeVisible();
    if (args.privateEditor)
      await expect(
        canvas.queryByRole('button', { name: 'Ping (look here)' })
      ).toBeNull();
    if (args.setup) {
      await expect(
        canvas.getByRole('button', { name: 'Add map' })
      ).toBeVisible();
      await expect(
        canvas.getByRole('button', { name: 'Arrange maps' })
      ).toBeVisible();
    }
    const compact = window.innerWidth < 1024;
    async function options(name: string) {
      if (compact)
        await userEvent.click(
          canvas.getByRole('button', { name: `${name} options` })
        );
      const panel = body.getByRole(compact ? 'dialog' : 'region', {
        name: `${name} options`,
      });
      await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
      return panel;
    }
    async function closeOptions() {
      if (!compact) return;
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(canvasElement.closest('[aria-hidden="true"]')).toBeNull()
      );
    }
    if (args.enableFog) {
      await userEvent.click(canvas.getByRole('button', { name: 'Fog of war' }));
      await waitFor(() =>
        expect(
          body.getByText('Enable fog of war', { exact: true })
        ).toBeVisible()
      );
      await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
      if (compact)
        await waitFor(() =>
          expect(
            canvas.getByRole('button', { name: 'Fog of war' })
          ).toHaveFocus()
        );
      await expect(sdk().activeTool).toBe('hand');
      return;
    }
    if (args.selection) {
      const selectionOptions = within(await options('Select'));
      const stroke = within(
        selectionOptions.getByRole('radiogroup', { name: 'Stroke color' })
      );
      await userEvent.click(stroke.getByRole('radio', { name: '#ef4444' }));
      await expect(
        stroke.getByRole('radio', { name: '#ef4444' })
      ).toHaveAttribute('aria-checked', 'true');
      await closeOptions();
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Drawing' }));
    if (args.setup)
      await expect(body.queryByRole('button', { name: 'Draw' })).toBeNull();
    await userEvent.click(body.getByRole('button', { name: 'Shape' }));
    await expect(sdk().activeTool).toBe('shape');
    await expect(
      canvas.getByRole('button', { name: 'Drawing: Shape' })
    ).toBeVisible();
    const shapeOptions = within(await options('Shape'));
    await userEvent.click(
      shapeOptions.getByRole('button', { name: 'ellipse' })
    );
    await expect(sdk().options.shape).toBe('ellipse');
    await closeOptions();
    await userEvent.click(canvas.getByRole('button', { name: 'Template' }));
    const templateOptions = within(await options('Template'));
    await userEvent.click(
      templateOptions.getByRole('button', { name: 'cone' })
    );
    await expect(sdk().options.templateShape).toBe('cone');
    await closeOptions();
    await userEvent.click(canvas.getByRole('button', { name: 'Move' }));
    const movementOptions = within(await options('Move'));
    await userEvent.click(
      movementOptions.getByRole('switch', { name: 'Dash' })
    );
    await expect(sdk().dash).toBe(true);
    await closeOptions();
    await userEvent.click(canvas.getByRole('button', { name: 'Fog of war' }));
    const fogOptions = within(await options('Fog'));
    await userEvent.click(fogOptions.getByRole('button', { name: 'conceal' }));
    await expect(sdk().options.operation).toBe('conceal');
    await closeOptions();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Place hidden elements' })
    );
    await expect(sdk().hidden).toBe(true);
    const before = sdk().elementData;
    const utilities = canvas.getByRole('button', {
      name: 'Map controls',
    });
    await userEvent.click(utilities);
    const utilityRow = within(
      canvas.getByRole('group', { name: 'Map controls' })
    );
    await userEvent.click(utilityRow.getByRole('button', { name: 'Undo' }));
    await expect(sdk().canRedo).toBe(true);
    if (!args.selection) await expect(sdk().elementData).not.toEqual(before);
    await userEvent.click(utilityRow.getByRole('button', { name: 'Redo' }));
    await waitFor(() => expect(sdk().elementData).toEqual(before));
    await userEvent.click(utilityRow.getByRole('button', { name: 'Views' }));
    const viewsPanel = body.getByTestId('battle-map-views-popover');
    await userEvent.click(
      within(viewsPanel).getByRole('button', { name: 'Rename view' })
    );
    await userEvent.clear(
      within(viewsPanel).getByRole('textbox', { name: 'Rename view' })
    );
    await userEvent.type(
      within(viewsPanel).getByRole('textbox', { name: 'Rename view' }),
      'North gate'
    );
    await userEvent.click(utilities);
    await expect(body.queryByTestId('battle-map-views-popover')).toBeNull();
    await userEvent.click(utilities);
    await expect(
      within(body.getByTestId('battle-map-views-popover')).getByRole(
        'textbox',
        { name: 'Rename view' }
      )
    ).toHaveValue('North gate');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      utilityRow.getByRole('button', { name: 'Export map' })
    );
    const exportPanel = body.getByRole('region', {
      name: 'Export map settings',
    });
    await expect(
      exportPanel.getBoundingClientRect().bottom
    ).toBeLessThanOrEqual(window.innerHeight);
    await expect(
      within(exportPanel).getByRole('radio', { name: 'Player view' })
    ).toBeVisible();
    await userEvent.click(utilities);
    await expect(
      body.queryByRole('region', { name: 'Export map settings' })
    ).toBeNull();
    await userEvent.click(utilities);
    await expect(
      body.getByRole('region', { name: 'Export map settings' })
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(utilities);
    await expect(sdk().hidden).toBe(true);
    await expect(sdk().activeTool).toBe('fog');
    const restore = emulateCoarsePointer();
    try {
      for (const control of [
        ...canvas.getAllByRole('button'),
        ...canvas.getAllByRole('link'),
      ]) {
        const rect = control.getBoundingClientRect();
        if (rect.width && rect.height)
          await expect(Math.round(rect.height)).toBeGreaterThanOrEqual(44);
      }
      await expect(
        canvasElement.ownerDocument.documentElement.scrollWidth
      ).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      restore();
    }
    await expect(
      parseFloat(
        document.documentElement.style.getPropertyValue('--dm-vtt-panel-top')
      )
    ).toBeGreaterThan(
      canvas.getByTestId('dm-vtt-command-dock').getBoundingClientRect().bottom
    );
    canvasElement.setAttribute('data-toolbar-demo-complete', 'true');
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const Landscape: Story = {
  globals: {
    theme: 'dark',
    viewport: { value: 'width1024', isRotated: false },
  },
};
export const Portrait: Story = {
  globals: { viewport: { value: 'width768', isRotated: false } },
};
export const Phone: Story = {
  globals: { theme: 'blue', viewport: { value: 'width390', isRotated: false } },
};
export const SmallPhone: Story = {
  globals: { theme: 'dark', viewport: { value: 'width320', isRotated: false } },
};
export const PrivateEditor: Story = {
  args: { privateEditor: true },
  globals: { theme: 'blue' },
};
export const Setup: Story = {
  args: { setup: true },
  globals: { theme: 'blue' },
};
export const SetupPhone: Story = {
  args: { setup: true },
  globals: { viewport: { value: 'width320', isRotated: false } },
};
export const SelectionPhone: Story = {
  args: { selection: true, initialTool: 'select' },
  globals: { theme: 'blue', viewport: { value: 'width320', isRotated: false } },
};
export const EnableFogPhone: Story = {
  args: { enableFog: true },
  globals: { theme: 'blue', viewport: { value: 'width390', isRotated: false } },
};
