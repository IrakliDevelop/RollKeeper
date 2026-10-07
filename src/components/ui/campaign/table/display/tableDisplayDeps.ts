import {
  applyCameraView,
  captureCameraView,
  type Viewport,
} from '@fieldnotes/core';

import { createManagedBattleMapConnection } from '@/lib/battlemapSync';
import {
  createRollKeeperFogPlugin,
  installVttGridController,
} from '@/lib/fieldnotesVtt';
import { configureFogView } from '@/components/ui/campaign/location-map/fog';
import {
  applyFogAppearanceMetadata,
  startFogAppearancePoll,
} from '@/components/ui/campaign/location-map/fog/fogAppearancePoll';
import { ensureCanonicalLayers } from '@/components/ui/campaign/location-map/layerContract';
import { makeApplyRemoteLayer } from '@/components/ui/campaign/location-map/layerSync';

import type { TableDisplayDeps } from './tableDisplayController';

/** The real platform pieces behind the campaign display controller. */
export function defaultTableDisplayDeps(): TableDisplayDeps {
  return {
    createConnection: createManagedBattleMapConnection,
    prepareViewport: (viewport, fog) => {
      installVttGridController(viewport);
      configureFogView(fog, 'display', false);
      // Canonical bands; custom/player layers arrive over layer sync. The
      // display is read-only, so the lock stance is irrelevant here.
      ensureCanonicalLayers(viewport, 'player');
    },
    startFogAppearance: (viewport, url, init, initial) => {
      if (initial)
        applyFogAppearanceMetadata(
          viewport,
          initial.fogAppearance,
          initial.updatedAt
        );
      return startFogAppearancePoll({ viewport, url, init });
    },
    captureView: viewport => captureCameraView(viewport),
    applyView: (viewport, view) => {
      const size = viewport.getCanvasSize();
      applyCameraView(viewport.camera, view, size.w, size.h);
      viewport.requestRender();
    },
    fitView: viewport => viewport.fitToContent(60),
    createFogPlugin: () => createRollKeeperFogPlugin(),
    applyLayer: (viewport: Viewport) =>
      makeApplyRemoteLayer(viewport, 'display', {
        onApplied: () => viewport.requestRender(),
      }),
  };
}
