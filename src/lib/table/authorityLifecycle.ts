import type { JsonObject } from './schema';
import type { SharedInitiativeState } from '@/types/sharedState';

export interface TableDescriptor {
  epoch: string;
  revision: number;
  writerFence: number;
  leaseUntil: number;
  holderSessionId: string | null;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  publicRunId: string | null;
}

interface RegistryEntry {
  sceneId: string;
  workspaceInstanceId: string;
  sourceMapId: string | null;
  registryRevision: number;
  deleted?: boolean;
}

type LifecycleResult =
  | {
      status: 'prepared';
      /** The page's one control client; every command uses its latest descriptor. */
      session: TableControlSession;
      /** Compatibility shim: renews through the session. */
      renew(): Promise<boolean>;
    }
  | {
      status: 'failed';
      reason: string;
      /** Observed lease expiry of the current holder (acquire countdown). */
      leaseUntil?: number;
      holderSessionId?: string | null;
    };

/** A presentation command exactly as sent (P3.4 Retry re-sends it as is). */
export type PresentationCommand = Readonly<{
  type: 'show' | 'blank' | 'unpresent' | 'deletePresented';
  operationId: string;
  expectedEpoch: string;
  expectedRevision: number;
  expectedFence: number;
  holderSessionId: string;
  sceneId?: string;
  expectedSceneId?: string;
}>;

export type TableControlOutcome =
  | {
      status: 'committed';
      /** Presentation commands: a ledger duplicate (judge it per Q1). */
      duplicate?: boolean;
      /** Presentation commands: the fresh committed descriptor. */
      current?: TableDescriptor;
    }
  /** Lease/fence/epoch/holder loss: Not broadcasting until explicit reacquire. */
  | { status: 'lost'; reason: string }
  /** Transport/service failure, oversize or queue overflow; nothing changed here. */
  | {
      status: 'failed';
      reason: string;
      /** Presentation commands: the command to Retry identically. */
      command?: PresentationCommand;
    }
  /**
   * Presentation-domain refusal that is NOT ownership loss (scene deleted or
   * unregistered, nothing presented, presentation changed, reused id).
   * Controls refresh from `current`; the session stays usable.
   */
  | { status: 'rejected'; reason: string; current: TableDescriptor | null }
  /** A Retry met a different digest for its id: re-read control, then Q1. */
  | { status: 'unconfirmed'; reason: 'operation-id-reused' };

/** Refusals of presentation commands that leave live control intact. */
const PRESENTATION_REJECTIONS = new Set([
  'scene-unregistered',
  'scene-deleted',
  'no-presented-scene',
  'presentation-changed',
  'operation-id-reused',
]);

export type PresentationIntent =
  | { type: 'show'; sceneId: string }
  | { type: 'blank' }
  | { type: 'unpresent' }
  | { type: 'deletePresented'; expectedSceneId: string };

/**
 * Q1: a committed presentation result — including a ledger duplicate,
 * historical or not — is "published" only if the CURRENT descriptor shows
 * the command's intended effect; otherwise the audience has since changed.
 * The `historical` flag alone never decides.
 */
export function judgePresentationOutcome(
  intent: PresentationIntent,
  current: TableDescriptor
): 'published' | 'changed' {
  const { sceneId, blanked } = current.presentation;
  const matches =
    intent.type === 'show'
      ? sceneId === intent.sceneId && !blanked
      : intent.type === 'blank'
        ? blanked
        : intent.type === 'unpresent'
          ? sceneId === null
          : sceneId !== intent.expectedSceneId;
  return matches ? 'published' : 'changed';
}

