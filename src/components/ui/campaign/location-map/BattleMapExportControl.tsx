'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { FogStateV1 } from '@fieldnotes/core';
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
  onError,
  exporter = exportBattleMap,
}: BattleMapExportControlProps) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<'full' | 'player'>('full');
  const [bounds, setBounds] = useState<'map' | 'view'>('map');
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
        variant={open ? 'primary' : 'ghost'}
        onClick={() => setOpen(o => !o)}
        aria-label="Export map"
        aria-expanded={open}
        disabled={busy}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-2 py-1 text-xs"
      >
        <Download size={16} />
      </Button>

      {open && (
        <div className="bg-surface-raised border-divider absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border p-3 shadow-xl">
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
