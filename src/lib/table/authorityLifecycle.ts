import type { JsonObject } from './schema';

interface TableDescriptor {
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
      renew(): Promise<boolean>;
    }
  | { status: 'failed'; reason: string };

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
      if (!current) return { status: 'failed', reason: 'control-initialize' };
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
      return { status: 'failed', reason: 'controller-active' };
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

    return {
      status: 'prepared',
      renew: async () => {
        const renewed = await request({
          type: 'renew',
          operationId: operationId('renew'),
          expectedEpoch: current!.epoch,
          expectedRevision: current!.revision,
          expectedFence: current!.writerFence,
          holderSessionId: options.holderSessionId,
        });
        if (!renewed.response.ok || !renewed.current) return false;
        current = renewed.current;
        return true;
      },
    };
  } catch {
    return { status: 'failed', reason: 'network' };
  }
}
