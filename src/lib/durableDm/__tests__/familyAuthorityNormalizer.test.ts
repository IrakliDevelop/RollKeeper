import { describe, expect, it } from 'vitest';

import type { CalendarAuthority } from '@/lib/indexeddb/calendarAuthority';
import type { CampaignSettingsAuthority } from '@/lib/indexeddb/campaignSettingsAuthority';
import type { CombatLogArchiveAuthority } from '@/lib/indexeddb/combatLogArchiveAuthority';
import type { EncounterAuthority } from '@/lib/indexeddb/encounterAuthority';
import type { MagicItemAuthority } from '@/lib/indexeddb/magicItemAuthority';
import type { NpcAuthority } from '@/lib/indexeddb/npcAuthority';

import {
  normalizeFamilyAuthority,
  toAuthorityPointerView,
  type AuthorityPointerView,
  type NormalizedAuthorityInconsistent,
  type RawAuthorityPointerRecord,
} from '../familyAuthorityNormalizer';

const scope = { accountId: 'account-1', campaignId: 'campaign-1' };

/** Narrows a result to the `inconsistent` variant so `.reason`/`.observed` are accessible. */
function asInconsistent(
  result: ReturnType<typeof normalizeFamilyAuthority>
): NormalizedAuthorityInconsistent {
  if (result.state !== 'inconsistent')
    throw new Error(`expected inconsistent, got ${result.state}`);
  return result;
}

/**
 * Builds a branded `AuthorityPointerView` the only way a caller outside this
 * module can: through `toAuthorityPointerView`. `namespace` is always
 * supplied so the record is treated as real, never as the synthesized "no
 * pointer" default; that default is covered separately, directly, in the
 * `toAuthorityPointerView` suite below.
 */
function pointerView(
  authority: 'localStorage' | 'indexedDB' | 'postgres',
  epoch: number
): AuthorityPointerView {
  const view = toAuthorityPointerView({
    authority,
    epoch,
    namespace: 'user:account-1',
    campaignId: 'campaign-1',
    family: 'npc',
    committedAt: '2026-08-24T00:00:00.000Z',
  });
  if (!view) throw new Error('expected a real pointer view, got null');
  return view;
}

describe('normalizeFamilyAuthority', () => {
  it('reports legacy when neither a marker nor a routed pointer exists', () => {
    expect(
      normalizeFamilyAuthority({ marker: null, pointer: null, ...scope })
    ).toEqual({
      state: 'legacy',
      epoch: 0,
      campaignId: null,
      accountId: null,
      rolledBack: false,
    });
  });

  it('reports legacy for the combat log dialect before its first cutover', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'localStorage',
          epoch: 0,
          campaignId: 'campaign-1',
          accountId: 'account-1',
        },
        pointer: pointerView('localStorage', 0),
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: false });
  });

  // R5's "ownership is established by the pointer, never the marker" is
  // expressed only in the branch that fires when marker is absent but the
  // pointer establishes the scope. This is the default pre-migration shape
  // for the five families with no marker dialect (they never write a marker
  // before their first cutover) and matches the plan's own Task 12 seed.
  it('reports legacy, with ownership established by the pointer, when only the pointer exists', () => {
    expect(
      normalizeFamilyAuthority({
        marker: null,
        pointer: pointerView('localStorage', 0),
        ...scope,
      })
    ).toEqual({
      state: 'legacy',
      epoch: 0,
      campaignId: 'campaign-1',
      accountId: 'account-1',
      rolledBack: false,
    });
  });

  it('reports a rollback for the legacy_restored dialect', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'legacy_restored',
          epoch: 2,
          campaignId: 'campaign-1',
        },
        pointer: pointerView('localStorage', 2),
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: true, epoch: 2 });
  });

  // `legacy_restored` names a rollback dialect unambiguously, independent of
  // epoch — unlike the combat log dialect, which only says "rolled back" by
  // returning to localStorage at a *non-zero* epoch.
  it('reports a rollback for the legacy_restored dialect even at epoch 0', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'legacy_restored',
          epoch: 0,
          campaignId: 'campaign-1',
        },
        pointer: pointerView('localStorage', 0),
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: true, epoch: 0 });
  });

  it('reports a rollback for the combat log dialect at a new epoch', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'localStorage',
          epoch: 2,
          campaignId: 'campaign-1',
          accountId: 'account-1',
        },
        pointer: pointerView('localStorage', 2),
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: true });
  });

  it('blocks a legacy_restored marker at a non-zero epoch with no pointer', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'legacy_restored',
          epoch: 2,
          campaignId: 'campaign-1',
        },
        pointer: null,
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'incomplete-rollback' });
  });

  it('blocks a localStorage pointer at a non-zero epoch with no marker', () => {
    expect(
      normalizeFamilyAuthority({
        marker: null,
        pointer: pointerView('localStorage', 2),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'incomplete-rollback' });
  });

  it('preserves the observed marker and pointer on every inconsistency', () => {
    const marker = {
      authority: 'postgres' as const,
      epoch: 1,
      campaignId: 'campaign-1',
    };
    const pointer = pointerView('indexedDB', 1);
    const result = asInconsistent(
      normalizeFamilyAuthority({ marker, pointer, ...scope })
    );
    expect(result.observed).toEqual({ marker, pointer });
  });

  it('normalizes indexedDB and postgres when marker and pointer agree, with ownership from the scope', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'indexedDB', epoch: 1, campaignId: 'campaign-1' },
        pointer: pointerView('indexedDB', 1),
        ...scope,
      })
    ).toEqual({
      state: 'indexedDB',
      epoch: 1,
      campaignId: 'campaign-1',
      accountId: 'account-1',
      rolledBack: false,
    });
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-1' },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toEqual({
      state: 'postgres',
      epoch: 1,
      campaignId: 'campaign-1',
      accountId: 'account-1',
      rolledBack: false,
    });
  });

  it('blocks, rather than choosing, when the marker and the pointer disagree', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-1' },
        pointer: pointerView('indexedDB', 1),
        ...scope,
      })
    ).toMatchObject({
      state: 'inconsistent',
      reason: 'marker-pointer-disagreement',
    });
  });

  it('blocks when a routed marker has no pointer at all', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'indexedDB', epoch: 1, campaignId: 'campaign-1' },
        pointer: null,
        ...scope,
      })
    ).toMatchObject({
      state: 'inconsistent',
      reason: 'marker-pointer-disagreement',
    });
  });

  it('blocks when the epochs disagree', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 2, campaignId: 'campaign-1' },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'epoch-disagreement' });
  });

  it('blocks when a marker that carries an account names a different one', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'postgres',
          epoch: 1,
          campaignId: 'campaign-1',
          accountId: 'account-2',
        },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'account-mismatch' });
  });

  it('blocks when the marker names a different campaign', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-9' },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'campaign-mismatch' });
  });

  // R5b's decision table is precedence-sensitive: these pin the guard order
  // (account -> campaign -> marker/pointer state -> epoch) so Task 13b does
  // not inherit an unspecified ordering when an input satisfies more than
  // one guard at once.
  it('resolves account-mismatch over campaign-mismatch when a marker names both wrong', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'postgres',
          epoch: 1,
          campaignId: 'campaign-9',
          accountId: 'account-2',
        },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'account-mismatch' });
  });

  it('resolves campaign-mismatch over epoch-disagreement when a marker names the wrong campaign at a different epoch', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 5, campaignId: 'campaign-9' },
        pointer: pointerView('postgres', 1),
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'campaign-mismatch' });
  });
});

