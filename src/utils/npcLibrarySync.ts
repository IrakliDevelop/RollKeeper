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

/** Typed write helper so callers don't need `as unknown as Record<...>` casts. */
function assignKey<K extends keyof MonsterStatBlock>(
  target: MonsterStatBlock,
  key: K,
  value: MonsterStatBlock[K]
): void {
  target[key] = value;
}

/** Merges after's changed stat-block scalars/entries onto a clone of the NPC's block. */
function buildStatBlockPatch(
  beforeBlock: MonsterStatBlock,
  afterBlock: MonsterStatBlock,
  npcBlock: MonsterStatBlock
): MonsterStatBlock {
  const result = structuredClone(npcBlock);

  // The scalar keys span several unrelated value types (numbers, strings,
  // string arrays, the save-proficiency union array), so a union-typed loop
  // variable can't drive `assignKey`'s generic inference cleanly here — an
  // explicit cast stays simplest for this one loop.
  const mutableResult = result as unknown as Record<string, unknown>;
  for (const key of STAT_BLOCK_SCALAR_KEYS) {
    const beforeValue = beforeBlock[key];
    const afterValue = afterBlock[key];
    if (key === 'saveProficiencies') {
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        mutableResult[key] = afterValue;
      }
      continue;
    }
    if (valuesDiffer(beforeValue, afterValue)) {
      mutableResult[key] = afterValue;
    }
  }

  // Only write a section when one of its entries actually changed; otherwise
  // leave the NPC's section exactly as cloned (including absent/legacy).
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

    const replacements = new Map<string, StatBlockEntry>();
    for (const afterEntry of afterEntries) {
      if (!afterEntry.id || !npcIds.has(afterEntry.id)) continue;
      const beforeEntry = beforeById.get(afterEntry.id);
      if (JSON.stringify(beforeEntry) === JSON.stringify(afterEntry)) continue;
      replacements.set(afterEntry.id, afterEntry);
    }

    if (replacements.size === 0) continue;

    const updatedEntries = npcEntries.map(entry =>
      entry.id && replacements.has(entry.id)
        ? replacements.get(entry.id)!
        : entry
    );
    assignKey(result, section, updatedEntries);
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

  if (before.monsterStatBlock && after.monsterStatBlock) {
    // Speed lives on the stat block but also mirrors onto the NPC's
    // top-level `speed` — sync it regardless of whether the NPC has a
    // monsterStatBlock at all.
    if (
      before.monsterStatBlock.speed !== after.monsterStatBlock.speed &&
      npc.speed !== after.monsterStatBlock.speed
    ) {
      patch.speed = after.monsterStatBlock.speed;
    }

    if (
      before.monsterStatBlock !== after.monsterStatBlock &&
      npc.monsterStatBlock
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
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
