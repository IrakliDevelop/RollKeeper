'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import {
  useMapControlsVisible,
  useMapControlsDock,
  isMapControlsToggle,
} from './MapControlsVisibility';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { FogStateV1, FogStyle } from '@fieldnotes/vtt';
import {
  downloadBlob,
  exportBattleMap,
  type ExportCapableViewport,
} from './battleMapExport';

export interface BattleMapExportControlProps {
  getViewport: () => ExportCapableViewport | null;
  name: string;
  mapImageSize?: { w: number; h: number };
  /** Provided on DM surfaces; renders the audience radio. Read live at export time. */
  getDmOnlyElements?: () => Record<string, boolean>;
  /** Read live so exports include the latest local or relayed fog state. */
  getFogState?: () => FogStateV1 | null;
  /** Read live so exports use the applied style, never a live editor draft. */
  getFogStyle?: () => FogStyle;
  onError: (message: string) => void;
  /** Test seam; defaults to exportBattleMap. */
  exporter?: typeof exportBattleMap;
}

export function BattleMapExportControl({
  getViewport,
  name,
  mapImageSize,
  getDmOnlyElements,
  getFogState,
  getFogStyle,
  onError,
  exporter = exportBattleMap,
}: BattleMapExportControlProps) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<'full' | 'player'>('full');
  const [bounds, setBounds] = useState<'map' | 'view'>('map');
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = useMapControlsVisible();
  const dock = useMapControlsDock();
  const renderPanel = (panel: ReactNode) =>
    dock ? createPortal(panel, document.body) : panel;
  const [position, setPosition] = useState({ top: 0, left: 8 });
  useLayoutEffect(() => {
    if (!open || !visible || !dock) return;
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          top: Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 400)),
          left: Math.max(
            8,
            Math.min(rect.right - 224, window.innerWidth - 232)
          ),
        });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, visible, dock]);

  useEffect(() => {
    if (!open || !visible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (isMapControlsToggle(e.target)) return;
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, visible]);

  const handleExport = async () => {
    const vp = getViewport();
    if (!vp) {
      onError('Map is still loading');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { blob, filename } = await exporter(vp, {
        // A surface without DM-only controls is a player surface, never a
        // full/DM export. This also makes its filename truthful.
        audience: getDmOnlyElements ? audience : 'player',
        bounds,
        format,
        name,
        mapImageSize,
        dmOnlyElements: getDmOnlyElements?.(),
        fogState: getFogState?.() ?? null,
        fogStyle: getFogStyle?.(),
      });
      downloadBlob(blob, filename);
      setOpen(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const radioRow = (
    id: string,
    checked: boolean,
    onChange: () => void,
    label: string
  ) => (
    <label className="text-body flex min-h-[44px] items-center gap-2 text-xs">
      <input
        type="radio"
        name={id}
        checked={checked}
        onChange={onChange}
        disabled={busy}
      />
      {label}
    </label>
  );

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant={dock ? 'ghost' : open ? 'primary' : 'ghost'}
        selected={dock && open}
        onClick={() => setOpen(o => !o)}
        aria-label="Export map"
        aria-expanded={open}
        disabled={busy}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-2 py-1 text-xs"
      >
        <Download size={16} />
      </Button>

      {open &&
        visible &&
        renderPanel(
          <div
            ref={panelRef}
            role="region"
            aria-label="Export map settings"
            className={
              dock
                ? `${OVERLAY_SURFACE} fixed z-50 w-56 max-w-[calc(100vw-1rem)] overflow-y-auto p-3`
                : 'bg-surface-raised border-divider absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border p-3 shadow-xl'
            }
            style={
              dock
                ? {
                    ...position,
                    maxHeight: `calc(100dvh - ${position.top}px - 8px)`,
                  }
                : undefined
            }
          >
            <div className="flex flex-col gap-2">
              {getDmOnlyElements && (
                <div role="radiogroup" aria-label="Audience">
                  <div className="text-muted mb-1 text-[11px] font-semibold uppercase">
                    Audience
                  </div>
                  {radioRow(
                    'export-audience',
                    audience === 'full',
                    () => setAudience('full'),
                    'Full map'
                  )}
                  {radioRow(
                    'export-audience',
                    audience === 'player',
                    () => setAudience('player'),
                    'Player view'
                  )}
                </div>
              )}

              <div role="radiogroup" aria-label="Bounds">
                <div className="text-muted mb-1 text-[11px] font-semibold uppercase">
                  Bounds
                </div>
                {radioRow(
                  'export-bounds',
                  bounds === 'map',
                  () => setBounds('map'),
                  'Whole map'
                )}
                {radioRow(
                  'export-bounds',
                  bounds === 'view',
                  () => setBounds('view'),
                  'Current view'
                )}
              </div>

              <div role="radiogroup" aria-label="Format">
                <div className="text-muted mb-1 text-[11px] font-semibold uppercase">
                  Format
                </div>
                {radioRow(
                  'export-format',
                  format === 'png',
                  () => setFormat('png'),
                  'PNG'
                )}
                {radioRow(
                  'export-format',
                  format === 'jpeg',
                  () => setFormat('jpeg'),
                  'JPEG'
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleExport}
                disabled={busy}
                aria-label="Export"
                className="mt-1 flex min-h-[44px] w-full items-center justify-center gap-2"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Export
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
