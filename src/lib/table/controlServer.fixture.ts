import { vi } from 'vitest';

/**
 * In-memory model of the PR03A control Lua (atomic.ts) including the scene
 * registry rules of `registerScene`: exact epoch/revision/fence, ownership,
 * per-entry registry revision, identity mismatch, HLEN cap and entry size.
 */
export function registryServer(
  options: {
    now?: () => number;
    /** Simulates a registry read (by index) that does not yet show a scene. */
    hideFromRead?: (sceneId: string, readIndex: number) => boolean;
    entryLimit?: number;
    initializeStatus?: number;
    /** Awaited before answering a scene's register or room initialize. */
    gate?: (
      kind: 'registerScene' | 'initialize',
      sceneId: string
    ) => Promise<void> | void;
  } = {}
) {
  const now = options.now ?? (() => Date.now());
  const state = {
    epoch: '10000000-0000-4000-8000-000000000001',
    revision: 0,
    writerFence: 0,
    leaseUntil: 0,
    holderSessionId: null as string | null,
    presentation: {
      sceneId: null as string | null,
      revision: 0,
      blanked: false,
    },
    publicRunId: null as string | null,
  };
  const registry = new Map<string, Record<string, unknown>>();
  const commands: Array<Record<string, unknown>> = [];
  const reads: string[] = [];
  const initializes: Array<Record<string, unknown>> = [];
  const descriptor = () => structuredClone(state);
  const reply = (status: string, reason: string, code: number) =>
    Response.json({ status, reason, current: descriptor() }, { status: code });
  const execute = (command: Record<string, unknown>): Response => {
    commands.push(command);
    if (command.expectedEpoch !== state.epoch)
      return reply('conflict', 'stale-epoch', 409);
    if (command.expectedRevision !== state.revision)
      return reply('conflict', 'stale-control', 409);
    if (command.expectedFence !== state.writerFence)
      return reply('conflict', 'stale-fence', 409);
    const leaseActive = state.leaseUntil > now();
    const owns =
      leaseActive && state.holderSessionId === command.holderSessionId;
    switch (command.type) {
      case 'acquire':
        if (leaseActive) return reply('conflict', 'controller-active', 409);
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = now() + 30_000;
        break;
      case 'takeover':
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = now() + 30_000;
        break;
      case 'renew':
        if (!owns) return reply('conflict', 'lease-lost', 409);
        state.leaseUntil = now() + 30_000;
        break;
      case 'registerScene': {
        if (!owns) return reply('conflict', 'lease-lost', 409);
        const sceneId = String(command.sceneId);
        const existing = registry.get(sceneId);
        if (
          existing &&
          (existing.workspaceInstanceId !== command.workspaceInstanceId ||
            existing.sourceMapId !== command.sourceMapId ||
            existing.deleted === true)
        )
          return reply('conflict', 'scene-already-registered', 409);
        const registryRevision = Number(existing?.registryRevision ?? 0);
        if (command.expectedRegistryRevision !== registryRevision)
          return reply('conflict', 'stale-registry', 409);
        if (!existing && registry.size >= 100)
          return reply('denied', 'registry-full', 403);
        const entry = {
          v: 1,
          sceneId,
          workspaceInstanceId: command.workspaceInstanceId,
          sourceMapId: command.sourceMapId,
          contentRevision: command.contentRevision,
          safeLabel: command.safeLabel,
          registryRevision: registryRevision + 1,
          deleted: false,
        };
        if (JSON.stringify(entry).length > (options.entryLimit ?? 2048))
          return reply('denied', 'entry-too-large', 403);
        registry.set(sceneId, entry);
        break;
      }
      default:
        if (!owns) return reply('conflict', 'lease-lost', 409);
    }
    state.revision += 1;
    return reply('committed', 'current', 200);
  };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (!init?.method || init.method === 'GET') {
      const readIndex = reads.length;
      reads.push(url);
      return Response.json({
        current:
          state.revision === 0 && state.writerFence === 0 ? null : descriptor(),
        registry: [...registry.values()].filter(
          entry => !options.hideFromRead?.(String(entry.sceneId), readIndex)
        ),
      });
    }
    if (url.endsWith('/table/control')) {
      const body = JSON.parse(String(init.body)) as {
        command: Record<string, unknown>;
      };
      if (body.command.type === 'initialize') {
        commands.push(body.command);
        return Response.json({ status: 'committed', current: descriptor() });
      }
      const response = execute(body.command);
      // A delayed reply: the Lua already ran (as on the real server).
      if (body.command.type === 'registerScene')
        await options.gate?.('registerScene', String(body.command.sceneId));
      return response;
    }
    if (url.endsWith('/authority/initialize-if-empty')) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      initializes.push(body);
      await options.gate?.('initialize', String(body.sceneId));
      const status = options.initializeStatus ?? 200;
      return Response.json({ status: 'ok' }, { status });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  const other = (type: string, holderSessionId: string) =>
    execute({
      type,
      expectedEpoch: state.epoch,
      expectedRevision: state.revision,
      expectedFence: state.writerFence,
      holderSessionId,
    });
  return {
    state,
    registry,
    commands,
    reads,
    initializes,
    fetcher,
    execute,
    other,
  };
}
