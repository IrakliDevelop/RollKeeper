import { describe, expect, it, vi } from 'vitest';

import {
  runResumableCloudActivation,
  type CloudEnrollmentPreview,
  type ResumableActivationGateway,
} from '../resumableCloudActivation';

const records = [
  {
    legacyId: 'one',
    schemaVersion: 2,
    payloadFingerprint: 'a'.repeat(64),
    tombstoned: false,
  },
  {
    legacyId: 'two',
    schemaVersion: 2,
    payloadFingerprint: 'b'.repeat(64),
    tombstoned: true,
  },
];

const fakeOptions = {
  campaignId: '11111111-1111-4111-8111-111111111111',
  manifestFingerprint: 'c'.repeat(64),
  records,
};

/** The begin-staging body the adapter would send; reused so retries hash equal. */
const beginInput = {
  mutationId: 'begin-id',
  expectedEpoch: 0,
  deviceId: 'device-1',
  manifestFingerprint: 'c'.repeat(64),
  recoveryManifestHash: 'r'.repeat(64),
  recordCount: records.length,
  totalBytes: 128,
};

const base = {
  assertWorkingCopyUnchanged: async () => {},
  request: {
    deviceId: 'device-1',
    recoveryManifestHash: 'r'.repeat(64),
    recordCount: records.length,
    totalBytes: 128,
    items: records,
  },
  family: 'combat_log_archive',
  recoveryRunId: 'run-1',
  campaignId: '11111111-1111-4111-8111-111111111111',
  manifestFingerprint: 'c'.repeat(64),
  records,
  expectedEpoch: 0,
};

// A plain object spread of `{ ...vi.fn()-typed base, ...overrides }` widens
// each mocked field to a union of the Mock type and
// `ResumableActivationGateway`'s plain function type the moment `overrides`
// is typed as `Partial<ResumableActivationGateway>` — the plain-function half
// of that union has no `.mock`, so every `foo.beginStaging.mock` access below
// would fail to type-check. Typing `overrides` as `Partial<MockedGateway>`
// instead keeps every field a Mock on both sides of the spread.
function baseGatewayMocks() {
  return {
    previewEnrollment: vi.fn(
      async () => ({ authority: 'legacy' }) as CloudEnrollmentPreview
    ),
    beginStaging: vi.fn(
      async (
        _input: Parameters<ResumableActivationGateway['beginStaging']>[0]
      ) => ({
        runId: 'server-run-1',
      })
    ),
    stageItems: vi.fn(
      async (
        _input: Parameters<ResumableActivationGateway['stageItems']>[0]
      ) => ({})
    ),
    confirmCutover: vi.fn(
      async (
        _input: Parameters<ResumableActivationGateway['confirmCutover']>[0]
      ) => ({
        epoch: 1,
      })
    ),
  };
}
type MockedGateway = ReturnType<typeof baseGatewayMocks>;

function gateway(overrides: Partial<MockedGateway> = {}): MockedGateway {
  return { ...baseGatewayMocks(), ...overrides };
}

