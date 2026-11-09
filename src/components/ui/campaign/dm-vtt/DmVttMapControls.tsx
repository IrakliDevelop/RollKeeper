'use client';

import { useId, useState } from 'react';
import {
  Eye,
  EyeOff,
  Minus,
  Scissors,
  Settings2,
  Undo2,
  Redo2,
  ChevronDown,
} from 'lucide-react';
import { useHistory } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { MapControlsVisibility } from '@/components/ui/campaign/location-map/MapControlsVisibility';
import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';
import type { DmVttToolbarProps } from './DmVttToolbar';

const TOKEN_INFO_ICON = { full: Eye, compact: Minus, off: EyeOff };
const TOKEN_INFO_LABEL: Record<TokenInfoMode, string> = {
  full: 'Token info: full',
  compact: 'Token info: compact',
  off: 'Token info: hidden',
};

export function DmVttMapControls(props: DmVttToolbarProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { canUndo, canRedo, undo, redo } = useHistory();
  const mode = props.tokenInfoToggle?.mode ?? 'compact';
  const TokenInfoIcon = TOKEN_INFO_ICON[mode];
  return (
    <>
      <div
        className="border-divider flex min-w-0 flex-wrap items-center gap-1 border-t px-2 py-1 lg:border-t-0 lg:border-l"
        role="group"
        aria-label="Map actions"
      >
        {props.buildActions}
        {props.editMapControl}
        <Button
          variant="ghost"
          size="sm"
          selected={props.hiddenPlacementActive}
          onClick={props.onToggleHiddenPlacement}
          aria-label="Place hidden elements"
          aria-pressed={props.hiddenPlacementActive}
          className="min-h-11 px-2"
          title={
            props.hiddenPlacementActive
              ? 'New elements are hidden from players'
              : 'New elements are visible to players'
          }
        >
          <EyeOff size={16} aria-hidden />
          {props.hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
        </Button>
        <Button
          data-map-controls-toggle
          variant="ghost"
          size="sm"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-controls={id}
          className="min-h-11 px-2"
        >
          <Settings2 size={16} aria-hidden />
          Map controls
          <ChevronDown size={14} aria-hidden />
        </Button>
      </div>
      <MapControlsVisibility.Provider value={open}>
        <div id={id} hidden={!open} className="border-divider w-full border-t">
          <div
            className="flex min-w-0 flex-wrap items-center gap-2 p-2"
            role="group"
            aria-label="Map controls"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
              className="min-h-11 min-w-11 px-2"
            >
              <Undo2 size={16} aria-hidden />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
              className="min-h-11 min-w-11 px-2"
            >
              <Redo2 size={16} aria-hidden />
              Redo
            </Button>
            {props.tokenInfoToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={props.tokenInfoToggle.onCycle}
                aria-label={TOKEN_INFO_LABEL[mode]}
                className="min-h-11 px-2"
              >
                <TokenInfoIcon size={16} aria-hidden />
                {TOKEN_INFO_LABEL[mode]}
              </Button>
            )}
            {props.utilityExtras}
            {props.viewsControl}
            {props.presenceControl}
            {props.exportControl}
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onRevealAll}
              disabled={props.hiddenElementCount === 0}
              aria-label={`Reveal all hidden elements (${props.hiddenElementCount})`}
              className="min-h-11 px-2"
            >
              {' '}
              <Eye size={16} aria-hidden />
              Reveal all ({props.hiddenElementCount})
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={props.onClearDrawings}
              className="min-h-11 px-2"
            >
              <Scissors size={16} aria-hidden />
              {props.clearLabel ?? 'Clear drawings'}
            </Button>
          </div>
        </div>
      </MapControlsVisibility.Provider>
    </>
  );
}
