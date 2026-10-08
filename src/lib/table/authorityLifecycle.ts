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
      /**
       * HTTP status of a non-conflict reply. 400 is returned only before the
       * control EVAL (definite non-commit); 503/5xx may follow a commit.
       */
      httpStatus?: number;
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
  /**
   * PR06 A1: the existing `registerScene` control command through this
   * session's queue (latest descriptor, one same-holder stale-control
   * retry). Registry refusals that are not ownership loss are `rejected`
   * and never mark the session lost.
   */
  registerScene(input: TableSceneRegistration): Promise<TableControlOutcome>;
  subscribe(listener: () => void): () => void;
}

export interface TableSceneRegistration {
  sceneId: string;
  workspaceInstanceId: string;
  sourceMapId: string;
  contentRevision: number;
  safeLabel: string;
  expectedRegistryRevision: number;
}

/** Registry refusals of `registerScene` that leave live control intact. */
const REGISTRY_REJECTIONS = new Set([
  'stale-registry',
  'scene-already-registered',
  'registry-full',
  'entry-too-large',
]);

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
    | {
        kind: 'response';
        ok: boolean;
        httpStatus: number;
        body: Record<string, unknown> | null;
      }
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
      return {
        kind: 'response',
        ok: response.ok,
        httpStatus: response.status,
        body: parsed,
      };
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

  type ControlType =
    | 'renew'
    | 'publishInitiative'
    | 'endInitiative'
    | 'registerScene';

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
        if (
          type === 'registerScene' &&
          reason !== null &&
          REGISTRY_REJECTIONS.has(reason)
        ) {
          if (returned) current = returned;
          notify();
          return {
            status: 'rejected',
            reason,
            current: returned ? structuredClone(returned) : null,
          };
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
      return {
        status: 'failed',
        reason: reason ?? 'unavailable',
        command,
        httpStatus: result.httpStatus,
      };
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
    registerScene: input => enqueue('registerScene', { ...input }),
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type TableControlAcquireResult =
  | { status: 'acquired'; session: TableControlSession }
  | {
      status: 'failed';
      reason: string;
      /** Observed lease expiry of the current holder (acquire countdown). */
      leaseUntil?: number;
      holderSessionId?: string | null;
    };

interface ControlRequestOptions {
  campaignCode: string;
  dmId: string;
  fetcher?: typeof fetch;
}

const CONTROL_HEADERS = {
  'Content-Type': 'application/json',
  'x-rollkeeper-csrf': '1',
};

const tableBase = (campaignCode: string) =>
  `/api/campaign/${encodeURIComponent(campaignCode)}/table`;

/** One DM `GET table/control` (descriptor + DM-only registry). */
async function readControl(
  options: ControlRequestOptions
): Promise<{ current: TableDescriptor | null; registry: unknown[] } | null> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    `${tableBase(options.campaignCode)}/control?dmId=${encodeURIComponent(options.dmId)}`,
    { cache: 'no-store' }
  );
  if (!response.ok) return null;
  const read = record((await response.json()) as unknown);
  return {
    current: descriptor(read?.current),
    registry: Array.isArray(read?.registry) ? (read.registry as unknown[]) : [],
  };
}

/**
 * PR06 A1(a): acquires (or renews) private live control exactly as the PR03
 * prepare did — control read, initialize if missing, renew-or-acquire, never
 * a takeover — and returns the page's one control session.
 */
export async function acquireTableControl(
  options: ControlRequestOptions & { holderSessionId: string }
): Promise<TableControlAcquireResult> {
  const fetcher = options.fetcher ?? fetch;
  const request = async (command: Record<string, unknown>) => {
    const response = await fetcher(
      `${tableBase(options.campaignCode)}/control`,
      {
        method: 'POST',
        headers: CONTROL_HEADERS,
        body: JSON.stringify({ dmId: options.dmId, command }),
      }
    );
    const body = record((await response.json()) as unknown);
    return { response, body, current: descriptor(body?.current) };
  };
  try {
    const read = await readControl(options);
    if (!read) return { status: 'failed', reason: 'control-read' };
    let current = read.current;
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
    return {
      status: 'acquired',
      session: createTableControlSession({
        campaignCode: options.campaignCode,
        dmId: options.dmId,
        holderSessionId: options.holderSessionId,
        initial: current,
        fetcher,
      }),
    };
  } catch {
    return { status: 'failed', reason: 'network' };
  }
}

export interface TableSceneRoomInput {
  sceneId: string;
  sourceMapId: string;
  workspaceInstanceId: string;
  contentRevision: number;
  safeLabel: string;
  canvasState: JsonObject;
}

export type TableSceneRoomResult =
  | { status: 'ready'; registered: 'existing' | 'new' }
  /** Registry entry of another identity, or deleted: local-only. */
  | { status: 'conflict'; reason: 'scene-identity-conflict' }
  /** Registry refusal that is not ownership loss (visible text). */
  | { status: 'rejected'; reason: string }
  /** Ownership lost while registering: the session is marked lost. */
  | { status: 'lost'; reason: string }
  | { status: 'failed'; reason: string };

function registryEntry(
  registry: unknown[],
  sceneId: string
): RegistryEntry | undefined {
  return registry
    .map(value => record(value) as RegistryEntry | null)
    .find((value): value is RegistryEntry => value?.sceneId === sceneId);
}