function postgresPreview(): CloudEnrollmentPreview {
  return {
    authority: 'postgres',
    epoch: 1,
    previewFingerprint: 'c'.repeat(64),
    recordCount: 2,
    documents: [
      {
        legacyId: 'one',
        serverVersion: 1,
        schemaVersion: 2,
        payloadFingerprint: 'a'.repeat(64),
        tombstoned: false,
      },
      {
        legacyId: 'two',
        serverVersion: 1,
        schemaVersion: 2,
        payloadFingerprint: 'b'.repeat(64),
        tombstoned: true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The fake server the interruption matrix runs against.
//
// It must mirror the server's receipt semantics, not just memoize by mutation
// id. `private.campaign_document_mutation_receipts` validates `operation`
// *and* `request_hash` before replaying, and raises `22023` otherwise. A fake
// that replayed on the mutation id alone would let a retry carrying a fresh
// `runId` succeed here and fail against the real RPC — on exactly the
// highest-risk path this task exists to prove.
//
// The signatures below are the REAL `request_hash` inputs, field for field,
// independently verified against the server migrations (not copied from the
// task brief or the interface doc comment — see the module's own header for
// the file/line citations and a documented correction to the brief's claim):
//
//   begin_staging   {family, campaignId, deviceId, epoch, manifest, recovery, count, bytes}
//   stage_items     {family, runId, items}
//   confirm_cutover {family, runId, manifest, epoch}
//
// `family` for `combat_log_archive` (the family this fixture exercises) is a
// SQL string literal hardcoded inside that family's own dedicated RPC
// function body — never a client-supplied argument — so it is invariant
// across every call this fake will ever see and cannot itself cause a
// mismatch. It is included below anyway so the fake is a faithful,
// independent restatement of the exact RPC this fixture stands in for,
// rather than of `campaign_settings`'s older, differently-shaped RPC (which
// has no `family` key at all).
//
// Runs move staging -> validated -> finalized. `stage_items` accepts staging
// or validated and sets validated; `confirm_cutover` requires validated and
// sets finalized. A confirm against a run that was only begun must fail.
type FakeOperation = 'begin-staging' | 'stage-items' | 'confirm-cutover';
type FakeRunState = 'staging' | 'validated' | 'finalized';

interface FakeReceipt {
  operation: FakeOperation;
  signature: string;
  result: unknown;
}

function fakeServer(options: {
  campaignId: string;
  manifestFingerprint: string;
  records: readonly {
    legacyId: string;
    schemaVersion: number;
    payloadFingerprint: string;
    tombstoned: boolean;
  }[];
}) {
  const receipts = new Map<string, FakeReceipt>();
  const runs = new Map<string, FakeRunState>();
  const runIdsSeen: string[] = [];
  let authority: 'legacy' | 'postgres' = 'legacy';
  let epoch = 0;

  // The per-family RPCs word this differently — campaign_settings raises
  // "mutation ID was already used with different input", combat_log_archive
  // raises "mutation ID reuse mismatch" — so tests match on /mutation ID/,
  // never on the whole string.
  function replay<T>(
    mutationId: string,
    operation: FakeOperation,
    signature: string,
    produce: () => T
  ): T {
    const existing = receipts.get(mutationId);
    if (existing) {
      if (existing.operation !== operation || existing.signature !== signature)
        throw new Error('mutation ID reuse mismatch');
      return existing.result as T;
    }
    const result = produce();
    receipts.set(mutationId, { operation, signature, result });
    return result;
  }

  const base: ResumableActivationGateway = {
    previewEnrollment: async () =>
      authority === 'legacy'
        ? { authority: 'legacy' }
        : {
            authority: 'postgres',
            epoch,
            previewFingerprint: 'p'.repeat(64),
            recordCount: options.records.length,
            documents: options.records.map(record => ({
              legacyId: record.legacyId,
              serverVersion: 1,
              schemaVersion: record.schemaVersion,
              payloadFingerprint: record.payloadFingerprint,
              tombstoned: record.tombstoned,
            })),
          },

    beginStaging: async input =>
      replay(
        input.mutationId,
        'begin-staging',
        JSON.stringify({
          family: 'combat_log_archive',
          campaignId: options.campaignId,
          deviceId: input.deviceId,
          epoch: input.expectedEpoch,
          manifest: input.manifestFingerprint,
          recovery: input.recoveryManifestHash,
          count: input.recordCount,
          bytes: input.totalBytes,
        }),
        () => {
          const runId = `server-run-${runs.size + 1}`;
          runs.set(runId, 'staging');
          return { runId };
        }
      ),

    stageItems: async input => {
      runIdsSeen.push(input.runId);
      return replay(
        input.mutationId,
        'stage-items',
        JSON.stringify({
          family: 'combat_log_archive',
          runId: input.runId,
          items: input.items,
        }),
        () => {
          const state = runs.get(input.runId);
          if (state !== 'staging' && state !== 'validated')
            throw new Error('staging run is unavailable');
          runs.set(input.runId, 'validated');
          return {};
        }
      );
    },

    confirmCutover: async input => {
      runIdsSeen.push(input.runId);
      return replay(
        input.mutationId,
        'confirm-cutover',
        JSON.stringify({
          family: 'combat_log_archive',
          runId: input.runId,
          manifest: input.manifestFingerprint,
          epoch: input.expectedEpoch,
        }),
        () => {
          if (runs.get(input.runId) !== 'validated')
            throw new Error('validated staging run required');
          runs.set(input.runId, 'finalized');
          authority = 'postgres';
          epoch = input.expectedEpoch + 1;
          return { epoch };
        }
      );
    },
  };

  const methodFor: Record<FakeOperation, keyof ResumableActivationGateway> = {
    'begin-staging': 'beginStaging',
    'stage-items': 'stageItems',
    'confirm-cutover': 'confirmCutover',
  };

  return {
    gateway: () => base,
    /** Rejects at `step`, having performed every earlier step for real. */
    failingAt: (step: FakeOperation): ResumableActivationGateway => ({
      ...base,
      [methodFor[step]]: async () => {
        throw new Error(`interrupted at ${step}`);
      },
    }),
    /** Commits the confirm, then throws — the lost-response case. */
    losingConfirmResponse: (): ResumableActivationGateway => ({
      ...base,
      confirmCutover: async input => {
        await base.confirmCutover(input);
        throw new Error('response lost');
      },
    }),
    stagingRunCount: () => runs.size,
    runState: (runId: string) => runs.get(runId),
    runIdsSeen: () => runIdsSeen,
  };
}

describe('runResumableCloudActivation', () => {
  it('stages and confirms when the server is still legacy', async () => {
    const cloud = gateway();

    const result = await runResumableCloudActivation({
      ...base,
      gateway: cloud,
    });

    expect(result).toMatchObject({ status: 'activated', epoch: 1 });
    expect(cloud.beginStaging).toHaveBeenCalledTimes(1);
    expect(cloud.stageItems).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'server-run-1' })
    );
    expect(cloud.confirmCutover).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'server-run-1', expectedEpoch: 0 })
    );
  });

  it('uses the same mutation ids on a repeated run, so the server replays its receipts', async () => {
    const first = gateway();
    const second = gateway();

    await runResumableCloudActivation({ ...base, gateway: first });
    await runResumableCloudActivation({ ...base, gateway: second });

    expect(second.beginStaging.mock.calls[0][0].mutationId).toBe(
      first.beginStaging.mock.calls[0][0].mutationId
    );
    expect(second.stageItems.mock.calls[0][0].mutationId).toBe(
      first.stageItems.mock.calls[0][0].mutationId
    );
    expect(second.confirmCutover.mock.calls[0][0].mutationId).toBe(
      first.confirmCutover.mock.calls[0][0].mutationId
    );
  });

  it('gives each call a distinct mutation id', async () => {
    const cloud = gateway();
    await runResumableCloudActivation({ ...base, gateway: cloud });
    const ids = new Set([
      cloud.beginStaging.mock.calls[0][0].mutationId,
      cloud.stageItems.mock.calls[0][0].mutationId,
      cloud.confirmCutover.mock.calls[0][0].mutationId,
    ]);
    expect(ids.size).toBe(3);
  });

  it('reconciles without staging again when confirm already committed', async () => {
    const cloud = gateway({
      previewEnrollment: vi.fn(async () => postgresPreview()),
    });

    const result = await runResumableCloudActivation({
      ...base,
      gateway: cloud,
    });

    expect(result).toMatchObject({
      status: 'reconciled',
      epoch: 1,
      acceptedVersions: [
        {
          legacyId: 'one',
          serverVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
        },
        {
          legacyId: 'two',
          serverVersion: 1,
          payloadFingerprint: 'b'.repeat(64),
        },
      ],
    });
    expect(cloud.beginStaging).not.toHaveBeenCalled();
    expect(cloud.stageItems).not.toHaveBeenCalled();
    expect(cloud.confirmCutover).not.toHaveBeenCalled();
  });

  // Pins the `preview.documents ?? []` fallbacks (used both inside
  // `matchesManifest` and when building `acceptedVersions` on the reconcile
  // path) for a family with zero records. `combat_log_archive` permits
  // `record_count` 0-2000, so an empty manifest is reachable in production:
  // a device with nothing to migrate still needs a well-defined outcome
  // rather than a crash on `undefined.map`. Reconciling to an empty,
  // zero-epoch-matching cloud generation is the intended behaviour here —
  // this test exists so that stays a deliberate, tested choice rather than
  // an accident of an optional-chaining fallback nobody exercised.
  it('reconciles a zero-record activation when the cloud preview reports no documents at all', async () => {
    const emptyPreview: CloudEnrollmentPreview = {
      authority: 'postgres',
      epoch: 1,
      previewFingerprint: 'c'.repeat(64),
      recordCount: 0,
      // `documents` intentionally omitted, not an empty array — models a
      // preview response that never populated the field for a zero-record
      // family, exercising the `?? []` fallback rather than an already-empty
      // array literal.
    };
    const cloud = gateway({
      previewEnrollment: vi.fn(async () => emptyPreview),
    });

    const result = await runResumableCloudActivation({
      ...base,
      gateway: cloud,
      records: [],
      request: { ...base.request, recordCount: 0, items: [] },
    });

    expect(result).toEqual({
      status: 'reconciled',
      epoch: 1,
      acceptedVersions: [],
    });
  });

  it('conflicts, and never stages, when the cloud generation has diverged', async () => {
    const diverged = postgresPreview();
    diverged.documents![1].payloadFingerprint = 'f'.repeat(64);
    const cloud = gateway({ previewEnrollment: vi.fn(async () => diverged) });

    const result = await runResumableCloudActivation({
      ...base,
      gateway: cloud,
    });

    expect(result).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
    expect(cloud.beginStaging).not.toHaveBeenCalled();
  });

  it('conflicts when the cloud holds a different document set', async () => {
    const extra = postgresPreview();
    extra.documents!.push({
      legacyId: 'three',
      serverVersion: 1,
      schemaVersion: 2,
      payloadFingerprint: 'e'.repeat(64),
      tombstoned: false,
    });
    extra.recordCount = 3;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => extra) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
  });

  // Isolates the `documents.length !== records.length` guard from the
  // `recordCount !== records.length` guard above it: `recordCount` is left
  // matching (2) while the `documents` array itself carries an extra entry,
  // so only the length-of-the-array check can catch this. Without this test
  // a preview whose declared `recordCount` matches but whose `documents`
  // array is longer would pass `records.every(...)` — which only walks the
  // device's own `records`, never the cloud's extra ones — and reconcile the
  // local pointer onto a cloud generation containing a document this device
  // never produced.
  it('conflicts when the cloud holds an extra document even though recordCount still matches', async () => {
    const extraButCountUnchanged = postgresPreview();
    extraButCountUnchanged.documents!.push({
      legacyId: 'three',
      serverVersion: 1,
      schemaVersion: 2,
      payloadFingerprint: 'e'.repeat(64),
      tombstoned: false,
    });
    // recordCount deliberately left at 2 (postgresPreview()'s default) so the
    // recordCount guard does not fire first.
    const cloud = gateway({
      previewEnrollment: vi.fn(async () => extraButCountUnchanged),
    });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
  });

  // Isolates the `recordCount !== records.length` guard (line 140) from the
  // `documents.length !== records.length` guard beneath it (line 141): the
  // `documents` array itself is left the same length as `records` (2 == 2,
  // so 141 does not fire), while the preview's declared `recordCount` is
  // wrong (5 != 2), so only the recordCount check can catch this. The prior
  // "different document set" test grows both `recordCount` and `documents`
  // together, so it cannot tell 140 and 141 apart — deleting 140 alone left
  // that test, and every other test in the file, green.
  it('conflicts when the declared recordCount disagrees even though the document array length matches', async () => {
    const wrongCount = postgresPreview();
    wrongCount.recordCount = 5;
    // `documents` deliberately left at its default two entries (matching
    // `records.length`) so the `documents.length` guard does not fire first.
    const cloud = gateway({ previewEnrollment: vi.fn(async () => wrongCount) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
  });

  it('conflicts when a tombstone flag disagrees', async () => {
    const flipped = postgresPreview();
    flipped.documents![1].tombstoned = false;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => flipped) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
  });

  it('refuses to reconcile a postgres preview that reports no epoch', async () => {
    const noEpoch = postgresPreview();
    delete noEpoch.epoch;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => noEpoch) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-epoch-unknown',
    });
  });

  it('checks the working copy before staging and again before confirming', async () => {
    const seen: string[] = [];
    const assertWorkingCopyUnchanged = vi.fn(
      async () => void seen.push('check')
    );
    const cloud = gateway({
      beginStaging: vi.fn(async () => {
        seen.push('begin');
        return { runId: 'server-run-1' };
      }),
      stageItems: vi.fn(async () => {
        seen.push('stage');
        return {};
      }),
      confirmCutover: vi.fn(async () => {
        seen.push('confirm');
        return { epoch: 1 };
      }),
    });

    await runResumableCloudActivation({
      ...base,
      gateway: cloud,
      assertWorkingCopyUnchanged,
    });

    expect(seen).toEqual(['check', 'begin', 'stage', 'check', 'confirm']);
  });

  it('refuses to confirm when the working copy changed during the upload', async () => {
    let calls = 0;
    const cloud = gateway();

    await expect(
      runResumableCloudActivation({
        ...base,
        gateway: cloud,
        assertWorkingCopyUnchanged: vi.fn(async () => {
          calls += 1;
          if (calls > 1) throw new Error('changed since the last check');
        }),
      })
    ).rejects.toThrow('changed since the last check');
    expect(cloud.confirmCutover).not.toHaveBeenCalled();
  });

  it('checks the working copy before reconciling an already-committed generation', async () => {
    const cloud = gateway({
      previewEnrollment: vi.fn(async () => postgresPreview()),
    });

    await expect(
      runResumableCloudActivation({
        ...base,
        gateway: cloud,
        assertWorkingCopyUnchanged: vi.fn(async () => {
          throw new Error('changed since the last check');
        }),
      })
    ).rejects.toThrow('changed since the last check');
  });

  it('conflicts when only the schema version differs', async () => {
    const bumped = postgresPreview();
    bumped.documents![0].schemaVersion = 3;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => bumped) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-generation-diverged',
    });
  });

  it('conflicts when the cloud sits at an epoch this run was not activating into', async () => {
    const ahead = postgresPreview();
    ahead.epoch = 4;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => ahead) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-epoch-unexpected',
    });
    expect(cloud.beginStaging).not.toHaveBeenCalled();
  });

  it('conflicts when the preview carries no usable fingerprint', async () => {
    const blank = postgresPreview();
    delete blank.previewFingerprint;
    const cloud = gateway({ previewEnrollment: vi.fn(async () => blank) });

    expect(
      await runResumableCloudActivation({ ...base, gateway: cloud })
    ).toEqual({
      status: 'conflict',
      reason: 'cloud-preview-unusable',
    });
  });

  // The interruption matrix. Each case kills the run at one point, then
  // re-runs the whole activation against a server that kept whatever had
  // committed. R7's last line names four interruption points: begin-staging,
  // stage-items, confirm-cutover, and the local marker update. The fifth case
  // below (ruling R7.5) covers the marker-update window, which is the one
  // production window that produces `inconsistent` per R5b's repair — this
  // module cannot itself write the local marker (that is the adapter's job,
  // per the Interfaces section), so the test proves the module's contract
  // for that window: a caller who committed the cutover but crashed before
  // writing the marker gets, on retry, the *same* reconcile outcome
  // (`reconciled`, not a second staging run) that it would need to safely
  // retry the marker write.
  describe('resumes correctly from an interruption at every point', () => {
    it('before begin-staging: stages once and activates', async () => {
      const server = fakeServer(fakeOptions);
      await expect(
        runResumableCloudActivation({
          ...base,
          gateway: server.failingAt('begin-staging'),
        })
      ).rejects.toThrow();
      const result = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });
      expect(result).toMatchObject({ status: 'activated', epoch: 1 });
      expect(server.stagingRunCount()).toBe(1);
    });

    it('after begin-staging, before stage-items: replays the same server run id', async () => {
      const server = fakeServer(fakeOptions);
      await expect(
        runResumableCloudActivation({
          ...base,
          gateway: server.failingAt('stage-items'),
        })
      ).rejects.toThrow();
      const result = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });
      expect(result).toMatchObject({ status: 'activated' });
      expect(server.stagingRunCount()).toBe(1);
      expect(new Set(server.runIdsSeen()).size).toBe(1);
    });

    it('after stage-items, before confirm: confirms without re-staging a new run', async () => {
      const server = fakeServer(fakeOptions);
      await expect(
        runResumableCloudActivation({
          ...base,
          gateway: server.failingAt('confirm-cutover'),
        })
      ).rejects.toThrow();
      const result = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });
      expect(result).toMatchObject({ status: 'activated', epoch: 1 });
      expect(server.stagingRunCount()).toBe(1);
    });

    it('after confirm committed but its response was lost: reconciles, never stages again', async () => {
      const server = fakeServer(fakeOptions);
      await expect(
        runResumableCloudActivation({
          ...base,
          gateway: server.losingConfirmResponse(),
        })
      ).rejects.toThrow();
      const result = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });
      expect(result).toMatchObject({ status: 'reconciled', epoch: 1 });
      expect(server.stagingRunCount()).toBe(1);
    });

    it('after confirm committed and the local marker write did not: a fresh call reconciles again, never re-stages', async () => {
      // Models the fifth interruption window ruling R7.5 requires: the
      // *previous process* already ran confirm-cutover to completion (the
      // adapter would normally now write its localStorage marker, but the
      // tab closed before that happened). This module owns only the server
      // half of activation, so from its point of view that crash is
      // observationally identical to "confirm committed, walk away, and get
      // called again with no local state at all" — proven here by driving
      // the server to a genuinely finalized run first, then invoking
      // runResumableCloudActivation completely fresh (no failing gateway in
      // the mix) exactly as the adapter would on the very next call it makes
      // before it attempts the marker write. A second staging run, or a
      // status other than `reconciled`, would strand the marker-write retry
      // in a state R5b's repair has to clean up instead of a state it can
      // sail through.
      const server = fakeServer(fakeOptions);
      const committed = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });
      expect(committed).toMatchObject({ status: 'activated', epoch: 1 });
      expect(server.stagingRunCount()).toBe(1);

      // The adapter's marker write is presumed to have crashed here, before
      // it ever runs. The next thing that happens on reload is this module
      // being invoked again with the identical inputs.
      const result = await runResumableCloudActivation({
        ...base,
        gateway: server.gateway(),
      });

      expect(result).toMatchObject({
        status: 'reconciled',
        epoch: 1,
        acceptedVersions: [
          {
            legacyId: 'one',
            serverVersion: 1,
            payloadFingerprint: 'a'.repeat(64),
          },
          {
            legacyId: 'two',
            serverVersion: 1,
            payloadFingerprint: 'b'.repeat(64),
          },
        ],
      });
      expect(server.stagingRunCount()).toBe(1);
    });
  });

  it('propagates a staging failure without confirming', async () => {
    const cloud = gateway({
      stageItems: vi.fn(async () => {
        throw new Error('cloud unavailable');
      }),
    });

    await expect(
      runResumableCloudActivation({ ...base, gateway: cloud })
    ).rejects.toThrow('cloud unavailable');
    expect(cloud.confirmCutover).not.toHaveBeenCalled();
  });

  // Four tests for the fake itself, so it cannot silently stop enforcing what
  // it exists to enforce.

  it('the fake rejects a replay that reuses a mutation id for another operation', async () => {
    const server = fakeServer(fakeOptions);
    const cloud = server.gateway();
    await cloud.beginStaging({ ...beginInput, mutationId: 'shared-id' });
    await expect(
      cloud.stageItems({
        mutationId: 'shared-id',
        runId: 'server-run-1',
        items: [],
      })
    ).rejects.toThrow(/mutation ID/);
  });

  it('the fake rejects a replay whose request body changed', async () => {
    const server = fakeServer(fakeOptions);
    const cloud = server.gateway();
    await cloud.beginStaging({ ...beginInput, mutationId: 'begin-id' });
    // A regenerated device id is the realistic way this happens.
    await expect(
      cloud.beginStaging({
        ...beginInput,
        mutationId: 'begin-id',
        deviceId: 'other-device',
      })
    ).rejects.toThrow(/mutation ID/);
  });

  it('the fake rejects a replay that reuses a mutation id with a different run id', async () => {
    const server = fakeServer(fakeOptions);
    const cloud = server.gateway();
    await cloud.beginStaging({ ...beginInput, mutationId: 'begin-id' });
    await cloud.stageItems({
      mutationId: 'stage-id',
      runId: 'server-run-1',
      items: [],
    });
    await expect(
      cloud.stageItems({
        mutationId: 'stage-id',
        runId: 'server-run-2',
        items: [],
      })
    ).rejects.toThrow(/mutation ID/);
  });

  it('the fake refuses to confirm a run that never reached validated', async () => {
    const server = fakeServer(fakeOptions);
    const cloud = server.gateway();
    const { runId } = await cloud.beginStaging({
      ...beginInput,
      mutationId: 'begin-id',
    });
    expect(server.runState(runId)).toBe('staging');
    await expect(
      cloud.confirmCutover({
        mutationId: 'confirm-id',
        runId,
        manifestFingerprint: base.manifestFingerprint,
        expectedEpoch: 0,
      })
    ).rejects.toThrow('validated staging run required');
  });
});
