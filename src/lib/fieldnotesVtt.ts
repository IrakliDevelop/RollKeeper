import { getDefaultElementRegistry, type Viewport } from '@fieldnotes/core';
import {
  createFogPlugin,
  FogManager,
  FogManagerKey,
  GridController,
  registerVttElementTypes,
  type CreateFogPluginOptions,
  type FogPlugin,
  type FogRendererOptions,
} from '@fieldnotes/vtt';

const registry = getDefaultElementRegistry();
export const fieldnotesElementRegistry = registry;

// The v3 serializer and sync boundary both use the default registry. Install
// the VTT codecs before any persisted grid/template state can be parsed.
const hasGridAdapter = Boolean(registry.getAdapter('vtt:grid'));
const hasTemplateAdapter = Boolean(registry.getAdapter('vtt:template'));
if (!hasGridAdapter && !hasTemplateAdapter) {
  registerVttElementTypes(registry);
} else if (hasGridAdapter !== hasTemplateAdapter) {
  throw new Error('Field Notes VTT element registration is incomplete');
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
    defaultGridSize: viewport.toolContext.gridSize ?? 24,
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
