import { describe, expect, it } from 'vitest';

import { normalizeFamilyAuthority } from '../familyAuthorityNormalizer';

const scope = { accountId: 'account-1', campaignId: 'campaign-1' };

describe('normalizeFamilyAuthority', () => {
  it('reports legacy when neither a marker nor a routed pointer exists', () => {
    expect(
      normalizeFamilyAuthority({ marker: null, pointer: null, ...scope })
    ).toMatchObject({ state: 'legacy', rolledBack: false });
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
        pointer: { authority: 'localStorage', epoch: 0 },
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: false });
  });

  it('reports a rollback for the legacy_restored dialect', () => {
    expect(
      normalizeFamilyAuthority({
        marker: {
          authority: 'legacy_restored',
          epoch: 2,
          campaignId: 'campaign-1',
        },
        pointer: { authority: 'localStorage', epoch: 2 },
        ...scope,
      })
    ).toMatchObject({ state: 'legacy', rolledBack: true, epoch: 2 });
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
        pointer: { authority: 'localStorage', epoch: 2 },
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
        pointer: { authority: 'localStorage', epoch: 2 },
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
    const pointer = { authority: 'indexedDB' as const, epoch: 1 };
    expect(
      normalizeFamilyAuthority({ marker, pointer, ...scope }).observed
    ).toEqual({ marker, pointer });
  });

  it('normalizes indexedDB and postgres when marker and pointer agree', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'indexedDB', epoch: 1, campaignId: 'campaign-1' },
        pointer: { authority: 'indexedDB', epoch: 1 },
        ...scope,
      })
    ).toMatchObject({ state: 'indexedDB', epoch: 1 });
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-1' },
        pointer: { authority: 'postgres', epoch: 1 },
        ...scope,
      })
    ).toMatchObject({ state: 'postgres', epoch: 1 });
  });

  it('blocks, rather than choosing, when the marker and the pointer disagree', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-1' },
        pointer: { authority: 'indexedDB', epoch: 1 },
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
    ).toMatchObject({ state: 'inconsistent' });
  });

  it('blocks when the epochs disagree', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 2, campaignId: 'campaign-1' },
        pointer: { authority: 'postgres', epoch: 1 },
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
        pointer: { authority: 'postgres', epoch: 1 },
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'account-mismatch' });
  });

  it('blocks when the marker names a different campaign', () => {
    expect(
      normalizeFamilyAuthority({
        marker: { authority: 'postgres', epoch: 1, campaignId: 'campaign-9' },
        pointer: { authority: 'postgres', epoch: 1 },
        ...scope,
      })
    ).toMatchObject({ state: 'inconsistent', reason: 'campaign-mismatch' });
  });
});
