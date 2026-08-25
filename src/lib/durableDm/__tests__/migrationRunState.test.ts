import { describe, expect, it } from 'vitest';

import { deriveFamilyStepState } from '../migrationRunState';

const runRecovery = { runId: 'run-1', manifestHash: 'a'.repeat(64) };
const registered = {
  status: 'registered' as const,
  family: 'npc' as const,
  label: 'NPCs',
  adapter: {} as never,
};
const planned = {
  status: 'planned' as const,
  family: 'location' as const,
  label: 'Locations',
};
const legacy = {
  state: 'legacy' as const,
  epoch: 0,
  campaignId: null,
  accountId: null,
  rolledBack: false,
};

const base = {
  entry: registered,
  enabled: true,
  authority: legacy,
  selection: null,
  runRecovery,
  preparedState: null,
  blockers: [],
  verification: null,
};

describe('deriveFamilyStepState', () => {
  it('reports a planned family as not available', () => {
    expect(deriveFamilyStepState({ ...base, entry: planned })).toBe(
      'notAvailable'
    );
  });

  it('reports legacy before anything has happened', () => {
    expect(deriveFamilyStepState(base)).toBe('legacy');
  });

  it('reports a registered family whose own flag is off as not available', () => {
    expect(deriveFamilyStepState({ ...base, enabled: false })).toBe(
      'notAvailable'
    );
  });

  it('ignores a selection left behind by an earlier run', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        selection: { runId: 'run-0', manifestHash: 'b'.repeat(64) },
      })
    ).toBe('legacy');
  });

  // The two tests below isolate `runId` and `manifestHash` individually:
  // the test above differs in both fields at once, so it cannot by itself
  // prove either comparison is load-bearing on its own.

  it('ignores a selection whose runId differs even when the manifestHash matches', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        selection: { runId: 'run-0', manifestHash: runRecovery.manifestHash },
      })
    ).toBe('legacy');
  });

  it('ignores a selection whose manifestHash differs even when the runId matches', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        selection: { runId: runRecovery.runId, manifestHash: 'b'.repeat(64) },
      })
    ).toBe('legacy');
  });

  it('reports selected only when the selection matches this run exactly', () => {
    expect(deriveFamilyStepState({ ...base, selection: runRecovery })).toBe(
      'selected'
    );
  });

  it('reports prepared from the persisted migration state, not from wizard memory', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        selection: runRecovery,
        preparedState: 'CUTOVER_READY',
      })
    ).toBe('prepared');
  });

  it('reports blocked whenever the manifest carries a blocker', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        selection: runRecovery,
        blockers: [{ kind: 'active-encounter' }],
      })
    ).toBe('blocked');
  });

  it('reports indexedDb and postgresUnverified from the normalized authority', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, state: 'indexedDB', epoch: 1 },
      })
    ).toBe('indexedDb');
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, state: 'postgres', epoch: 1 },
      })
    ).toBe('postgresUnverified');
  });

  it('reports verified only with a live passing verification', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, state: 'postgres', epoch: 1 },
        verification: { verified: true } as never,
      })
    ).toBe('verified');
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, state: 'postgres', epoch: 1 },
        verification: { verified: false } as never,
      })
    ).toBe('postgresUnverified');
  });

  it('reports a rollback and an inconsistency distinctly', () => {
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, epoch: 2, rolledBack: true },
      })
    ).toBe('rolledBack');
    expect(
      deriveFamilyStepState({
        ...base,
        authority: {
          ...legacy,
          state: 'inconsistent',
          reason: 'epoch-disagreement',
          observed: { marker: null, pointer: null },
        },
      })
    ).toBe('inconsistent');
  });

  // Precedence pins (unpinned in the spec; Task 13b inherits this ordering).
  // Each of these constructs an input that satisfies two rules at once so the
  // winner is asserted, not assumed.

  it('precedence: blocked beats a routed postgres authority, even verified', () => {
    // Satisfies both "blocked" (a manifest blocker present) and the routed
    // "verified" rule (postgres authority + a passing live verification).
    // Per the pinned order, blocked (step 3) runs before the routed-authority
    // check (step 4), so blocked wins.
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, state: 'postgres', epoch: 1 },
        verification: { verified: true } as never,
        blockers: [{ kind: 'active-encounter' }],
      })
    ).toBe('blocked');
  });

  it('precedence: inconsistent beats blocked', () => {
    // Satisfies both "inconsistent" (the normalizer blocked) and "blocked"
    // (a manifest blocker present too). Per the pinned order, inconsistent
    // (step 2) runs before blocked (step 3), so inconsistent wins.
    expect(
      deriveFamilyStepState({
        ...base,
        authority: {
          ...legacy,
          state: 'inconsistent',
          reason: 'epoch-disagreement',
          observed: { marker: null, pointer: null },
        },
        blockers: [{ kind: 'active-encounter' }],
      })
    ).toBe('inconsistent');
  });

  it('precedence: rolledBack beats a matching selection', () => {
    // Satisfies both "rolledBack" (legacy authority with rolledBack) and
    // "selected" (the selection matches this run). Per the pinned order,
    // rolledBack (step 5) runs before selected (step 7), so rolledBack wins.
    expect(
      deriveFamilyStepState({
        ...base,
        authority: { ...legacy, epoch: 2, rolledBack: true },
        selection: runRecovery,
      })
    ).toBe('rolledBack');
  });
});
