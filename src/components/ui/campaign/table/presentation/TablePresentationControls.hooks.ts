'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  PresentationCommand,
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
  failureMessage,
} from './TablePresentationControls.utils';

const POLL_MS = 10_000;

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
  const lastIntent = useRef<PresentationIntent | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
    };
  }, []);

  /** One DM control read; concurrent calls share nothing (single flight). */
  const readControl = useCallback(async (): Promise<TableDescriptor | null> => {
    if (inFlight.current) return null;
    const abort = new AbortController();
    inFlight.current = abort;
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
      if (inFlight.current === abort) inFlight.current = null;
    }
  }, [campaignCode, dmId]);

  // Non-holder: read-only status poll.
  useEffect(() => {
    if (holder) return;
    void readControl();
    const timer = setInterval(() => void readControl(), POLL_MS);
    return () => clearInterval(timer);
  }, [holder, readControl]);

  const descriptor = holder ? props.descriptor : (polled ?? props.descriptor);
  const presentedId = descriptor?.presentation.sceneId ?? null;

  // Holder: fetch registry labels when another scene becomes presented.
  useEffect(() => {
    if (!holder || presentedId === null || presentedId === sceneId) return;
    if (labels[presentedId]) return;
    void readControl();
    // `labels` deliberately omitted: one read per presented scene change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder, presentedId, sceneId, readControl]);

  const settle = useCallback(
    async (intent: PresentationIntent, outcome: TableControlOutcome) => {
      if (outcome.status === 'committed') {
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
        const judged = current
          ? committedMessage(intent, current, true)
          : { tone: 'info' as const, text: 'audience status unknown' };
        setMessage({
          tone: judged.tone,
          text: `${failed.text} · ${judged.text}`,
        });
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
    show: () => intend({ type: 'show', sceneId }),
    reveal: () => {
      if (presentedId) intend({ type: 'show', sceneId: presentedId });
    },
    blank: () => intend({ type: 'blank' }),
    unpresent: () => intend({ type: 'unpresent' }),
    retry,
  };
}
