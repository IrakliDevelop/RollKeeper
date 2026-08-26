import { parseRechargeFromName } from '@/utils/encounterConverter';
import type {
  MonsterAbility,
  MonsterStatBlock,
  StatBlockEntry,
} from '@/types/encounter';

export const ALL_ENTRY_SECTIONS = [
  'traits',
  'actions',
  'bonusActions',
  'reactions',
  'lairActions',
] as const;

export type EntrySection = (typeof ALL_ENTRY_SECTIONS)[number];

export interface EntryAbilityConfig {
  maxUses: number;
  usageType: 'recharge' | 'per-rest' | 'per-day';
  rechargeOn?: number;
  restType?: 'short' | 'long' | 'dawn';
}

function generateEntryId(): string {
  return (
    'entry-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
  );
}

/**
 * Clone-based id normalization: every entry across all five sections ends up
 * with a unique id. Existing unique ids are preserved (idempotent); missing
 * ids are filled; duplicate ids keep the first occurrence and re-key later
 * ones. Never mutates the input. Store boundary and entity builders call
 * this — render code never generates ids.
 */
export function ensureStatBlockEntryIds(
  statBlock: MonsterStatBlock
): MonsterStatBlock {
  // Pre-collect every existing id as reserved so a generated id can never
  // collide with a not-yet-visited existing id (which would force an
  // unnecessary re-key of that later, legitimately unique entry).
  const reserved = new Set<string>();
  for (const section of ALL_ENTRY_SECTIONS) {
    for (const entry of statBlock[section] ?? []) {
      if (entry.id) reserved.add(entry.id);
    }
  }
  const seen = new Set<string>();
  const out: MonsterStatBlock = { ...statBlock };
  for (const section of ALL_ENTRY_SECTIONS) {
    out[section] = (statBlock[section] ?? []).map(entry => {
      let id = entry.id;
      if (!id || seen.has(id)) {
        do {
          id = generateEntryId();
        } while (reserved.has(id) || seen.has(id));
      }
      seen.add(id);
      return id === entry.id ? entry : { ...entry, id };
    });
  }
  return out;
}

/**
 * The single source of truth for ability trackability:
 * - `uses > 0` wins → that maximum (usageType/recharge/rest still from the name).
 * - Parsed per-day → parsed maximum.
 * - Recharge / per-rest → maximum 1.
 * - Otherwise null (untrackable; may still carry resourceCost).
 */
export function getEntryAbilityConfig(
  entry: StatBlockEntry
): EntryAbilityConfig | null {
  const parsed = parseRechargeFromName(entry.name);
  if (entry.uses !== undefined && entry.uses > 0) {
    return {
      maxUses: entry.uses,
      usageType:
        parsed.usageType !== 'unlimited' ? parsed.usageType : 'per-day',
      rechargeOn: parsed.rechargeOn,
      restType: parsed.restType,
    };
  }
  if (parsed.usageType === 'per-day') {
    return {
      maxUses: parsed.maxUses ?? 1,
      usageType: 'per-day',
      rechargeOn: undefined,
      restType: parsed.restType,
    };
  }
  if (parsed.usageType === 'recharge' || parsed.usageType === 'per-rest') {
    return {
      maxUses: 1,
      usageType: parsed.usageType,
      rechargeOn: parsed.rechargeOn,
      restType: parsed.restType,
    };
  }
  return null;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(0, value), max);
}

/**
 * Build live counters from an id-normalized stat block (all five sections).
 * `usage` seeds usedUses by entry id (clamped). `source` stamps provenance:
 * 'npc' for NPC-backed builds, 'entity' (default) for monsters/custom.
 * Requires ids — call ensureStatBlockEntryIds first.
 */