export interface TableControlSession {
  readonly holderSessionId: string;
  current(): TableDescriptor;
  isLost(): boolean;
  lostReason(): string | null;
  renew(): Promise<TableControlOutcome>;
  /** PR04 P3: explicit presentation commands; one caller intent each. */
  show(sceneId: string, operationId: string): Promise<TableControlOutcome>;
  blank(operationId: string): Promise<TableControlOutcome>;
  unpresent(operationId: string): Promise<TableControlOutcome>;
  deletePresented(
    expectedSceneId: string,
    operationId: string
  ): Promise<TableControlOutcome>;
  /** P3.4 Retry: re-sends a failed presentation command byte-identically. */
  resend(command: PresentationCommand): Promise<TableControlOutcome>;
  publishInitiative(
    runId: string,
    initiative: SharedInitiativeState
  ): Promise<TableControlOutcome>;
  endInitiative(): Promise<TableControlOutcome>;
  subscribe(listener: () => void): () => void;
}

/** Control route body limit (`tableServer/validation.ts` TABLE_REQUEST_LIMIT). */
const CONTROL_BODY_LIMIT = 16 * 1024;
const MAX_PENDING_CONTROL = 8;
const CONTROL_TIMEOUT_MS = 5_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function descriptor(value: unknown): TableDescriptor | null {
  const item = record(value);
  const presentation = record(item?.presentation);
  if (
    !item ||
    typeof item.epoch !== 'string' ||
    !Number.isSafeInteger(item.revision) ||
    !Number.isSafeInteger(item.writerFence) ||
    typeof item.leaseUntil !== 'number' ||
    !presentation
  ) {
    return null;
  }
  return item as unknown as TableDescriptor;
}

