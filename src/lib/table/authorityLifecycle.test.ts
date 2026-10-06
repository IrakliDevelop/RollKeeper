import { describe, expect, it, vi } from 'vitest';

import { prepareTableSceneAuthority } from './authorityLifecycle';

const descriptor = (revision: number, writerFence: number) => ({
  epoch: '10000000-0000-4000-8000-000000000001',
  revision,
  writerFence,
  leaseUntil: Date.now() + 30_000,
  holderSessionId: writerFence > 0 ? 'table-session-1' : null,
  presentation: { sceneId: null as string | null, revision: 0, blanked: false },
  publicRunId: null,
});

describe('Table scene authority lifecycle', () => {
  it('prepares a private room without changing the admitted audience presentation', async () => {
    const admittedPresentation = {
      sceneId: 'already-presented-tavern',
      revision: 7,
      blanked: false,
    };
    let current: ReturnType<typeof descriptor> | null = {
      ...descriptor(7, 2),
      presentation: admittedPresentation,
    };
    const commands: Array<Record<string, unknown>> = [];
    const admittedAudiencePrivateFrames: unknown[] = [];
    let authorityBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes('/table/control') && !init?.method) {
        return Response.json({ current, registry: [] });
      }
      if (url.endsWith('/table/control')) {
        const body = JSON.parse(String(init?.body)) as {
          command: Record<string, unknown>;
        };
        commands.push(body.command);
        const type = body.command.type;
        if (type === 'initialize') current = descriptor(0, 0);
        else if (type === 'acquire' || type === 'renew')
          current = {
            ...descriptor(8, 3),
            presentation: admittedPresentation,
          };
        else if (type === 'registerScene')
          current = {
            ...descriptor(9, 3),
            presentation: admittedPresentation,
          };
        else admittedAudiencePrivateFrames.push({ command: type });
        return Response.json({ status: 'committed', current });
      }
      if (url.endsWith('/authority/initialize-if-empty')) {
        authorityBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return Response.json({ status: 'provisioned' });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await prepareTableSceneAuthority({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      workspaceInstanceId: 'workspace-1',
      contentRevision: 1,
      safeLabel: 'Crypt',
      canvasState: {
        version: 4,
        camera: { position: { x: 8, y: 9 }, zoom: 2 },
        elements: [{ id: 'token-1', type: 'token' }],
        layers: [
          {
            id: 'tokens',
            name: 'Tokens',
            visible: true,
            locked: false,
            order: 0,
            opacity: 1,
          },
        ],
        activeLayerId: 'tokens',
        extensions: { fog: { version: 1, data: null } },
      },
      holderSessionId: 'table-session-1',
      fetcher,
    });

    expect(result.status).toBe('prepared');
    expect(commands.map(command => command.type)).toEqual([
      'renew',
      'registerScene',
    ]);
    expect(commands[1]).toMatchObject({
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      workspaceInstanceId: 'workspace-1',
    });
    expect(authorityBody).toMatchObject({
      dmId: 'dm-1',
      sceneId: 'scene-1',
      expectedGeneration: null,
      expectedCasToken: null,
      state: {
        elements: [{ id: 'token-1' }],
        layers: [
          {
            id: 'tokens',
            definition: { id: 'tokens', name: 'Tokens' },
            version: 1,
            editor: 'dm-1',
          },
        ],
        extensions: {
          fog: { pluginName: 'fog', version: 1, data: null },
        },
      },
    });
    expect(current?.presentation).toEqual(admittedPresentation);
    expect(admittedAudiencePrivateFrames).toEqual([]);
  });

  it('does not silently take over another active controller', async () => {
    const commands: string[] = [];
    const active = {
      ...descriptor(8, 3),
      holderSessionId: 'other-session',
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (!init?.method)
        return Response.json({ current: active, registry: [] });
      const command = (
        JSON.parse(String(init.body)) as { command: { type: string } }
      ).command;
      commands.push(command.type);
      return Response.json(
        { status: 'conflict', reason: 'controller-active', current: active },
        { status: 409 }
      );
    });
    await expect(
      prepareTableSceneAuthority({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        sourceMapId: 'map-original',
        workspaceInstanceId: 'workspace-1',
        contentRevision: 1,
        safeLabel: 'Crypt',
        canvasState: {},
        holderSessionId: 'table-session-1',
        fetcher,
      })
    ).resolves.toEqual({ status: 'failed', reason: 'controller-active' });
    expect(commands).toEqual(['acquire']);
  });
});
