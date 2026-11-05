import {
  generateKeyBetween,
  getDefaultElementRegistry,
  type CanvasElement,
  type Viewport,
} from '@fieldnotes/core';
import {
  createFogPlugin,
  createGrid,
  gridElementTypeDefinition,
  FogManager,
  FogManagerKey,
  GridController,
  movementRecordTypeDefinition,
  registerVttElementTypes,
  type CreateFogPluginOptions,
  type FogPlugin,
  type FogRendererOptions,
} from '@fieldnotes/vtt';

const registry = getDefaultElementRegistry();
export const fieldnotesElementRegistry = registry;

// The serializer migration and sync boundary both use the default registry.
// Install the VTT codecs before persisted grid/template state is parsed.
const hasGridAdapter = Boolean(registry.getAdapter('vtt:grid'));
const hasTemplateAdapter = Boolean(registry.getAdapter('vtt:template'));
if (!hasGridAdapter && !hasTemplateAdapter) {
  registerVttElementTypes(registry);
} else if (hasGridAdapter !== hasTemplateAdapter) {
  throw new Error('Field Notes VTT element registration is incomplete');
}

if (!registry.getAdapter('vtt:movement'))
  registry.register(movementRecordTypeDefinition);

/**
 * Default grid fields for a new grid (Edit map, location editor and
 * adoption). Mirrors the location editor's initial state.
 */
export const VTT_GRID_DEFAULTS = {
  cellSize: 50,
  strokeColor: '#94a3b8',
  strokeWidth: 1,
  opacity: 0.5,
} as const;

/**
 * The `vtt:grid` envelope that `GridController.add` followed by
 * `pinGridToMapLayer` leaves in a store: the same `createGrid` element,
 * wrapped by the registered grid definition, on the map layer and locked.
 * For code that builds canvas state without a viewport (Table adoption).
 * Returns the JSON form the canvas state stores.
 */
export function createPinnedVttGridElement(
  settings: {
    gridType: 'square' | 'hex';
    hexOrientation?: 'pointy' | 'flat';
    cellSize: number;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
  },
  mapLayerId: string
): CanvasElement {
  // JSON-clean, as the store persists it on the UI path (`exportJSON` /
  // JSON.stringify drop the wrapper's undefined `groupId`/`rotation`); an
  // undefined key is not a JSON value and fails scene validation.
  return JSON.parse(
    JSON.stringify(
      gridElementTypeDefinition.wrap(
        createGrid({
          ...settings,
          index: generateKeyBetween(null, null),
          layerId: mapLayerId,
          locked: true,
        })
      )
    )
  ) as CanvasElement;
}

const fogPlugins = new WeakMap<FogManager, FogPlugin>();
const gridControllers = new WeakMap<Viewport, GridController>();

export function createRollKeeperFogPlugin(
  options?: CreateFogPluginOptions
): FogPlugin {
  const plugin = createFogPlugin(options);
  fogPlugins.set(plugin.manager, plugin);
  return plugin;
}

export function getViewportFogManager(viewport: Viewport): FogManager {
  const serviceManager =
    typeof viewport.getService === 'function'
      ? viewport.getService(FogManagerKey)
      : undefined;
  const manager =
    serviceManager ?? (viewport as unknown as { fog?: FogManager }).fog;
  if (!manager) {
    throw new Error('The required Field Notes fog plugin is not installed');
  }
  return manager;
}

export function setViewportFogStyle(
  viewport: Viewport,
  options: FogRendererOptions
): void {
  const legacySetter = (
    viewport as unknown as {
      setFogStyle?: (next: FogRendererOptions) => void;
    }
  ).setFogStyle;
  if (typeof viewport.getService !== 'function' && legacySetter) {
    legacySetter(options);
    return;
  }
  const manager = getViewportFogManager(viewport);
  const plugin = fogPlugins.get(manager);
  if (!plugin) {
    throw new Error('The RollKeeper fog plugin instance is not registered');
  }
  plugin.setOptions(options);
}

/** Installs live grid constraints on real SDK viewports; structural test doubles are ignored. */
export function installVttGridController(viewport: Viewport): void {
  if (
    !viewport.elementRegistry ||
    !viewport.historyRecorder ||
    !viewport.constraintProxy
  ) {
    return;
  }
  getVttGridController(viewport);
}

export function getVttGridController(viewport: Viewport): GridController {
  const existing = gridControllers.get(viewport);
  if (existing) return existing;

  const controller = new GridController({
    store: viewport.store,
    recorder: viewport.historyRecorder,
    requestRender: () => viewport.requestRender(),
    getActiveLayerId: () => viewport.layerManager.activeLayerId,
    toolContext: viewport.toolContext,
    defaultGridSize: 24,
    elementRegistry: viewport.elementRegistry,
    constraintService: viewport.constraintProxy,
  });
  gridControllers.set(viewport, controller);

  // Grid state can arrive from persistence or sync as well as local controls.
  // Keep the constraint implementation aligned without rewriting pointer input.
  const sync = (): void => controller.syncContext();
  viewport.store.on('add', sync);
  viewport.store.on('remove', sync);
  viewport.store.on('update', sync);
  viewport.store.on('batch', sync);
  controller.syncContext();
  return controller;
}
