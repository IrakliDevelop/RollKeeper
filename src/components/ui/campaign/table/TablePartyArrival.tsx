'use client';

import { useEffect, useReducer, useRef } from 'react';
import type { Viewport } from '@fieldnotes/core';
import { Crosshair, MapPin, Users } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { TableRepository } from '@/lib/table/repository';
import type { TableCampaignPlayer } from '@/lib/table/roster';

import { TableRosterNoticeLine } from './TableRosterNoticeLine';
import { useTablePartyArrival } from './useTablePartyArrival';
import type { TableRosterCanvas } from './useTableRosterState';

/** W11 roster actions: "Set arrival point" and "Bring party here". */
export function TablePartyArrival(props: {
  repository: TableRepository;
  sceneId: string;
  campaignCode: string;
  dmId: string;
  canvas: TableRosterCanvas | null;
  live: boolean;
  players: readonly TableCampaignPlayer[] | undefined;
  reloadPlayers?: () => Promise<readonly TableCampaignPlayer[] | null>;
  arming: boolean;
  onArm: () => void;
}) {
  const arrival = useTablePartyArrival(props);
  return (
    <div
      className="flex w-full flex-col gap-1"
      aria-label="Party arrival"
      role="group"
    >
      <div className="flex flex-wrap gap-1">
        <Button
          variant={props.arming ? 'primary' : 'outline'}
          size="sm"
          aria-pressed={props.arming}
          onClick={props.onArm}
        >
          <Crosshair size={14} aria-hidden="true" />
          {arrival.arrivalPoint ? 'Move arrival point' : 'Set arrival point'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!arrival.canBring}
          title={arrival.disabledReason ?? undefined}
          onClick={() => void arrival.bringParty()}
        >
          <Users size={14} aria-hidden="true" />
          Bring party here
        </Button>
      </div>
      {arrival.disabledReason && arrival.arrivalPoint && (
        <p className="text-muted text-xs">{arrival.disabledReason}</p>
      )}
      <TableRosterNoticeLine notice={arrival.notice} />
    </div>
  );
}

/**
 * One-shot arrival picker over the canvas: the next click sets the scene's
 * arrival point (a local scene command); Escape or the button cancels.
 */
export function TableArrivalPicker(props: {
  viewport: Pick<Viewport, 'camera' | 'domLayer'>;
  onPick: (point: { x: number; y: number }) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="application"
      aria-label="Click the map to set the arrival point. Escape cancels."
      className="pointer-events-auto fixed inset-0 z-30 cursor-crosshair outline-none"
      onKeyDown={event => {
        if (event.key === 'Escape') props.onCancel();
      }}
      onClick={event => {
        const rect = props.viewport.domLayer.getBoundingClientRect();
        props.onPick(
          props.viewport.camera.screenToWorld({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        );
      }}
    >
      <p className="bg-surface-raised text-heading border-divider absolute bottom-24 left-1/2 -translate-x-1/2 rounded-lg border px-3 py-2 text-sm shadow-lg">
        Click the map to set the party arrival point (Escape cancels)
      </p>
    </div>
  );
}

/** DM-only overlay marker (never a canvas element, never synced). */
export function TableArrivalMarker(props: {
  viewport: Pick<Viewport, 'camera'>;
  point: { x: number; y: number } | null;
}) {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const { camera } = props.viewport;
  useEffect(() => camera.onChange(() => rerender()), [camera]);
  if (!props.point) return null;
  const screen = camera.worldToScreen(props.point);
  // FU-10: a labelled pin whose tip sits on the point. DM-only DOM overlay,
  // never a canvas element (players never receive it).
  return (
    <div
      role="img"
      aria-label="Party arrival point"
      title="Party arrival point"
      className="pointer-events-none fixed z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ left: screen.x, top: screen.y }}
    >
      <span className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text rounded border px-1 text-[10px] leading-4 font-semibold whitespace-nowrap shadow-sm">
        Arrival
      </span>
      <MapPin
        size={24}
        strokeWidth={2.5}
        aria-hidden="true"
        className="text-accent-emerald-text fill-accent-emerald-bg drop-shadow"
      />
    </div>
  );
}
