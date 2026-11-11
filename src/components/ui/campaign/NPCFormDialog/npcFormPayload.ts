import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';
import {
  finalizeResourceDrafts,
  isResourceCostValid,
  isResourceDraftValid,
  sanitizeEntryResourceCosts,
  stripDanglingResourceCosts,
} from '@/utils/npcResources';
import { deriveAutoFields } from './npcFormDraft';
import type { NpcFormDraft } from './npcFormDraft';

export type NpcFormPayload = Omit<
  CampaignNPC,
  'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
>;

/** Builds the record the form saves. The caller checks `canSubmitDraft` first. */
export function buildNpcPayload(
  draft: NpcFormDraft,
  editingNpc?: CampaignNPC | null
): NpcFormPayload {
  const derived = deriveAutoFields(draft);
  const finalResources =
    draft.resources.length > 0
      ? finalizeResourceDrafts(draft.resources)
      : undefined;
  const validResourceIds = new Set((finalResources ?? []).map(r => r.id));
  const cleanEntries = (entries: NpcFormDraft['traits']) =>
    stripDanglingResourceCosts(
      sanitizeEntryResourceCosts(entries.filter(e => e.name.trim())),
      validResourceIds
    );

  const monsterStatBlock: MonsterStatBlock = {
    str: draft.str,
    dex: draft.dex,
    con: draft.con,
    int: draft.int,
    wis: draft.wis,
    cha: draft.cha,
    saves: draft.saves || '',
    skills: draft.skills || '',
    speed: draft.speed || '30 ft.',
    resistances: draft.resistances || '',
    immunities: draft.immunities || '',
    vulnerabilities: draft.vulnerabilities || '',
    conditionImmunities: draft.conditionImmunities
      ? draft.conditionImmunities
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [],
    senses: draft.senses || '',
    passivePerception: derived.passivePerception,
    traits: cleanEntries(draft.traits),
    actions: cleanEntries(draft.actions),
    bonusActions: cleanEntries(draft.bonusActions),
    reactions: cleanEntries(draft.reactions),
    lairActions: cleanEntries(draft.lairActions),
    cr: draft.cr || '0',
    type: draft.creatureType,
    size: draft.size,
    languages: draft.languages || '',
    alignment: draft.alignment,
    hpFormula: draft.hpFormula || '',
    ...(draft.inflictableConditions.length > 0
      ? { inflictableConditions: draft.inflictableConditions }
      : {}),
  };

  return {
    name: draft.name.trim(),
    armorClass: draft.ac.trim() || '10',
    maxHp: draft.hp,
    tempHp: draft.tempHp > 0 ? draft.tempHp : undefined,
    tempAc: draft.tempAc.trim() || undefined,
    speed: draft.speed.trim() || '30 ft.',
    description: draft.description.trim() || undefined,
    xp: draft.xp > 0 ? draft.xp : undefined,
    monsterStatBlock,
    bestiarySourceId: draft.bestiarySourceId ?? undefined,
    loreHtml: draft.loreHtml.trim() || undefined,
    avatarUrl: draft.avatarUrl || undefined,
    group: draft.group.trim() || undefined,
    tags: draft.tags.length > 0 ? draft.tags : undefined,
    hitDice:
      draft.hitDiceMax > 0
        ? {
            max: draft.hitDiceMax,
            current: draft.hitDieCurrent,
            dieType: draft.hitDieType,
          }
        : undefined,
    initiativeModifier: derived.initiativeModifier,
    proficiencyBonus: derived.proficiencyBonus,
    passivePerception: derived.passivePerception,
    passiveInsight: derived.passiveInsight,
    passiveInvestigation: derived.passiveInvestigation,
    inventory:
      draft.inventoryItems.length > 0
        ? draft.inventoryItems.filter(item => item.name.trim())
        : undefined,
    resources: finalResources,
    spellcasting: draft.spellcastingEnabled
      ? {
          casterLevel: draft.casterLevel,
          ability: draft.spellcastingAbility,
          spellAttackBonus: draft.spellAttackOverride,
          spellSaveDC: draft.spellDCOverride,
          slotOverrides:
            Object.keys(draft.spellSlotOverrides).length > 0
              ? Object.fromEntries(
                  Object.entries(draft.spellSlotOverrides)
                    .filter(
                      (entry): entry is [string, number] =>
                        entry[1] !== undefined
                    )
                    .map(([k, v]) => [Number(k), v])
                )
              : undefined,
          slotsUsed: editingNpc?.spellcasting?.slotsUsed ?? {},
          spells: draft.spells,
        }
      : undefined,
  };
}

export function canSubmitDraft(draft: NpcFormDraft): boolean {
  return (
    draft.name.trim().length > 0 &&
    draft.resources.every(isResourceDraftValid) &&
    [
      draft.traits,
      draft.actions,
      draft.bonusActions,
      draft.reactions,
      draft.lairActions,
    ].every(list => list.every(isResourceCostValid))
  );
}