describe('toAuthorityPointerView', () => {
  it('maps the synthesized "no pointer record" default to null', () => {
    expect(
      toAuthorityPointerView({ authority: 'localStorage', epoch: 0 })
    ).toBeNull();
  });

  it('maps the synthesized default to null even at a non-zero epoch (a cutover-epoch key that outlived its pointer)', () => {
    expect(
      toAuthorityPointerView({ authority: 'localStorage', epoch: 3 })
    ).toBeNull();
  });

  it('maps a routed indexedDB/postgres record to a pointer view', () => {
    expect(
      toAuthorityPointerView({
        authority: 'indexedDB',
        namespace: 'user:account-1',
        campaignId: 'campaign-1',
        family: 'npc',
        generation: 'gen-1',
        epoch: 1,
        committedAt: '2026-08-24T00:00:00.000Z',
      })
    ).toEqual(pointerView('indexedDB', 1));
  });

  it('maps a real rolled-back localStorage record (not the synthesized default) to a pointer view', () => {
    expect(
      toAuthorityPointerView({
        authority: 'localStorage',
        namespace: 'user:account-1',
        campaignId: 'campaign-1',
        family: 'npc',
        rollbackGeneration: 'gen-1',
        epoch: 2,
        committedAt: '2026-08-24T00:00:00.000Z',
      })
    ).toEqual(pointerView('localStorage', 2));
  });
});

/**
 * Type-level only — never called at runtime. `npm run type-check` (and
 * `npx tsc --noEmit`) fail if either function stops compiling the way its
 * name promises, which is the whole point: neither claim can be verified by
 * running the suite, only by the compiler.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Fix round 2, review finding 1: the brand on `AuthorityPointerView` must
// make it a compile error to pass a raw reader's return (non-nullable,
// structurally `{ authority, epoch, ... }`) straight through as `pointer`
// without going through `toAuthorityPointerView` first. If this function
// ever compiles without the `@ts-expect-error`, the brand has been weakened
// and the bug fix round 1 closed — a synthesized default misread as a real
// record — is reachable again.
function typeLevelProof_rawReaderCannotBypassTheBrand(raw: NpcAuthority) {
  normalizeFamilyAuthority({
    marker: null,
    // @ts-expect-error -- NpcAuthority (and its five siblings) must not be
    // assignable to the branded AuthorityPointerView; only
    // toAuthorityPointerView can produce one.
    pointer: raw,
    accountId: 'account-1',
    campaignId: 'campaign-1',
  });
}

// Fix round 2, review finding 2: bridges RawAuthorityPointerRecord to the six
// real reader authority unions so a future write path that drops a field
// toAuthorityPointerView relies on (namespace) fails to compile here, rather
// than silently misclassifying a real record as "no record" with no test
// catching it. Verified by inspection that all six unions
// (campaignSettingsAuthority.ts, calendarAuthority.ts, magicItemAuthority.ts,
// npcAuthority.ts, encounterAuthority.ts, combatLogArchiveAuthority.ts) are
// structurally identical except for the `family` literal — this bridges all
// six anyway, since doing so costs nothing and is stronger evidence than
// bridging one and asserting the rest match by inspection alone.
function typeLevelProof_realReaderUnionsBridgeToRawRecord(
  campaignSettings: CampaignSettingsAuthority,
  calendar: CalendarAuthority,
  magicItem: MagicItemAuthority,
  npc: NpcAuthority,
  encounter: EncounterAuthority,
  combatLogArchive: CombatLogArchiveAuthority
): RawAuthorityPointerRecord[] {
  return [
    campaignSettings,
    calendar,
    magicItem,
    npc,
    encounter,
    combatLogArchive,
  ];
}
/* eslint-enable @typescript-eslint/no-unused-vars */
