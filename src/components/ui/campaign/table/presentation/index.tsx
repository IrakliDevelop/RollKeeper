'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/forms/button';

import { OpenDisplayButton } from '../display/OpenDisplayButton';
import { useTablePresentation } from './TablePresentationControls.hooks';
import type { TablePresentationControlsProps } from './TablePresentationControls.types';
import {
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
 * Explicit audience presentation for the Table page (PR04 P4): what players
 * see (server-acknowledged) apart from what this route privately prepares,
 * and holder-only Show / Blank / Reveal / Stop showing. Published is shown
 * only after a server commit; the table display line (PR05 E13) is the
 * server-computed device report, and "Open display" is offered to any DM.
 */
export function TablePresentationControls(
  props: TablePresentationControlsProps
) {
  const presentation = useTablePresentation(props);
  const { descriptor, labels, pending, message, holder } = presentation;
  const lines = presentationStatusLines({
    descriptor,
    sceneId: props.sceneId,
    sceneName: props.sceneName,
    labels,
  });
  const actions = presentationActions(descriptor, props.sceneId);
  const disabled = !holder || pending;
  // PR05 E13: the display line comes only from the server-computed display
  // status, re-read at once after each committed presentation command.
  const display = useTableDisplayStatus(props.campaignCode, props.dmId);
  const { refresh } = display;
  const { committedCount } = presentation;
  useEffect(() => {
    if (committedCount > 0) refresh();
  }, [committedCount, refresh]);
  const displayLine = display.status
    ? displayStatusLine({
        status: display.status,
        sceneId: props.sceneId,
        sceneName: props.sceneName,
        labels,
      })
    : null;
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
        </div>
        {lines.preparation && (
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
            disabled={disabled}
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
            {revealLabel(descriptor, props.sceneId, props.sceneName, labels)}
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
