import { describe, expect, it } from 'vitest';

import type {
  CharacterCloudRow,
  DecodedCloudCharacter,
} from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudLink } from '@/lib/supabase/characterCloudLinks';
import { createMemoryCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';

import type {
  PlayerBackupCloudPreview,
  PlayerBackupCloudComparison,
  PlayerBackupPreviewCharacter,
} from '../playerBackupCloudPreview';
import { classifyDegradedEligibility } from '../playerBackupEligibility';

const ACCOUNT = 'account-a';

function cloudRow(
  overrides: Partial<CharacterCloudRow> = {}
): CharacterCloudRow {
  return {
    id: 'cloud-1',
    legacy_client_id: 'hero-1',
    name: 'Hero',
    payload: { id: 'hero-1', name: 'Hero', characterData: { id: 'hero-1' } },
    schema_version: 1,
    client_revision: 1,
    server_version: 3,
    deleted_at: null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

function decodedRow(
  row: CharacterCloudRow,
  contentFingerprint = 'fingerprint-cloud'
): DecodedCloudCharacter {
  return {
    status: 'supported',
    row,
    rawPayload: row.payload as DecodedCloudCharacter['rawPayload'],
    localCharacter: null,
    contentFingerprint,
    quarantineReason: null,
  };
}

function previewCharacter(options: {
  legacyId?: string;
  name?: string;
  state: PlayerBackupCloudComparison;
  row?: CharacterCloudRow | null;
  fingerprint?: string;
}): PlayerBackupPreviewCharacter {
  const legacyId = options.legacyId ?? 'hero-1';
  const row =
    options.row === undefined
      ? options.state === 'missing' || options.state === 'unavailable'
        ? null
        : cloudRow({ legacy_client_id: legacyId })
      : options.row;
  return {
    legacyId,
    name: options.name ?? 'Hero',
    state: options.state,
    row,
    decoded: row ? decodedRow(row, options.fingerprint) : null,
  };
}

function previewOf(
  characters: PlayerBackupPreviewCharacter[],
  accountId = ACCOUNT
): PlayerBackupCloudPreview {
  return { account: { id: accountId }, characters, onlineOnly: [] };
}

function link(overrides: Partial<CharacterCloudLink> = {}): CharacterCloudLink {
  return {
    accountId: ACCOUNT,
    legacyId: 'hero-1',
    cloudId: 'cloud-1',
    serverVersion: 3,
    contentFingerprint: 'fingerprint-cloud',
    ...overrides,
  };
}

interface Case {
  name: string;
  character: PlayerBackupPreviewCharacter;
  link: CharacterCloudLink | null;
  eligible: boolean;
  reason: string;
  recoveryAvailable: boolean;
}

const CASES: Case[] = [
  {
    name: 'missing without a link is eligible',
    character: previewCharacter({ state: 'missing' }),
    link: null,
    eligible: true,
    reason: 'missing',
    recoveryAvailable: false,
  },
  {
    name: 'missing with a never acknowledged link is eligible',
    character: previewCharacter({ state: 'missing' }),
    link: link({ serverVersion: 0, contentFingerprint: null }),
    eligible: true,
    reason: 'missing',
    recoveryAvailable: false,
  },
  {
    name: 'missing with an acknowledged link is contested',
    character: previewCharacter({ state: 'missing' }),
    link: link({ serverVersion: 4 }),
    eligible: false,
    reason: 'link-mismatch',
    recoveryAvailable: false,
  },
  {
    name: 'identical is eligible',
    character: previewCharacter({ state: 'identical' }),
    link: null,
    eligible: true,
    reason: 'identical',
    recoveryAvailable: true,
  },
  {
    name: 'newer with an exact link is eligible',
    character: previewCharacter({ state: 'newer' }),
    link: link(),
    eligible: true,
    reason: 'linked-exact',
    recoveryAvailable: true,
  },
  {
    name: 'newer without a link is contested',
    character: previewCharacter({ state: 'newer' }),
    link: null,
    eligible: false,
    reason: 'newer',
    recoveryAvailable: true,
  },
  {
    name: 'newer with a drifted server version is contested',
    character: previewCharacter({ state: 'newer' }),
    link: link({ serverVersion: 2 }),
    eligible: false,
    reason: 'newer',
    recoveryAvailable: true,
  },
  {
    name: 'newer with a drifted cloud id is contested',
    character: previewCharacter({ state: 'newer' }),
    link: link({ cloudId: 'cloud-other' }),
    eligible: false,
    reason: 'newer',
    recoveryAvailable: true,
  },
  {
    name: 'newer with a drifted fingerprint is contested',
    character: previewCharacter({ state: 'newer' }),
    link: link({ contentFingerprint: 'fingerprint-old' }),
    eligible: false,
    reason: 'newer',
    recoveryAvailable: true,
  },
  {
    name: 'newer with a pending mutation is contested',
    character: previewCharacter({ state: 'newer' }),
    link: link({
      pendingMutation: {
        mutationId: 'mutation-1',
        contentFingerprint: 'fingerprint-cloud',
      },
    }),
    eligible: false,
    reason: 'newer',
    recoveryAvailable: true,
  },
  {
    name: 'different with an exact link is eligible',
    character: previewCharacter({ state: 'different' }),
    link: link(),
    eligible: true,
    reason: 'linked-exact',
    recoveryAvailable: true,
  },
  {
    name: 'different without a link is contested',
    character: previewCharacter({ state: 'different' }),
    link: null,
    eligible: false,
    reason: 'different',
    recoveryAvailable: true,
  },
  {
    name: 'different with a drifted fingerprint is contested',
    character: previewCharacter({ state: 'different' }),
    link: link({ contentFingerprint: null }),
    eligible: false,
    reason: 'different',
    recoveryAvailable: true,
  },
  {
    name: 'different with a pending mutation is contested',
    character: previewCharacter({ state: 'different' }),
    link: link({
      pendingMutation: {
        mutationId: 'mutation-2',
        contentFingerprint: 'fingerprint-cloud',
      },
    }),
    eligible: false,
    reason: 'different',
    recoveryAvailable: true,
  },
  {
    name: 'removed is contested',
    character: previewCharacter({
      state: 'removed',
      row: cloudRow({ deleted_at: '2026-08-26T01:00:00.000Z' }),
    }),
    link: link(),
    eligible: false,
    reason: 'removed',
    recoveryAvailable: true,
  },
  {
    name: 'future is contested',
    character: previewCharacter({
      state: 'future',
      row: cloudRow({ schema_version: 9 }),
    }),
    link: link(),
    eligible: false,
    reason: 'future',
    recoveryAvailable: true,
  },
  {
    name: 'unavailable is contested',
    character: previewCharacter({ state: 'unavailable' }),
    link: link(),
    eligible: false,
    reason: 'unavailable',
    recoveryAvailable: false,
  },
];

describe('degraded manual backup eligibility', () => {
  it.each(CASES)('$name', testCase => {
    const links = createMemoryCharacterCloudLinkRepository();
    if (testCase.link) links.save(testCase.link);
    const snapshot = classifyDegradedEligibility({
      preview: previewOf([testCase.character]),
      links,
    });
    expect(snapshot.accountId).toBe(ACCOUNT);
    expect(snapshot.characters).toEqual([
      {
        legacyId: testCase.character.legacyId,
        name: testCase.character.name,
        eligible: testCase.eligible,
        reason: testCase.reason,
        row: testCase.character.row,
        recoveryAvailable: testCase.recoveryAvailable,
      },
    ]);
    expect(snapshot.eligibleCharacterIds).toEqual(
      testCase.eligible ? [testCase.character.legacyId] : []
    );
    expect(snapshot.contestedCharacterIds).toEqual(
      testCase.eligible ? [] : [testCase.character.legacyId]
    );
    expect(snapshot.canConfirm).toBe(testCase.eligible);
  });

  it('keeps preview order and partitions eligible from contested characters', () => {
    const links = createMemoryCharacterCloudLinkRepository();
    links.save(link({ legacyId: 'hero-c', cloudId: 'cloud-c' }));
    const snapshot = classifyDegradedEligibility({
      preview: previewOf([
        previewCharacter({ legacyId: 'hero-a', name: 'A', state: 'missing' }),
        previewCharacter({ legacyId: 'hero-b', name: 'B', state: 'different' }),
        previewCharacter({
          legacyId: 'hero-c',
          name: 'C',
          state: 'newer',
          row: cloudRow({ id: 'cloud-c', legacy_client_id: 'hero-c' }),
        }),
        previewCharacter({ legacyId: 'hero-d', name: 'D', state: 'removed' }),
      ]),
      links,
    });
    expect(snapshot.characters.map(character => character.legacyId)).toEqual([
      'hero-a',
      'hero-b',
      'hero-c',
      'hero-d',
    ]);
    expect(snapshot.eligibleCharacterIds).toEqual(['hero-a', 'hero-c']);
    expect(snapshot.contestedCharacterIds).toEqual(['hero-b', 'hero-d']);
    expect(snapshot.canConfirm).toBe(true);
  });

  it('cannot confirm when every character is contested', () => {
    const snapshot = classifyDegradedEligibility({
      preview: previewOf([
        previewCharacter({ legacyId: 'hero-a', state: 'removed' }),
        previewCharacter({ legacyId: 'hero-b', state: 'unavailable' }),
      ]),
      links: createMemoryCharacterCloudLinkRepository(),
    });
    expect(snapshot.eligibleCharacterIds).toEqual([]);
    expect(snapshot.contestedCharacterIds).toEqual(['hero-a', 'hero-b']);
    expect(snapshot.canConfirm).toBe(false);
  });

  it('ignores links that belong to another account', () => {
    const links = createMemoryCharacterCloudLinkRepository();
    links.save(link({ accountId: 'account-b' }));
    const snapshot = classifyDegradedEligibility({
      preview: previewOf([previewCharacter({ state: 'different' })]),
      links,
    });
    expect(snapshot.characters[0]).toMatchObject({
      eligible: false,
      reason: 'different',
    });

    const acknowledgedElsewhere = classifyDegradedEligibility({
      preview: previewOf([previewCharacter({ state: 'missing' })]),
      links,
    });
    expect(acknowledgedElsewhere.characters[0]).toMatchObject({
      eligible: true,
      reason: 'missing',
    });
  });
});
