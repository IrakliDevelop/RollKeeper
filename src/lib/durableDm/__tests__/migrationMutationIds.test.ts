import { describe, expect, it } from 'vitest';

import { migrationMutationId } from '../migrationMutationIds';

const base = {
  recoveryRunId: 'run-1',
  campaignId: '11111111-1111-4111-8111-111111111111',
  family: 'combat_log_archive',
  manifestFingerprint: 'a'.repeat(64),
  expectedEpoch: 0,
};

describe('migrationMutationId', () => {
  it('is stable for the same run, family, manifest, epoch and operation', async () => {
    const first = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
    });
    const second = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
    });
    expect(first).toBe(second);
  });

  it('is a syntactically valid UUID', async () => {
    const id = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
    });
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('differs per operation, so one receipt cannot be replayed for another call', async () => {
    const ids = await Promise.all(
      (
        ['begin-staging', 'stage-items', 'confirm-cutover', 'rollback'] as const
      ).map(operation => migrationMutationId({ ...base, operation }))
    );
    expect(new Set(ids).size).toBe(4);
  });

  it('differs per epoch, run, campaign, family and manifest', async () => {
    const reference = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
    });
    const variants = await Promise.all([
      migrationMutationId({
        ...base,
        operation: 'begin-staging',
        expectedEpoch: 1,
      }),
      migrationMutationId({
        ...base,
        operation: 'begin-staging',
        recoveryRunId: 'run-2',
      }),
      migrationMutationId({
        ...base,
        operation: 'begin-staging',
        campaignId: '22222222-2222-4222-8222-222222222222',
      }),
      migrationMutationId({
        ...base,
        operation: 'begin-staging',
        family: 'npc',
      }),
      migrationMutationId({
        ...base,
        operation: 'begin-staging',
        manifestFingerprint: 'b'.repeat(64),
      }),
    ]);
    for (const variant of variants) expect(variant).not.toBe(reference);
  });

  it('cannot be collided by moving a character across a field boundary', async () => {
    const left = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
      recoveryRunId: 'run',
      campaignId: '1' + base.campaignId,
    });
    const right = await migrationMutationId({
      ...base,
      operation: 'begin-staging',
      recoveryRunId: 'run1',
      campaignId: base.campaignId,
    });
    expect(left).not.toBe(right);
  });
});
