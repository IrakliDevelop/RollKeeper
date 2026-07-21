import {
  abilityModifier,
  buildMonsterStatBlock,
  proficiencyBonusForCr,
} from '@/utils/encounterConverter';
import type { ProcessedMonster } from '@/types/bestiary';
import type { MonsterStatBlock } from '@/types/encounter';

/**
 * Draft state for the pre-add stat block editor. Initiative and proficiency
 * bonus live on the entity (not the stat block); they auto-follow dex/CR
 * edits until the DM types a manual value (dirty flag).
 */
export interface MonsterEditDraft {
  statBlock: MonsterStatBlock;
  initiativeModifier: number;
  initiativeDirty: boolean;
  proficiencyBonus: number;
  proficiencyDirty: boolean;
}

export function createMonsterEditDraft(
  monster: ProcessedMonster
): MonsterEditDraft {
  const statBlock = buildMonsterStatBlock(monster);
  return {
    statBlock,
    initiativeModifier: abilityModifier(statBlock.dex),
    initiativeDirty: false,
    proficiencyBonus: proficiencyBonusForCr(statBlock.cr),
    proficiencyDirty: false,
  };
}

export function updateDraftStatBlock(
  draft: MonsterEditDraft,
  patch: Partial<MonsterStatBlock>
): MonsterEditDraft {
  const statBlock = { ...draft.statBlock, ...patch };
  return {
    ...draft,
    statBlock,
    initiativeModifier:
      !draft.initiativeDirty && patch.dex !== undefined
        ? abilityModifier(statBlock.dex)
        : draft.initiativeModifier,
    proficiencyBonus:
      !draft.proficiencyDirty && patch.cr !== undefined
        ? proficiencyBonusForCr(statBlock.cr)
        : draft.proficiencyBonus,
  };
}

export function setDraftInitiative(
  draft: MonsterEditDraft,
  value: number
): MonsterEditDraft {
  return { ...draft, initiativeModifier: value, initiativeDirty: true };
}

export function setDraftProficiency(
  draft: MonsterEditDraft,
  value: number
): MonsterEditDraft {
  return { ...draft, proficiencyBonus: value, proficiencyDirty: true };
}
