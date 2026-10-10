'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  judgePresentationOutcome,
  type PresentationCommand,
  PresentationIntent,
  TableControlOutcome,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';

import type {
  PresentationLabels,
  PresentationMessage,
  TablePresentationControlsProps,
} from './TablePresentationControls.types';
import {
  committedMessage,
  recheckedMessage,
  failureMessage,
} from './TablePresentationControls.utils';

const POLL_MS = 10_000;
const READ_TIMEOUT_MS = 5_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function descriptorOf(value: unknown): TableDescriptor | null {
  const item = record(value);
  const presentation = record(item?.presentation);
  return item && presentation && typeof item.epoch === 'string'
    ? (item as unknown as TableDescriptor)
    : null;
}

function labelsOf(registry: unknown): PresentationLabels {
  const labels: Record<
    string,
    { safeLabel: string; sourceMapId: string | null }
  > = {};
  for (const value of Array.isArray(registry) ? registry : []) {
    const entry = record(value);
    if (
      typeof entry?.sceneId !== 'string' ||
      typeof entry.safeLabel !== 'string'
    )
      continue;
    labels[entry.sceneId] = {
      safeLabel: entry.safeLabel,
      sourceMapId:
        typeof entry.sourceMapId === 'string' ? entry.sourceMapId : null,
    };
  }
  return labels;
}

/**
 * State and intents of the Table presentation controls (PR04 P4). The
 * holder uses the page control session's descriptor; any other state reads
 * the DM `table/control` GET every 10 s (one request in flight, aborted on
 * unmount) and never acquires or takes over. Each click is one command with
 * a fresh operation id; a network failure keeps the exact command for an
 * identical Retry; Published only after a server commit judged by Q1.
 */
export function useTablePresentation(props: TablePresentationControlsProps) {
  const { campaignCode, dmId, sceneId, authorityState, session } = props;
  const holder =
    authorityState.phase === 'ready' && session !== null && !session.isLost();
  const [polled, setPolled] = useState<TableDescriptor | null>(null);
  const [labels, setLabels] = useState<PresentationLabels>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<PresentationMessage | null>(null);
  /** PR05 E13: bumps on every committed presentation command. */
  const [committedCount, setCommittedCount] = useState(0);
  const lastIntent = useRef<PresentationIntent | null>(null);
  /** Control revision the current success message was judged against. */
  const judgedRevision = useRef(-1);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // A1: an aborted read must not block the next one (StrictMode
      // remount, page transitions).
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, []);

  /** One DM control read; concurrent calls share nothing (single flight). */
  const readControl = useCallback(async (): Promise<TableDescriptor | null> => {
    if (inFlight.current) return null;
    const abort = new AbortController();
    inFlight.current = abort;
    // F3: a hung read must not block later polls (single flight).
    const timeout = setTimeout(() => abort.abort(), READ_TIMEOUT_MS);
    try {
      const response = await fetch(
        `/api/campaign/${encodeURIComponent(campaignCode)}/table/control?dmId=${encodeURIComponent(dmId)}`,
        { cache: 'no-store', signal: abort.signal }
      );
      if (!response.ok) return null;
      const body = record((await response.json()) as unknown);
      if (!mounted.current || abort.signal.aborted) return null;
      const current = descriptorOf(body?.current);
      setLabels(labelsOf(body?.registry));
      setPolled(current);
      return current;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      if (inFlight.current === abort) inFlight.current = null;
    }
  }, [campaignCode, dmId]);

  // Non-holder: read-only status poll.
  const inactive = props.inactive === true;
  useEffect(() => {
    if (holder || inactive) return;
    void readControl();
    const timer = setInterval(() => void readControl(), POLL_MS);
    return () => clearInterval(timer);
  }, [holder, inactive, readControl]);

  const descriptor = holder ? props.descriptor : (polled ?? props.descriptor);
  const presentedId = descriptor?.presentation.sceneId ?? null;

  // Holder: fetch the registry label of another presented scene, and keep
  // retrying on each descriptor change (every renew, ~10 s) until it is
  // known — a single aborted or failed read never leaves "another scene".
  const labelKnown = presentedId !== null && labels[presentedId] !== undefined;
  const revision = descriptor?.revision ?? null;
  useEffect(() => {
    if (!holder || presentedId === null || presentedId === sceneId) return;
    if (labelKnown) return;
    void readControl();
  }, [holder, presentedId, sceneId, labelKnown, revision, readControl]);

  // A3: the action message describes one moment. Drop it when control is
  // lost, and drop a success message once the audience no longer matches
  // the intent it reported.
  useEffect(() => {
    if (!holder) {
      setMessage(null);
      return;
    }
    const intent = lastIntent.current;
    if (
      message?.tone === 'success' &&
      intent &&
      descriptor &&
      descriptor.revision > judgedRevision.current &&
      judgePresentationOutcome(intent, descriptor) !== 'published'
    )
      setMessage(null);
  }, [holder, descriptor, message]);

  const settle = useCallback(
    async (intent: PresentationIntent, outcome: TableControlOutcome) => {
      if (outcome.status === 'committed') {
        setCommittedCount(count => count + 1);
        judgedRevision.current = (
          outcome.current ?? session!.current()
        ).revision;
        setMessage(
          committedMessage(
            intent,
            outcome.current ?? session!.current(),
            outcome.duplicate === true
          )
        );
        return;
      }
      const failed = failureMessage(outcome);
      setMessage(failed);
      if (outcome.status === 'unconfirmed') {
        // Q6: re-read control, then judge the request by the fresh state.
        const current = await readControl();
        if (!mounted.current) return;
        if (current) judgedRevision.current = current.revision;
        setMessage(recheckedMessage(intent, current));
      }
    },
    [readControl, session]
  );

  const run = useCallback(
    async (
      intent: PresentationIntent,
      send: () => Promise<TableControlOutcome>
    ) => {
      if (!holder || pending) return;
      lastIntent.current = intent;
      setPending(true);
      setMessage(null);
      try {
        await settle(intent, await send());
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    [holder, pending, settle]
  );

  const opId = (type: string) => `${type}-${crypto.randomUUID()}`;
  const intend = useCallback(
    (intent: PresentationIntent) => {
      if (!session) return;
      void run(intent, () => {
        switch (intent.type) {
          case 'show':
            return session.show(intent.sceneId, opId('show'));
          case 'blank':
            return session.blank(opId('blank'));
          case 'unpresent':
            return session.unpresent(opId('unpresent'));
          case 'deletePresented':
            return session.deletePresented(
              intent.expectedSceneId,
              opId('delete')
            );
        }
      });
    },
    [run, session]
  );

  const retry = useCallback(() => {
    const intent = lastIntent.current;
    const target = message?.retry;
    if (!intent || !target || !session) return;
    const command: PresentationCommand | undefined = target.command;
    if (command) void run(intent, () => session.resend(command));
    else intend(intent);
  }, [intend, message, run, session]);

  return {
    holder,
    descriptor,
    labels,
    pending,
    message,
    committedCount,
    show: () => {
      if (sceneId) intend({ type: 'show', sceneId });
    },
    reveal: () => {
      if (presentedId) intend({ type: 'show', sceneId: presentedId });
    },
    blank: () => intend({ type: 'blank' }),
    unpresent: () => intend({ type: 'unpresent' }),
    retry,
  };
}
