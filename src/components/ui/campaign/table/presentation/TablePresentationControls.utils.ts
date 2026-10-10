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
  'operation-id-reused': 'this request was already used, try again',
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
        noMapLink ? " · TV only, not on players' devices" : ''
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
 * PR07 P9 (R3-4): the display's scale self-report as an inline muted line
 * (verified / unsupported). Verify-required is a workspace notice instead.
 */
export function displayCalibrationLine(
  status: DisplayStatusRead | null,
  /** O7-A5: `verified` was reported earlier in this DM page session. */
  verifiedSeen = false
): { text: string; tone: 'muted' } | null {
  if (!status || status === 'error') return null;
  if (status.calibration === 'uncalibrated' && verifiedSeen)
    return { text: "TV says it's back to normal view", tone: 'muted' };
  if (status.calibration === 'verified')
    return { text: 'TV says the scale is checked', tone: 'muted' };
  if (status.calibration === 'unsupported')
    return {
      text: "TV says this scene can't use mini scale (it needs a square grid)",
      tone: 'muted',
    };
  return null;
}

/** PR07 P9 (FC-1): the never-collapsing DM notice for verify-required. */
export function calibrationNotice(status: DisplayStatusRead | null): {
  id: string;
  text: string;
  tone: 'alert';
} | null {
  if (!status || status === 'error') return null;
  return status.calibration === 'verify-required'
    ? {
        id: 'table-scale',
        text: 'TV says the scale needs checking. Use Check scale on the TV.',
        tone: 'alert',
      }
    : null;
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
