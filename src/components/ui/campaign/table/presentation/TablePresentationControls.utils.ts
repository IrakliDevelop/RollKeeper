import {
  judgePresentationOutcome,
  presentationMayHaveCommitted,
  type PresentationIntent,
  type TableControlOutcome,
  type TableDescriptor,
} from '@/lib/table/authorityLifecycle';

import type {
  PresentationLabels,
  PresentationMessage,
} from './TablePresentationControls.types';

const REASON_WORDS: Record<string, string> = {
  'scene-deleted': 'this scene was deleted',
  'scene-unregistered': 'this scene is not registered for live play',
  'no-presented-scene': 'nothing is being shown',
  'presentation-changed': 'the audience changed in the meantime',
  'operation-id-reused': 'this request was already used for a different change',
};

/** A presentation refusal reason in words (never a raw code). */
export function presentationReasonWords(reason: string): string {
  return REASON_WORDS[reason] ?? 'the server refused the change';
}

export const LIVE_CONTROL_REQUIRED =
  'Live control is required to change what players see';

function labelOf(
  sceneId: string,
  routeSceneId: string,
  routeSceneName: string,
  labels: PresentationLabels
): string {
  if (sceneId === routeSceneId) return routeSceneName;
  return labels[sceneId]?.safeLabel ?? 'another scene';
}

/**
 * The status lines (P4): what the audience sees (server acknowledged) kept
 * apart from what this route privately prepares. Never derived from relay
 * or transport status.
 */
export function presentationStatusLines(input: {
  descriptor: TableDescriptor | null;
  sceneId: string;
  sceneName: string;
  labels: PresentationLabels;
}): { audience: string; preparation: string | null } {
  const presentation = input.descriptor?.presentation;
  if (!presentation)
    return { audience: 'Audience: unknown', preparation: null };
  const { sceneId, blanked } = presentation;
  if (sceneId === null)
    return {
      audience: 'Audience: nothing shown',
      preparation: `Preparing: ${input.sceneName} (private)`,
    };
  const noMapLink = input.labels[sceneId]?.sourceMapId === null;
  const audience = blanked
    ? 'Audience: blank (covered) · Published'
    : `Audience: ${labelOf(sceneId, input.sceneId, input.sceneName, input.labels)} · Published${
        noMapLink
          ? ' · no player map link for this scene (persistent display arrives later)'
          : ''
      }`;
  return {
    audience,
    preparation:
      sceneId === input.sceneId && !blanked
        ? 'Editing the shown scene — changes are live'
        : `Preparing: ${input.sceneName} (private)`,
  };
}

export type PresentationActionKind = 'show' | 'blank' | 'reveal' | 'unpresent';

/** Which explicit actions fit the current audience state. */
export function presentationActions(
  descriptor: TableDescriptor | null,
  sceneId: string
): PresentationActionKind[] {
  const presentation = descriptor?.presentation;
  if (!presentation) return ['show'];
  const actions: PresentationActionKind[] = [];
  const presentedHere = presentation.sceneId === sceneId;
  if (!presentedHere) actions.push('show');
  if (presentation.sceneId !== null && !presentation.blanked)
    actions.push('blank');
  if (presentation.sceneId !== null && presentation.blanked)
    actions.push('reveal');
  if (presentation.sceneId !== null) actions.push('unpresent');
  return actions;
}

export function revealLabel(
  descriptor: TableDescriptor | null,
  sceneId: string,
  sceneName: string,
  labels: PresentationLabels
): string {
  const presented = descriptor?.presentation.sceneId;
  return `Reveal ${presented ? labelOf(presented, sceneId, sceneName, labels) : 'scene'}`;
}

/** Q1 wording of a committed result judged against the current audience. */
export function committedMessage(
  intent: PresentationIntent,
  current: TableDescriptor,
  duplicate: boolean
): PresentationMessage {
  return judgePresentationOutcome(intent, current) === 'published'
    ? {
        tone: 'success',
        text: duplicate ? 'Published (confirmed)' : 'Published',
      }
    : {
        tone: 'info',
        text: 'This request completed earlier, but the audience has since changed',
      };
}

/** Message for any non-committed outcome; never claims success. */
export function failureMessage(
  outcome: Exclude<TableControlOutcome, { status: 'committed' }>
): PresentationMessage {
  switch (outcome.status) {
    case 'rejected':
      return {
        tone: 'error',
        text: `Not changed: ${presentationReasonWords(outcome.reason)} — controls refreshed`,
        retry: { label: 'Try again' },
      };
    case 'lost':
      return { tone: 'error', text: 'Not changed — live control was lost' };
    case 'unconfirmed':
      return { tone: 'info', text: 'Not confirmed — status refreshed' };
    case 'failed':
      // F1: a sent command may have committed (lost response, 503 after a
      // Lua commit): never "Not changed"; offer the identical Retry, whose
      // ledger duplicate is judged per Q1. Only a never-sent command (too
      // large, queue overflow) is reported as not changed.
      // Concern 2: a definite pre-EVAL 400 cannot have committed.
      if (outcome.httpStatus === 400)
        return { tone: 'error', text: 'Not changed — request rejected' };
      if (presentationMayHaveCommitted(outcome))
        return {
          tone: 'error',
          text: 'Not confirmed — Retry',
          retry: { label: 'Retry', command: outcome.command },
        };
      return {
        tone: 'error',
        text: 'Not changed — live control is unavailable',
      };
  }
}
