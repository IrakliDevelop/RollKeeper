import {
  judgePresentationOutcome,
  presentationMayHaveCommitted,
  type PresentationIntent,
  type TableControlOutcome,
  type TableDescriptor,
} from '@/lib/table/authorityLifecycle';

import type {
  DisplayStatusRead,
  PresentationLabels,
  PresentationMessage,
} from './TablePresentationControls.types';

const REASON_WORDS: Record<string, string> = {
  'scene-deleted': 'this scene was deleted',
  'scene-unregistered': "this scene isn't ready for live play yet",
  'no-presented-scene': 'nothing is being shown',
  'presentation-changed': 'what players see changed in the meantime',
  'operation-id-reused': 'this request was already used. Try again',
};

/** A presentation refusal reason in words (never a raw code). */
export function presentationReasonWords(reason: string): string {
  return REASON_WORDS[reason] ?? 'the change was refused';
}

export const LIVE_CONTROL_REQUIRED = 'Go live to change what players see.';

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
    return { audience: 'Players see: unknown', preparation: null };
  const { sceneId, blanked } = presentation;
  if (sceneId === null)
    return {
      audience: 'Players see: nothing',
      preparation: `Preparing ${input.sceneName} (players can't see it)`,
    };
  const noMapLink = input.labels[sceneId]?.sourceMapId === null;
  const audience = blanked
    ? 'Players see: blank screen'
    : `Players see: ${labelOf(sceneId, input.sceneId, input.sceneName, input.labels)}${
        noMapLink ? ' (on the TV only)' : ''
      }`;
  return {
    audience,
    preparation:
      sceneId === input.sceneId && !blanked
        ? "You're editing the scene players see. Changes show right away."
        : `Preparing ${input.sceneName} (players can't see it)`,
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
        text: duplicate
          ? "Players' view already updated"
          : "Players' view updated",
      }
    : {
        tone: 'info',
        text: 'That change went through earlier, but what players see has changed since.',
      };
}

/**
 * O7-3 (review 06): after an unconfirmed change, the re-read replaces the
 * failure sentence with what the fresh state says (Q1/Q6).
 */
export function recheckedMessage(
  intent: PresentationIntent,
  current: TableDescriptor | null
): PresentationMessage {
  if (!current)
    return {
      tone: 'info',
      text: "Couldn't confirm the change, and couldn't check what players see.",
    };
  const judged = committedMessage(intent, current, true);
  return judged.tone === 'success'
    ? { tone: 'success', text: "Checked again: players' view is updated." }
    : {
        tone: judged.tone,
        text: 'Checked again: that change went through earlier, but what players see has changed since.',
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
        text: `Not changed: ${presentationReasonWords(outcome.reason)}.`,
        retry: { label: 'Try again' },
      };
    case 'lost':
      return { tone: 'error', text: "Not changed: you're no longer live." };
    case 'unconfirmed':
      return {
        tone: 'info',
        text: "Couldn't confirm the change. Check what players see above.",
      };
    case 'failed':
      // F1: a sent command may have committed (lost response, 503 after a
      // Lua commit): never "Not changed"; offer the identical Retry, whose
      // ledger duplicate is judged per Q1. Only a never-sent command (too
      // large, queue overflow) is reported as not changed.
      // Concern 2: a definite pre-EVAL 400 cannot have committed.
      if (outcome.httpStatus === 400)
        return { tone: 'error', text: 'Not changed: the request was refused.' };
      if (presentationMayHaveCommitted(outcome))
        return {
          tone: 'error',
          text: "Couldn't confirm the change.",
          retry: { label: 'Retry', command: outcome.command },
        };
      return {
        tone: 'error',
        text: "Not changed: live play isn't available right now.",
      };
  }
}

/**
 * E13: the table display line, from the server-computed DM display status
 * only (never from Published or relay state). `loaded` is a device report,
 * not optical proof; stale/unknown never take success styling.
 */
export function displayStatusLine(input: {
  status: DisplayStatusRead;
  sceneId: string;
  sceneName: string;
  labels: PresentationLabels;
}): { text: string; tone: 'success' | 'muted' | 'warning' } {
  const { status } = input;
  if (status === 'error')
    return { text: "Couldn't check the TV", tone: 'muted' };
  switch (status.state) {
    case 'none':
      return { text: 'No TV connected', tone: 'muted' };
    case 'loaded':
      return {
        text: `TV says it's showing ${
          status.sceneId
            ? labelOf(
                status.sceneId,
                input.sceneId,
                input.sceneName,
                input.labels
              )
            : 'a scene'
        }`,
        tone: 'success',
      };
    case 'blank':
      return { text: "TV says it's blank", tone: 'muted' };
    case 'waiting':
      return { text: "TV says it's waiting", tone: 'muted' };
    case 'updating':
      return { text: 'TV updating…', tone: 'muted' };
    case 'stale':
      return {
        text: `No word from the TV for ${Math.floor((status.ageMs ?? 0) / 1000)} s`,
        tone: 'warning',
      };
  }
}
