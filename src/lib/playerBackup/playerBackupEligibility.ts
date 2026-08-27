import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import type { CharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';

import type {
  PlayerBackupCloudPreview,
  PlayerBackupPreviewCharacter,
} from './playerBackupCloudPreview';

export type DegradedEligibleReason = 'missing' | 'identical' | 'linked-exact';

export type DegradedContestedReason =
  | 'newer'
  | 'different'
  | 'removed'
  | 'unavailable'
  | 'future'
  | 'link-mismatch';

export interface DegradedCharacterEligibility {
  legacyId: string;
  name: string;
  eligible: boolean;
  reason: DegradedEligibleReason | DegradedContestedReason;
  row: CharacterCloudRow | null;
  recoveryAvailable: boolean;
}

export interface DegradedEligibilitySnapshot {
  accountId: string;
  characters: DegradedCharacterEligibility[];
  eligibleCharacterIds: string[];
  contestedCharacterIds: string[];
  canConfirm: boolean;
}

function classifyCharacter(
  character: PlayerBackupPreviewCharacter,
  accountId: string,
  links: CharacterCloudLinkRepository
): {
  eligible: boolean;
  reason: DegradedEligibleReason | DegradedContestedReason;
} {
  const link = links.get(accountId, character.legacyId);
  switch (character.state) {
    case 'missing':
      return link && link.serverVersion > 0
        ? { eligible: false, reason: 'link-mismatch' }
        : { eligible: true, reason: 'missing' };
    case 'identical':
      return { eligible: true, reason: 'identical' };
    case 'newer':
    case 'different': {
      const exact =
        link !== null &&
        !link.pendingMutation &&
        character.row !== null &&
        character.decoded !== null &&
        link.cloudId === character.row.id &&
        link.serverVersion === character.row.server_version &&
        link.contentFingerprint === character.decoded.contentFingerprint;
      return exact
        ? { eligible: true, reason: 'linked-exact' }
        : { eligible: false, reason: character.state };
    }
    default:
      return { eligible: false, reason: character.state };
  }
}

/** Pure read-only classification. Performs no I/O and mutates nothing. */
export function classifyDegradedEligibility(options: {
  preview: PlayerBackupCloudPreview;
  links: CharacterCloudLinkRepository;
}): DegradedEligibilitySnapshot {
  const accountId = options.preview.account.id;
  const characters = options.preview.characters.map(character => {
    const verdict = classifyCharacter(character, accountId, options.links);
    return {
      legacyId: character.legacyId,
      name: character.name,
      eligible: verdict.eligible,
      reason: verdict.reason,
      row: character.row,
      recoveryAvailable: character.row !== null,
    } satisfies DegradedCharacterEligibility;
  });
  const eligibleCharacterIds = characters
    .filter(character => character.eligible)
    .map(character => character.legacyId);
  const contestedCharacterIds = characters
    .filter(character => !character.eligible)
    .map(character => character.legacyId);
  return {
    accountId,
    characters,
    eligibleCharacterIds,
    contestedCharacterIds,
    canConfirm: eligibleCharacterIds.length > 0,
  };
}