export function buildAbilitiesFromNormalizedBlock(
  statBlock: MonsterStatBlock,
  usage?: Record<string, number>,
  source: 'npc' | 'entity' = 'entity'
): MonsterAbility[] {
  const abilities: MonsterAbility[] = [];
  for (const section of ALL_ENTRY_SECTIONS) {
    for (const entry of statBlock[section] ?? []) {
      if (!entry.id) continue; // malformed input renders untrackable, never tracked
      const config = getEntryAbilityConfig(entry);
      if (!config) continue;
      abilities.push({
        id: entry.id,
        name: parseRechargeFromName(entry.name).cleanName,
        description: entry.text,
        usageType: config.usageType,
        rechargeOn: config.rechargeOn,
        maxUses: config.maxUses,
        usedUses: clamp(usage?.[entry.id] ?? 0, config.maxUses),
        restType: config.restType,
        source,
      });
    }
  }
  return abilities;
}

/**
 * Rebuild an entity's abilities after its stat block changed (in-combat
 * entry edits). Preserves usedUses by entry id, clamps on reduced maxima,
 * adds newly-trackable entries at 0, drops deleted/untrackable ones.
 *
 * Provenance rules:
 * - An existing ability keeps its source; new abilities get 'npc' when the
 *   resolver returns their entry, else 'entity' (combat-added).
 * - A source 'npc' ability whose id the resolver no longer returns was
 *   DELETED on the NPC → dropped here (never silently demoted to
 *   entity-local, which would let a deleted NPC ability survive).
 * - For source 'npc' abilities, the resolver's entry is the config source
 *   (NPC config wins over entity-edited uses); 'entity' abilities use the
 *   entity's own entry.
 */
export function reconcileEntityAbilities(
  normalizedBlock: MonsterStatBlock,
  prevAbilities: MonsterAbility[],
  resolveAuthoritativeEntry?: (entryId: string) => StatBlockEntry | undefined
): MonsterAbility[] {
  const prevById = new Map(prevAbilities.map(a => [a.id, a]));
  const abilities: MonsterAbility[] = [];
  for (const section of ALL_ENTRY_SECTIONS) {
    for (const entry of normalizedBlock[section] ?? []) {
      if (!entry.id) continue;
      const prev = prevById.get(entry.id);
      const authoritative = resolveAuthoritativeEntry?.(entry.id);
      const source: 'npc' | 'entity' =
        prev?.source ?? (authoritative ? 'npc' : 'entity');
      if (source === 'npc' && resolveAuthoritativeEntry && !authoritative) {
        continue; // deleted on the NPC — drop, don't demote
      }
      const configSource =
        source === 'npc' && authoritative ? authoritative : entry;
      const config = getEntryAbilityConfig(configSource);
      if (!config) continue;
      abilities.push({
        id: entry.id,
        name: parseRechargeFromName(configSource.name).cleanName,
        description: entry.text,
        usageType: config.usageType,
        rechargeOn: config.rechargeOn,
        maxUses: config.maxUses,
        usedUses: clamp(prev?.usedUses ?? 0, config.maxUses),
        restType: config.restType,
        source,
      });
    }
  }
  return abilities;
}

/** Locate an entry by id across all five sections. */
export function findEntryById(
  statBlock: MonsterStatBlock | undefined,
  entryId: string
): StatBlockEntry | undefined {
  if (!statBlock) return undefined;
  for (const section of ALL_ENTRY_SECTIONS) {
    const hit = (statBlock[section] ?? []).find(e => e.id === entryId);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Usage label derived from the AUTHORITATIVE ability config — used for rows
 * with a live view-model so an entity-edited name like "Teleport (9/Day)"
 * can never display a number that contradicts the authoritative pips.
 */
export function formatAbilityUsageLabel(
  ability: Pick<
    MonsterAbility,
    'usageType' | 'maxUses' | 'rechargeOn' | 'restType'
  >
): string {
  switch (ability.usageType) {
    case 'recharge':
      return `Recharge ${ability.rechargeOn ?? 5}-6`;
    case 'per-rest':
      return ability.restType === 'short'
        ? 'Recharges after a Short or Long Rest'
        : 'Recharges after a Long Rest';
    default:
      return `${ability.maxUses ?? 1}/Day`;
  }
}
