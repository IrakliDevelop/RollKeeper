import { describe, expect, it } from 'vitest';

import { TableControlService, tableRegistryKey } from './control';

const CODE = 'MANUAL';
const entry = (sceneId: string) => ({
  v: 1,
  sceneId,
  sourceMapId: `map-${sceneId}`,
  roomId: '423e4567-e89b-42d3-a456-426614174000',
  deleted: false,
});

function service(hgetall: unknown) {
  return new TableControlService({
    eval: async () => null,
    get: async () => null,
    hgetall: async (key: string) => {
      expect(key).toBe(tableRegistryKey(CODE));
      return hgetall;
    },
  } as never);
}

const principal = { id: 'dm-a', campaignCode: CODE, role: 'dm' as const };

describe('TableControlService.registry', () => {
  it('decodes the raw REST flat-array HGETALL shape', async () => {
    await expect(
      service([
        'scene-a',
        JSON.stringify(entry('scene-a')),
        'scene-b',
        JSON.stringify(entry('scene-b')),
      ]).registry(principal)
    ).resolves.toEqual([entry('scene-a'), entry('scene-b')]);
  });

  it('decodes the object HGETALL shape and an absent hash', async () => {
    await expect(
      service({ 'scene-a': JSON.stringify(entry('scene-a')) }).registry(
        principal
      )
    ).resolves.toEqual([entry('scene-a')]);
    await expect(service(null).registry(principal)).resolves.toEqual([]);
  });

  it('fails closed on a malformed flat array', async () => {
    await expect(service(['scene-a']).registry(principal)).rejects.toThrow();
  });
});

describe('TableControlService.execute (PR04 projection timestamp)', () => {
  it('supplies the projection updatedAt as an ISO-8601 ARGV', async () => {
    const calls: unknown[][] = [];
    const svc = new TableControlService({
      eval: async (...args: unknown[]) => {
        calls.push(args);
        return JSON.stringify({ status: 'committed', reason: 'current' });
      },
      get: async () => null,
      hgetall: async () => null,
    } as never);
    await svc.execute(principal, { type: 'initialize', operationId: 'op-1' });
    const argv = calls[0][2] as string[];
    expect(argv).toHaveLength(6);
    expect(argv[5]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  });
});
