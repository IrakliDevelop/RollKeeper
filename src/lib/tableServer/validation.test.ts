import { describe, expect, it } from 'vitest';
import { parseTableCommand, readBoundedJson } from './validation';

const base = {
  operationId: 'op-1',
  expectedEpoch: '19a12345-1234-4123-8123-123456789abc',
  expectedRevision: 1,
  expectedFence: 1,
  holderSessionId: 'session-1',
};
const initiative = {
  encounterId: 'run-1',
  isActive: true,
  round: 1,
  currentEntityId: null,
  turnOrder: [{ entityId: 'enemy-1', displayName: 'Enemy', type: 'monster' }],
  enemyHpMode: 'off',
  enemyConditionsMode: 'off',
  updatedAt: '2026-09-28T00:00:00.000Z',
};

describe('Table command validation', () => {
  it('accepts masked initiative and rejects private or unmasked fields', () => {
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative,
      })
    ).not.toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative: { ...initiative, privateNotes: 'DM-only' },
      })
    ).toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative: {
          ...initiative,
          turnOrder: [{ ...initiative.turnOrder[0], currentHp: 7 }],
        },
      })
    ).toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative: {
          ...initiative,
          turnOrder: [
            { ...initiative.turnOrder[0], conditions: [{ name: 'secret' }] },
          ],
        },
      })
    ).toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative: {
          ...initiative,
          turnOrder: [{ ...initiative.turnOrder[0], isDead: true }],
        },
      })
    ).toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiative',
        runId: 'run-1',
        initiative: {
          ...initiative,
          turnOrder: [{ ...initiative.turnOrder[0], hpState: 'Bloodied' }],
        },
      })
    ).toBeNull();
  });

  it('rejects extra request fields before publishing to the shared reader', () => {
    expect(
      parseTableCommand({
        ...base,
        type: 'publishInitiativeRequest',
        request: {
          requestId: 'request-1',
          encounterId: 'run-1',
          encounterName: 'Safe',
          requestedAt: 1,
          secretRoster: ['private'],
        },
      })
    ).toBeNull();
  });

  it('requires matching scene IDs, valid revision and bounded labels', () => {
    expect(
      parseTableCommand({
        ...base,
        type: 'registerScene',
        sceneId: 'scene-1',
        workspaceInstanceId: 'workspace-1',
        sourceMapId: null,
        contentRevision: 1,
        safeLabel: 'Safe',
        expectedRegistryRevision: 0,
      })
    ).not.toBeNull();
    expect(
      parseTableCommand({
        ...base,
        type: 'registerScene',
        sceneId: 'scene-1',
        workspaceInstanceId: 'workspace-1',
        sourceMapId: null,
        contentRevision: 1,
        safeLabel: 'x'.repeat(201),
        expectedRegistryRevision: 0,
      })
    ).toBeNull();
  });

  it('bounds streamed JSON before parse', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(17_000) }),
    });
    await expect(readBoundedJson(request)).rejects.toThrow('16 KiB');
  });
});
