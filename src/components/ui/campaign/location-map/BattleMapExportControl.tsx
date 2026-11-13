'use client';

import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Download } from 'lucide-react';
import type { FogStateV1, FogStyle } from '@fieldnotes/vtt';
import { Button } from '@/components/ui/forms/button';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import {
  downloadBlob,
  exportBattleMap,
  type ExportCapableViewport,
} from './battleMapExport';
import { DisableableTooltip } from './ToolOptionControls';
import { useRestoreLostFocus } from './useRestoreLostFocus';

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

  // Non-modal popover: the Export button disables while busy, and a browser
  // that blurs a disabled button leaves focus on <body>, where the next Tab
  // would dismiss the popover. A failed export keeps the popover open, so
  // focus goes back to the button; a successful one closes it and Radix
  // returns focus to the trigger (the ref is null by then).
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  useRestoreLostFocus(busy, exportButtonRef);

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

  return (
    <TooltipProvider>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <DisableableTooltip content="Export map" disabled={busy}>
          <Popover.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              selected={open}
              className="w-9 shrink-0 px-0"
              aria-label="Export map"
              disabled={busy}
            >
              <Download size={16} />
            </Button>
          </Popover.Trigger>
        </DisableableTooltip>

        <Popover.Portal>
          <Popover.Content
            aria-label="Export map"
            align="end"
            sideOffset={8}
            collisionPadding={8}
            className={`${OVERLAY_SURFACE} z-[60] w-56 max-w-[calc(100vw-1rem)] p-3`}
          >
            <div className="flex flex-col gap-3">
              {getDmOnlyElements && (
                <RadioGroupField
                  label="Audience"
                  value={audience}
                  onValueChange={value =>
                    setAudience(value as 'full' | 'player')
                  }
                >
                  <RadioGroupItem
                    value="full"
                    label="Full map"
                    disabled={busy}
                  />
                  <RadioGroupItem
                    value="player"
                    label="Player view"
                    disabled={busy}
                  />
                </RadioGroupField>
              )}

              <RadioGroupField
                label="Bounds"
                value={bounds}
                onValueChange={value => setBounds(value as 'map' | 'view')}
              >
                <RadioGroupItem value="map" label="Whole map" disabled={busy} />
                <RadioGroupItem
                  value="view"
                  label="Current view"
                  disabled={busy}
                />
              </RadioGroupField>

              <RadioGroupField
                label="Format"
                value={format}
                onValueChange={value => setFormat(value as 'png' | 'jpeg')}
              >
                <RadioGroupItem value="png" label="PNG" disabled={busy} />
                <RadioGroupItem value="jpeg" label="JPEG" disabled={busy} />
              </RadioGroupField>

              <Button
                ref={exportButtonRef}
                type="button"
                variant="primary"
                size="sm"
                fullWidth
                className="mt-1"
                onClick={handleExport}
                loading={busy}
                leftIcon={<Download size={16} />}
              >
                Export
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </TooltipProvider>
  );
}
