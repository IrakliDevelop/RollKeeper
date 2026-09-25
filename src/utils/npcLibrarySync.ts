// Builds the CampaignNPC patch for combatant stat edits made on a
// library-linked encounter entity, so the DM's edit writes back to the NPC
// library record. Pure — no store access; see the store wiring that calls
// this from encounterStore for the "when" (npcSourceId/campaignCode lookup,
// updateNPC call).

import type {
  CampaignNPC,
  EncounterEntity,
  MonsterStatBlock,
  StatBlockEntry,
} from '@/types/encounter';
import { parseArmorClass } from '@/utils/calculations';

/** Stat-block sections whose entries are matched by id and synced individually. */
const STAT_BLOCK_ENTRY_SECTIONS = [
  'traits',
  'actions',
  'bonusActions',
  'reactions',
  'lairActions',
] as const;

/** Stat-block scalar keys synced verbatim when they differ. */
const STAT_BLOCK_SCALAR_KEYS = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
  'saves',
  'saveProficiencies',
  'skills',
  'speed',
  'resistances',
  'immunities',
  'vulnerabilities',
  'conditionImmunities',
  'senses',
  'passivePerception',
  'languages',
  'cr',
  'type',
  'size',
  'alignment',
  'hpFormula',
] as const;

/**
 * "16 (natural armor)" + 18 → "18 (natural armor)"; "" + 18 → "18";
 * number input → String.
 */
export function replaceArmorClassNumber(
  text: string | number,
  ac: number
): string {
  const source = String(text ?? '');
  const match = source.match(/-?\d+/);
  if (!match) return String(ac);
  return (
    source.slice(0, match.index) +
    String(ac) +
    source.slice((match.index ?? 0) + match[0].length)
  );
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return a !== b;
}

/** Merges after's changed stat-block scalars/entries onto a clone of the NPC's block. */
function buildStatBlockPatch(
  beforeBlock: MonsterStatBlock,
  afterBlock: MonsterStatBlock,
  npcBlock: MonsterStatBlock
): MonsterStatBlock {
  const result = structuredClone(npcBlock);

  for (const key of STAT_BLOCK_SCALAR_KEYS) {
    const beforeValue = beforeBlock[key];
    const afterValue = afterBlock[key];
    if (key === 'saveProficiencies') {
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        (result as unknown as Record<string, unknown>)[key] = afterValue;
      }
      continue;
    }
    if (valuesDiffer(beforeValue, afterValue)) {
      (result as unknown as Record<string, unknown>)[key] = afterValue;
    }
  }

  for (const section of STAT_BLOCK_ENTRY_SECTIONS) {
    const beforeEntries = beforeBlock[section] ?? [];
    const afterEntries = afterBlock[section] ?? [];
    const npcEntries = npcBlock[section] ?? [];

    const beforeById = new Map<string, StatBlockEntry>();
    for (const entry of beforeEntries) {
      if (entry.id) beforeById.set(entry.id, entry);
    }
    const npcIds = new Set<string>();
    for (const entry of npcEntries) {
      if (entry.id) npcIds.add(entry.id);
    }

    let sectionEntries = result[section] ?? [];
    for (const afterEntry of afterEntries) {
      if (!afterEntry.id) continue;
      if (!npcIds.has(afterEntry.id)) continue;
      const beforeEntry = beforeById.get(afterEntry.id);
      if (JSON.stringify(beforeEntry) === JSON.stringify(afterEntry)) continue;
      sectionEntries = sectionEntries.map(entry =>
        entry.id === afterEntry.id ? afterEntry : entry
      );
    }
    (result as unknown as Record<string, unknown>)[section] = sectionEntries;
  }

  return result;
}

/**
 * Library patch for the fields that changed between `before` and `after`
 * (same entity, one edit). Values are applied onto `npc`'s CURRENT record.
 * Returns null when nothing syncable changed or every changed value already
 * matches the NPC.
 */
export function buildNpcLibraryPatch(
  before: EncounterEntity,
  after: EncounterEntity,
  npc: CampaignNPC
): Partial<CampaignNPC> | null {
  const patch: Partial<CampaignNPC> = {};

  if (before.armorClass !== after.armorClass) {
    if (parseArmorClass(npc.armorClass) !== after.armorClass) {
      patch.armorClass = replaceArmorClassNumber(
        npc.armorClass,
        after.armorClass
      );
    }
  }

  if (before.maxHp !== after.maxHp && npc.maxHp !== after.maxHp) {
    patch.maxHp = after.maxHp;
  }

  if (
    before.initiativeModifier !== after.initiativeModifier &&
    npc.initiativeModifier !== after.initiativeModifier
  ) {
    patch.initiativeModifier = after.initiativeModifier;
  }

  if (
    before.proficiencyBonus !== after.proficiencyBonus &&
    npc.proficiencyBonus !== after.proficiencyBonus
  ) {
    patch.proficiencyBonus = after.proficiencyBonus;
  }

  if (
    before.monsterStatBlock !== after.monsterStatBlock &&
    npc.monsterStatBlock &&
    before.monsterStatBlock &&
    after.monsterStatBlock
  ) {
    const statBlockPatch = buildStatBlockPatch(
      before.monsterStatBlock,
      after.monsterStatBlock,
      npc.monsterStatBlock
    );
    if (
      JSON.stringify(statBlockPatch) !== JSON.stringify(npc.monsterStatBlock)
    ) {
      patch.monsterStatBlock = statBlockPatch;
    }

    if (
      before.monsterStatBlock.speed !== after.monsterStatBlock.speed &&
      npc.speed !== after.monsterStatBlock.speed
    ) {
      patch.speed = after.monsterStatBlock.speed;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
