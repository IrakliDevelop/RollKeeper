'use client';

import { Map as MapIcon, Move, Maximize, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import DmLocationGridPopover from '@/components/ui/campaign/location-map/DmLocationGridPopover';
import type { DmLocationToolbarProps } from '@/components/ui/campaign/location-map/DmLocationToolbar.types';
import { useDisplayLauncher } from '@/components/ui/campaign/table/display/useDisplayLauncher';
import { DmVttToolbar } from './DmVttToolbar';

/** The original map's Setup tools; uploads remain actions, and no pencil
 * tool is added to the editor's registered capabilities. */
export function DmBattleMapSetupToolbar(props: DmLocationToolbarProps) {
  const display = useDisplayLauncher();
  return (
    <DmVttToolbar
      position="flow"
      hiddenTools={['pencil']}
      onPickImage={props.onPickImage}
      onClearDrawings={props.onClear}
      clearLabel="Clear canvas"
      hiddenPlacementActive={props.hiddenPlacementActive}
      onToggleHiddenPlacement={props.onToggleHiddenPlacement}
      hiddenElementCount={props.hiddenElementCount}
      onRevealAll={props.onRevealAll}
      selectedElementId={props.selectedElementId}
      selectedElementIsDmOnly={props.isDmOnly}
      onToggleSelectedDmOnly={props.onToggleDmOnly}
      selectedElementIsMarker={props.selectedElementIsMarker}
      markerAudienceNotice={props.markerAudienceNotice}
      markerControls={props.markerControls}
      movementControls={props.movementControls}
      measureSharing={props.measureSharing}
      fogControls={props.fogControls}
      fogPresetControls={props.fogPresetControls}
      exportControl={props.exportControl}
      viewsControl={props.viewsControl}
      presenceControl={props.presenceControl}
      buildActions={
        <>
          {props.onPickMapImage && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-2"
              onClick={props.onPickMapImage}
              disabled={props.arrangeMapsActive}
            >
              <MapIcon size={16} aria-hidden />
              Add map
            </Button>
          )}
          {props.onToggleArrangeMaps && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-2"
              selected={props.arrangeMapsActive}
              aria-pressed={props.arrangeMapsActive}
              onClick={props.onToggleArrangeMaps}
            >
              <Move size={16} aria-hidden />
              {props.arrangeMapsActive ? 'Done arranging' : 'Arrange maps'}
            </Button>
          )}
          <DmLocationGridPopover
            presentation="dock"
            gridEnabled={props.gridEnabled}
            gridType={props.gridType}
            gridCellSize={props.gridCellSize}
            gridColor={props.gridColor}
            gridOpacity={props.gridOpacity}
            onSetGridType={props.onSetGridType}
            onUpdateGridSettings={props.onUpdateGridSettings}
          />
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 px-2"
            onClick={props.onFitToMap}
          >
            <Maximize size={16} aria-hidden />
            Fit map to screen
          </Button>
        </>
      }
      utilityExtras={
        <>
          {props.onOpenTvDisplay && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-2"
              onClick={() => display.launch(props.onOpenTvDisplay!)}
            >
              <Monitor size={16} aria-hidden />
              Open TV Display
            </Button>
          )}
          {display.message && (
            <p role="status" className="type-small text-ember-text w-full">
              {display.message}
            </p>
          )}
          <span data-testid="live-sync-chip" className="type-small text-muted">
            {props.syncStatus === 'live'
              ? 'Live'
              : props.syncStatus === 'connecting'
                ? 'Connecting…'
                : props.syncStatus === 'offline'
                  ? 'Offline'
                  : props.syncStatus === 'denied'
                    ? 'Denied'
                    : 'Sync off'}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-describedby="share-with-players-table-v1"
              className="min-h-11 px-2"
            >
              Share with players
            </Button>
            <p
              id="share-with-players-table-v1"
              className="type-small text-muted"
            >
              Players now see maps through Table scenes.
            </p>
          </div>
        </>
      }
    />
  );
}