function sameIdentity(entry: RegistryEntry, input: TableSceneRoomInput) {
  return (
    entry.deleted !== true &&
    entry.workspaceInstanceId === input.workspaceInstanceId &&
    entry.sourceMapId === input.sourceMapId
  );
}

/**
 * PR06 A1(b): registers one scene through the page's control session and
 * seeds its private authority room. A fresh DM registry read decides
 * (R3-F5): same identity → already registered; another identity or a
 * deleted entry → `scene-identity-conflict`; otherwise `registerScene`
 * through the session. `stale-registry` re-reads (same identity counts as
 * registered); `scene-already-registered` is an identity conflict;
 * `registry-full` / `entry-too-large` are rejected. None of these mark the
 * session lost; ownership reasons do. `initialize-if-empty` 409 = success.
 * Never sends a presentation command.
 */
export async function prepareTableSceneRoom(
  session: TableControlSession,
  input: TableSceneRoomInput,
  options: ControlRequestOptions
): Promise<TableSceneRoomResult> {
  const fetcher = options.fetcher ?? fetch;
  try {
    if (session.isLost())
      return { status: 'lost', reason: session.lostReason() ?? 'conflict' };
    const read = await readControl(options);
    if (!read) return { status: 'failed', reason: 'control-read' };
    let existing = registryEntry(read.registry, input.sceneId);
    let registered: 'existing' | 'new' = 'existing';
    if (existing && !sameIdentity(existing, input))
      return { status: 'conflict', reason: 'scene-identity-conflict' };
    if (!existing) {
      const outcome = await session.registerScene({
        sceneId: input.sceneId,
        workspaceInstanceId: input.workspaceInstanceId,
        sourceMapId: input.sourceMapId,
        contentRevision: input.contentRevision,
        safeLabel: input.safeLabel,
        expectedRegistryRevision: 0,
      });
      if (outcome.status === 'lost')
        return { status: 'lost', reason: outcome.reason };
      if (outcome.status === 'rejected') {
        if (outcome.reason === 'scene-already-registered')
          return { status: 'conflict', reason: 'scene-identity-conflict' };
        if (outcome.reason !== 'stale-registry')
          return { status: 'rejected', reason: outcome.reason };
        const reread = await readControl(options);
        if (!reread) return { status: 'failed', reason: 'control-read' };
        existing = registryEntry(reread.registry, input.sceneId);
        if (!existing || !sameIdentity(existing, input))
          return { status: 'conflict', reason: 'scene-identity-conflict' };
      } else if (outcome.status !== 'committed') {
        return { status: 'failed', reason: 'scene-register' };
      } else {
        registered = 'new';
      }
    }
    const authority = await fetcher(
      `${tableBase(options.campaignCode)}/authority/initialize-if-empty`,
      {
        method: 'POST',
        headers: CONTROL_HEADERS,
        body: JSON.stringify({
          dmId: options.dmId,
          sceneId: input.sceneId,
          expectedGeneration: null,
          expectedCasToken: null,
          state: canvasStateToAuthorityState(input.canvasState, options.dmId),
        }),
      }
    );
    if (!authority.ok && authority.status !== 409)
      return { status: 'failed', reason: 'authority-initialize' };
    return { status: 'ready', registered };
  } catch {
    return { status: 'failed', reason: 'network' };
  }
}

/** Visible wording of a scene-room outcome that left the scene local-only. */
export function sceneRoomMessage(result: TableSceneRoomResult): string | null {
  switch (result.status) {
    case 'ready':
      return null;
    case 'conflict':
      return 'This scene is registered from another device or workspace. It stays local-only here.';
    case 'rejected':
      return result.reason === 'registry-full'
        ? 'This campaign already has the maximum number of live scenes'
        : result.reason === 'entry-too-large'
          ? 'Scene name is too long to register'
          : 'The server refused to register this scene';
    case 'lost':
      return 'Live control was lost while registering this scene.';
    case 'failed':
      return 'Live registration is unavailable; this scene stays local.';
  }
}

/**
 * Acquires private control, registers the scene identity and initializes its
 * private authority room. It deliberately never changes public presentation;
 * a future explicit Show action owns that separate contract. PR06: the
 * composition of A1(a) + A1(b), kept for the battle-maps adoption panel
 * (which drops the returned session).
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
  const acquired = await acquireTableControl(options);
  if (acquired.status === 'failed') return acquired;
  const session = acquired.session;
  const room = await prepareTableSceneRoom(session, options, options);
  if (room.status !== 'ready') {
    return {
      status: 'failed',
      reason:
        room.status === 'conflict'
          ? 'scene-identity-conflict'
          : room.status === 'failed' &&
              (room.reason === 'authority-initialize' ||
                room.reason === 'network')
            ? room.reason
            : 'scene-register',
    };
  }
  return {
    status: 'prepared',
    session,
    renew: async () => (await session.renew()).status === 'committed',
  };
}

/**
 * Whether a presentation command that did not commit may still have been
 * applied (lost response, 503/5xx after a commit). A definite pre-EVAL 400
 * and never-sent failures (too large, queue overflow) cannot have committed.
 */
export function presentationMayHaveCommitted(
  outcome: TableControlOutcome
): boolean {
  if (outcome.status === 'unconfirmed') return true;
  if (outcome.status !== 'failed') return false;
  if (outcome.httpStatus === 400) return false;
  return outcome.command !== undefined || outcome.reason === 'network';
}
