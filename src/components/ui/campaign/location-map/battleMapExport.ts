import type { ExportImageOptions } from '@fieldnotes/core';

export interface BattleMapExportRequest {
  audience: 'full' | 'player';
  bounds: 'map' | 'view';
  format: 'png' | 'jpeg';
  /** Map/location display name; becomes the sanitized filename base. */
  name: string;
  mapImageSize?: { w: number; h: number };
  /** DM surfaces only; player surface omits it (store already relay-filtered). */
  dmOnlyElements?: Record<string, boolean>;
}

export interface BattleMapExportResult {
  blob: Blob;
  filename: string;
}

export interface ExportCapableViewport {
  exportImage(options: ExportImageOptions): Promise<Blob | null>;
  getVisibleRect(): { x: number; y: number; w: number; h: number };
}

const JPEG_QUALITY = 0.85;

function sanitizeName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'battle-map';
}

/**
 * One export path for every surface. The player-view audience filter is a
 * courtesy preview for the DM — the real privacy boundary stays relay-side
 * canRead (player stores never receive DM-only bytes).
 */
export async function exportBattleMap(
  vp: ExportCapableViewport,
  req: BattleMapExportRequest
): Promise<BattleMapExportResult> {
  const region =
    req.bounds === 'view'
      ? vp.getVisibleRect()
      : req.mapImageSize && req.mapImageSize.w > 0 && req.mapImageSize.h > 0
        ? { x: 0, y: 0, w: req.mapImageSize.w, h: req.mapImageSize.h }
        : undefined;
  const dmOnly = req.audience === 'player' ? (req.dmOnlyElements ?? {}) : null;

  const options: ExportImageOptions = {
    scale: 2,
    scaleMode: 'fit',
    padding: 0,
    format: req.format,
  };
  if (req.format === 'jpeg') options.quality = JPEG_QUALITY;
  if (region) options.region = region;
  if (dmOnly) options.filter = el => !dmOnly[el.id];

  const blob = await vp.exportImage(options);
  if (!blob) throw new Error('Export produced no image');

  // Spec contract: <name>-<full|player-view|view>.<ext>. Precedence: the
  // player audience labels the file 'player-view' regardless of bounds;
  // otherwise current-view bounds label it 'view'; otherwise 'full'.
  const variant =
    req.audience === 'player'
      ? 'player-view'
      : req.bounds === 'view'
        ? 'view'
        : 'full';
  const ext = req.format === 'jpeg' ? 'jpg' : 'png';
  return { blob, filename: `${sanitizeName(req.name)}-${variant}.${ext}` };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
