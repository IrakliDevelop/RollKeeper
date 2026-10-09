'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/forms/button';

import { OpenDisplayButton } from '../display/OpenDisplayButton';
import { useTablePresentation } from './TablePresentationControls.hooks';
import type { TablePresentationControlsProps } from './TablePresentationControls.types';
import {
  displayCalibrationLine,
  displayStatusLine,
  LIVE_CONTROL_REQUIRED,
  presentationActions,
  presentationStatusLines,
  revealLabel,
} from './TablePresentationControls.utils';
import { useTableDisplayStatus } from './useTableDisplayStatus';

const MESSAGE_TONE = {
  success: 'text-accent-emerald-text',
  info: 'text-accent-amber-text',
  error: 'text-accent-red-text',
} as const;
const DISPLAY_TONE = {
  success: 'text-accent-emerald-text',
  muted: 'text-muted',
  warning: 'text-accent-amber-text',
} as const;

/**
 * The presentation state of one page (PR04 P4 + PR05 E13): the control
 * descriptor (holder session or the non-holder 10 s poll) and the 5 s
 * display-status poll. PR06 W4: the workspace calls this ONCE so scene
 * switches and canvas remounts never add a poll; the view may remount.
 */
export function useTablePresentationPanel(
  props: TablePresentationControlsProps
) {
  const presentation = useTablePresentation(props);
  // PR05 E13: the display line comes only from the server-computed display
  // status, re-read at once after each committed presentation command.
  const display = useTableDisplayStatus(
    props.campaignCode,
    props.dmId,
    props.inactive !== true
  );
  const { refresh } = display;
  const { committedCount } = presentation;
  useEffect(() => {
    if (committedCount > 0) refresh();
  }, [committedCount, refresh]);
  // O7-A5: whether the table reported `verified` during this page session.
  const [verifiedSeen, setVerifiedSeen] = useState(false);
  const reported =
    display.status && display.status !== 'error'
      ? display.status.calibration
      : undefined;
  useEffect(() => {
    if (reported === 'verified') setVerifiedSeen(true);
  }, [reported]);
  return { presentation, display, verifiedSeen };
}

export type TablePresentationPanel = ReturnType<
  typeof useTablePresentationPanel
>;

/**
 * Explicit audience presentation for the Table page (PR04 P4): what players
 * see (server-acknowledged) apart from what this route privately prepares,
 * and holder-only Show / Blank / Reveal / Stop showing. Published is shown
 * only after a server commit; the table display line (PR05 E13) is the
 * server-computed device report, and "Open display" is offered to any DM.
 */
export function TablePresentationControls(
  props: TablePresentationControlsProps
) {
  const panel = useTablePresentationPanel(props);
  return <TablePresentationView {...props} panel={panel} />;
}

/** Presentational half: holds no subscription of its own. */
export function TablePresentationView(
  props: TablePresentationControlsProps & { panel: TablePresentationPanel }
) {
  const { presentation, display } = props.panel;
  const { refresh } = display;
  const { descriptor, labels, pending, message, holder } = presentation;
  const sceneId = props.sceneId ?? '';
  const lines = presentationStatusLines({
    descriptor,
    sceneId,
    sceneName: props.sceneName,
    labels,
  });
  const actions = presentationActions(descriptor, sceneId).filter(
    action => action !== 'show' || props.sceneId !== null
  );
  const disabled = !holder || pending;
  // R3-F6: "Show this scene" waits for the selected scene's registration.
  const showBlocked = props.canShow === false;
  const displayLine = display.status
    ? displayStatusLine({
        status: display.status,
        sceneId,
        sceneName: props.sceneName,
        labels,
      })
    : null;
  const calibrationLine = displayCalibrationLine(
    display.status,
    props.panel.verifiedSeen
  );
  return (
    <section
      aria-label="Audience presentation"
      className="border-divider flex w-full min-w-0 flex-col gap-2 border-t pt-2"
    >
      <div
        role="status"
        aria-label="Audience status"
        aria-live="polite"
        className="min-w-0 text-xs"
      >
        {/* The display line shares the audience row when it fits (390 px). */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <p className="text-heading min-w-0 font-medium break-words">
            {lines.audience}
          </p>
          {displayLine && (
            <p
              className={`${DISPLAY_TONE[displayLine.tone]} min-w-0 break-words`}
            >
              {displayLine.text}
            </p>
          )}
          {calibrationLine && (
            <p className="text-muted min-w-0 break-words">
              {calibrationLine.text}
            </p>
          )}
        </div>
        {lines.preparation && props.sceneId !== null && (
          <p className="text-muted break-words">{lines.preparation}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <OpenDisplayButton
          code={props.campaignCode}
          dmId={props.dmId}
          onLaunched={refresh}
        />
        {actions.includes('show') && (
          <Button
            variant="primary"
            size="sm"
            disabled={disabled || showBlocked}
            title={
              showBlocked && holder
                ? 'This scene is not registered for live play yet'
                : undefined
            }
            onClick={presentation.show}
          >
            Show this scene
          </Button>
        )}
        {actions.includes('reveal') && (
          <Button
            variant="primary"
            size="sm"
            disabled={disabled}
            onClick={presentation.reveal}
          >
            {revealLabel(descriptor, sceneId, props.sceneName, labels)}
          </Button>
        )}
        {actions.includes('blank') && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={presentation.blank}
          >
            Blank audience
          </Button>
        )}
        {actions.includes('unpresent') && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={presentation.unpresent}
          >
            Stop showing
          </Button>
        )}
      </div>
      <div aria-live="polite" className="min-w-0 text-xs">
        {!holder && <p className="text-muted">{LIVE_CONTROL_REQUIRED}</p>}
        {pending && <p className="text-muted">Saving…</p>}
        {!pending && message && (
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${MESSAGE_TONE[message.tone]} break-words`}>
              {message.text}
            </p>
            {message.retry && holder && (
              <Button variant="link" size="sm" onClick={presentation.retry}>
                {message.retry.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