function operationId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`.slice(0, 128);
}

let browserSessionId: string | null = null;

export function getTableAuthoritySessionId(): string {
  browserSessionId ??= `table-${crypto.randomUUID()}`;
  return browserSessionId;
}

export function canvasStateToAuthorityState(
  canvasState: JsonObject,
  editor: string
): JsonObject {
  const elements = Array.isArray(canvasState.elements)
    ? structuredClone(canvasState.elements)
    : [];
  const layers = Array.isArray(canvasState.layers)
    ? canvasState.layers.flatMap(value => {
        const definition = record(value);
        return typeof definition?.id === 'string'
          ? [
              {
                id: definition.id,
                definition: structuredClone(definition) as JsonObject,
                version: 1,
                editor,
              },
            ]
          : [];
      })
    : [];
  const canvasExtensions = record(canvasState.extensions);
  const canvasFog = record(canvasExtensions?.fog);
  return {
    elements,
    layers,
    extensions: {
      fog: {
        pluginName: 'fog',
        version:
          typeof canvasFog?.version === 'number' &&
          Number.isSafeInteger(canvasFog.version)
            ? canvasFog.version
            : 1,
        data: Object.hasOwn(canvasFog ?? {}, 'data')
          ? (structuredClone(canvasFog?.data) as JsonObject[string])
          : null,
      },
    },
  };
}

/**
 * Retry-once guard for `stale-control`: the returned descriptor still names
 * our epoch, fence and holder. Lease expiry is Redis time, so the client
 * clock is deliberately NOT consulted (skew could wrongly skip or allow the
 * retry); the single retry is fully fenced by the server, which answers
 * `lease-lost` if the lease really expired (F4).
 */
function sameController(
  ours: TableDescriptor,
  theirs: TableDescriptor | null,
  holderSessionId: string
): theirs is TableDescriptor {
  return (
    theirs !== null &&
    theirs.epoch === ours.epoch &&
    theirs.writerFence === ours.writerFence &&
    theirs.holderSessionId === holderSessionId
  );
}

/**
 * The Table page's single control client (D8). Commands are serialized,
 * built from the latest descriptor when they run, and every response's
 * `current` replaces it. A 409 `stale-control` whose descriptor still names
 * our epoch, holder and fence with an unexpired lease is retried once with
 * the fresh revision (another request of ours committed in between). Every
 * other conflict or denial marks the session lost; it never acquires or
 * takes over on its own.
 */
export function createTableControlSession(options: {
  campaignCode: string;
  dmId: string;
  holderSessionId: string;
  initial: TableDescriptor;
  fetcher?: typeof fetch;
  /**
   * Client clock (tests). Advisory only: lease decisions are made by the
   * server with Redis time, never by this clock.
   */
  now?: () => number;
}): TableControlSession {
  const fetcher = options.fetcher ?? fetch;
  const url = `/api/campaign/${encodeURIComponent(options.campaignCode)}/table/control`;
  const holderSessionId = options.holderSessionId;
  let current = structuredClone(options.initial);
  let lost: string | null = null;
  let pending = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());

  const post = async (
    command: Record<string, unknown>
  ): Promise<
    | { kind: 'response'; ok: boolean; body: Record<string, unknown> | null }
    | { kind: 'too-large' }
    | { kind: 'network' }
  > => {
    const body = JSON.stringify({ dmId: options.dmId, command });
    if (new TextEncoder().encode(body).byteLength > CONTROL_BODY_LIMIT)
      return { kind: 'too-large' };
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CONTROL_TIMEOUT_MS);
    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body,
        signal: abort.signal,
      });
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = record((await response.json()) as unknown);
      } catch {
        parsed = null;
      }
      return { kind: 'response', ok: response.ok, body: parsed };
    } catch {
      return { kind: 'network' };
    } finally {
      clearTimeout(timer);
    }
  };

  const markLost = (reason: string) => {
    if (lost === null) {
      lost = reason;
      notify();
    }
  };

  type ControlType = 'renew' | 'publishInitiative' | 'endInitiative';

  const run = async (
    type: ControlType,
    extra: Record<string, unknown>
  ): Promise<TableControlOutcome> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (lost !== null) return { status: 'lost', reason: lost };
      const command = {
        type,
        operationId: operationId(type),
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        expectedFence: current.writerFence,
        holderSessionId,
        ...extra,
      };
      const result = await post(command);
      if (result.kind === 'too-large')
        return { status: 'failed', reason: 'too-large' };
      if (result.kind === 'network')
        return { status: 'failed', reason: 'network' };
      const returned = descriptor(result.body?.current);
      const reason =
        typeof result.body?.reason === 'string' ? result.body.reason : null;
      if (result.ok && result.body?.status === 'committed' && returned) {
        current = returned;
        notify();
        return { status: 'committed' };
      }
      if (
        result.body?.status === 'conflict' ||
        result.body?.status === 'denied'
      ) {
        if (
          attempt === 0 &&
          reason === 'stale-control' &&
          sameController(current, returned, holderSessionId)
        ) {
          current = returned;
          continue;
        }
        if (returned) current = returned;
        markLost(reason ?? 'conflict');
        return { status: 'lost', reason: lost ?? 'conflict' };
      }
      return { status: 'failed', reason: reason ?? 'unavailable' };
    }
    markLost('stale-control');
    return { status: 'lost', reason: 'stale-control' };
  };

  /**
   * Presentation commands (PR04 P3): same queue, latest-descriptor build and
   * one same-holder stale-control retry as `run`, but the caller's
   * operationId is kept across that retry (an uncommitted op has no ledger
   * entry), presentation refusals are `rejected` (control intact), and a
   * network failure returns the exact command for an identical Retry.
   */
  const runPresentation = async (
    build: () => PresentationCommand,
    resent: PresentationCommand | null
  ): Promise<TableControlOutcome> => {
    let command = resent ?? build();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (lost !== null) return { status: 'lost', reason: lost };
      const result = await post(command as Record<string, unknown>);
      if (result.kind === 'too-large')
        return { status: 'failed', reason: 'too-large' };
      if (result.kind === 'network')
        return { status: 'failed', reason: 'network', command };
      const returned = descriptor(result.body?.current);
      const reason =
        typeof result.body?.reason === 'string' ? result.body.reason : null;
      if (result.ok && result.body?.status === 'committed' && returned) {
        current = returned;
        notify();
        return {
          status: 'committed',
          duplicate: reason === 'duplicate',
          current: structuredClone(returned),
        };
      }
      if (
        result.body?.status === 'conflict' ||
        result.body?.status === 'denied'
      ) {
        if (reason === 'operation-id-reused' && resent !== null) {
          if (returned) {
            current = returned;
            notify();
          }
          return { status: 'unconfirmed', reason: 'operation-id-reused' };
        }
        if (reason !== null && PRESENTATION_REJECTIONS.has(reason)) {
          if (returned) current = returned;
          notify();
          return {
            status: 'rejected',
            reason,
            current: returned ? structuredClone(returned) : null,
          };
        }
        if (
          attempt === 0 &&
          reason === 'stale-control' &&
          sameController(current, returned, holderSessionId)
        ) {
          current = returned;
          command = {
            ...command,
            expectedEpoch: current.epoch,
            expectedRevision: current.revision,
            expectedFence: current.writerFence,
          };
          continue;
        }
        if (returned) current = returned;
        markLost(reason ?? 'conflict');
        return { status: 'lost', reason: lost ?? 'conflict' };
      }
      return { status: 'failed', reason: reason ?? 'unavailable', command };
    }
    markLost('stale-control');
    return { status: 'lost', reason: 'stale-control' };
  };

  const schedule = (
    task: () => Promise<TableControlOutcome>
  ): Promise<TableControlOutcome> => {
    if (lost !== null) return Promise.resolve({ status: 'lost', reason: lost });
    if (pending >= MAX_PENDING_CONTROL)
      return Promise.resolve({ status: 'failed', reason: 'queue-overflow' });
    pending += 1;
    const queued = queue.then(task);
    queue = queued.catch(() => undefined);
    return queued
      .catch(
        (): TableControlOutcome => ({ status: 'failed', reason: 'network' })
      )
      .finally(() => {
        pending -= 1;
      });
  };

  const enqueue = (
    type: ControlType,
    extra: Record<string, unknown> = {}
  ): Promise<TableControlOutcome> => schedule(() => run(type, extra));

  const present = (
    type: PresentationCommand['type'],
    operationIdValue: string,
    extra: { sceneId?: string; expectedSceneId?: string } = {}
  ): Promise<TableControlOutcome> =>
    schedule(() =>
      runPresentation(
        () => ({
          type,
          operationId: operationIdValue,
          expectedEpoch: current.epoch,
          expectedRevision: current.revision,
          expectedFence: current.writerFence,
          holderSessionId,
          ...extra,
        }),
        null
      )
    );

  return {
    holderSessionId,
    current: () => structuredClone(current),
    isLost: () => lost !== null,
    lostReason: () => lost,
    renew: () => enqueue('renew'),
    show: (sceneId, id) => present('show', id, { sceneId }),
    blank: id => present('blank', id),
    unpresent: id => present('unpresent', id),
    deletePresented: (expectedSceneId, id) =>
      present('deletePresented', id, { expectedSceneId }),
    resend: command => schedule(() => runPresentation(() => command, command)),
    publishInitiative: (runId, initiative) =>
      enqueue('publishInitiative', { runId, initiative }),
    endInitiative: () => enqueue('endInitiative'),
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Acquires private control, registers the scene identity and initializes its
 * private authority room. It deliberately never changes public presentation;
 * a future explicit Show action owns that separate contract.
 */
export async function prepareTableSceneAuthority(options: {
  campaignCode: string;
  dmId: string;
  sceneId: string;
  sourceMapId: string;
  workspaceInstanceId: string;
  contentRevision: number;
  safeLabel: string;
  canvasState: JsonObject;
  holderSessionId: string;
  fetcher?: typeof fetch;
}): Promise<LifecycleResult> {
  const fetcher = options.fetcher ?? fetch;
  const base = `/api/campaign/${encodeURIComponent(options.campaignCode)}/table`;
  const headers = {
    'Content-Type': 'application/json',
    'x-rollkeeper-csrf': '1',
  };
  const request = async (command: Record<string, unknown>) => {
    const response = await fetcher(`${base}/control`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dmId: options.dmId, command }),
    });
    const body = record((await response.json()) as unknown);
    return { response, body, current: descriptor(body?.current) };
  };
  try {
    const readResponse = await fetcher(
      `${base}/control?dmId=${encodeURIComponent(options.dmId)}`,
      { cache: 'no-store' }
    );
    if (!readResponse.ok) return { status: 'failed', reason: 'control-read' };
    const read = record((await readResponse.json()) as unknown);
    let current = descriptor(read?.current);
    const registry = Array.isArray(read?.registry)
      ? (read.registry as unknown[])
      : [];
    if (!current) {
      const initialized = await request({
        type: 'initialize',
        operationId: operationId('initialize'),
      });
      current = initialized.current;
      if (!current)
        return {
          status: 'failed',
          reason:
            initialized.response.status === 503
              ? 'live-unavailable'
              : 'control-initialize',
        };
    }
    const controlled = await request({
      type:
        current.holderSessionId === options.holderSessionId &&
        current.leaseUntil > Date.now()
          ? 'renew'
          : 'acquire',
      operationId: operationId('acquire'),
      expectedEpoch: current.epoch,
      expectedRevision: current.revision,
      expectedFence: current.writerFence,
      holderSessionId: options.holderSessionId,
    });
    if (controlled.response.ok && controlled.current) {
      current = controlled.current;
    } else if (controlled.body?.reason === 'controller-active') {
      return {
        status: 'failed',
        reason: 'controller-active',
        ...(controlled.current
          ? {
              leaseUntil: controlled.current.leaseUntil,
              holderSessionId: controlled.current.holderSessionId,
            }
          : {}),
      };
    } else if (controlled.response.status === 503) {
      return { status: 'failed', reason: 'live-unavailable' };
    } else {
      return { status: 'failed', reason: 'control-acquire' };
    }

    const existing = registry
      .map(value => record(value) as RegistryEntry | null)
      .find(value => value?.sceneId === options.sceneId);
    if (
      existing &&
      (existing.deleted === true ||
        existing.workspaceInstanceId !== options.workspaceInstanceId ||
        existing.sourceMapId !== options.sourceMapId)
    ) {
      return { status: 'failed', reason: 'scene-identity-conflict' };
    }
    if (!existing) {
      const registered = await request({
        type: 'registerScene',
        operationId: operationId('register'),
        expectedEpoch: current.epoch,
        expectedRevision: current.revision,
        expectedFence: current.writerFence,
        holderSessionId: options.holderSessionId,
        sceneId: options.sceneId,
        workspaceInstanceId: options.workspaceInstanceId,
        sourceMapId: options.sourceMapId,
        contentRevision: options.contentRevision,
        safeLabel: options.safeLabel,
        expectedRegistryRevision: 0,
      });
      if (!registered.response.ok || !registered.current)
        return { status: 'failed', reason: 'scene-register' };
      current = registered.current;
    }
    const authority = await fetcher(`${base}/authority/initialize-if-empty`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dmId: options.dmId,
        sceneId: options.sceneId,
        expectedGeneration: null,
        expectedCasToken: null,
        state: canvasStateToAuthorityState(options.canvasState, options.dmId),
      }),
    });
    if (!authority.ok && authority.status !== 409) {
      return { status: 'failed', reason: 'authority-initialize' };
    }

    const session = createTableControlSession({
      campaignCode: options.campaignCode,
      dmId: options.dmId,
      holderSessionId: options.holderSessionId,
      initial: current,
      fetcher,
    });
    return {
      status: 'prepared',
      session,
      renew: async () => (await session.renew()).status === 'committed',
    };
  } catch {
    return { status: 'failed', reason: 'network' };
  }
}
