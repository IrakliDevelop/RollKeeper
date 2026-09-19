import {
  DEFAULT_CONDITION_ICON_BY_KIND,
  isConditionIconName,
} from '@/utils/conditionIconRegistry';

import type {
  CombatConfig,
  CustomCondition,
  EncounterCondition,
  EncounterEntity,
  MonsterStatBlock,
} from '@/types/encounter';

/** Stable selector fallback — never `?? []` inside a Zustand selector. */
export const EMPTY_CUSTOM_CONDITIONS: CustomCondition[] = [];

export const CUSTOM_CONDITION_NAME_MAX = 60;
export const CUSTOM_CONDITION_DESCRIPTION_MAX = 1000;

export type CustomConditionDraft = Omit<CustomCondition, 'id'>;

/** A persisted config from before the library existed may still carry names. */
export type LegacyCombatConfig = CombatConfig & { customStatuses?: unknown };

const KINDS: ReadonlySet<string> = new Set(['buff', 'debuff', 'neutral']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function generateCustomConditionId(): string {
  return (
    'cc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function createCustomCondition(
  name: string,
  overrides: Partial<Omit<CustomCondition, 'id' | 'name'>> = {}
): CustomCondition {
  const kind = overrides.kind ?? 'debuff';
  return {
    id: generateCustomConditionId(),
    name: name.trim(),
    description: overrides.description ?? '',
    icon: overrides.icon ?? DEFAULT_CONDITION_ICON_BY_KIND[kind],
    kind,
  };
}

/** Repairs one persisted/synced entry; null when it has no usable identity. */
export function sanitizeCustomCondition(
  value: unknown
): CustomCondition | null {
  if (!isRecord(value)) return null;
  const { id, name, description, icon, kind } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  const safeKind =
    typeof kind === 'string' && KINDS.has(kind)
      ? (kind as CustomCondition['kind'])
      : 'debuff';
  return {
    id,
    name: name.trim().slice(0, CUSTOM_CONDITION_NAME_MAX),
    description:
      typeof description === 'string'
        ? description.slice(0, CUSTOM_CONDITION_DESCRIPTION_MAX)
        : '',
    icon: isConditionIconName(icon)
      ? icon
      : DEFAULT_CONDITION_ICON_BY_KIND[safeKind],
    kind: safeKind,
  };
}

function legacySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'status' : slug;
}

function isCleanLibrary(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    const clean = sanitizeCustomCondition(entry);
    if (!clean || !isRecord(entry) || ids.has(clean.id)) return false;
    ids.add(clean.id);
    if (
      entry.name !== clean.name ||
      entry.description !== clean.description ||
      entry.icon !== clean.icon ||
      entry.kind !== clean.kind
    )
      return false;
  }
  return true;
}

/**
 * Migration: legacy `customStatuses: string[]` → `customConditions`. Runs in
 * the persist `merge` on every rehydrate until the next write drops the old
 * key, so legacy ids are DETERMINISTIC (derived from the name) — a creature
 * that copied a migrated entry keeps matching it after a reload.
 *
 * Returns the SAME object when there is nothing to migrate or repair. That is
 * load-bearing: `awareStorageFixpoint.test.ts` requires hydrate → write-through
 * to leave the stored bytes untouched, so this must never add a key (not even
 * `customConditions: []`) to a config that does not need it. Absent field →
 * readers fall back to EMPTY_CUSTOM_CONDITIONS.
 */
export function normalizeCombatConfig(
  config: LegacyCombatConfig
): CombatConfig {
  if (
    !('customStatuses' in config) &&
    (config.customConditions === undefined ||
      isCleanLibrary(config.customConditions))
  )
    return config;

  const { customStatuses, ...rest } = config;
  const conditions: CustomCondition[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();

  const existing = Array.isArray(rest.customConditions)
    ? rest.customConditions
    : [];
  for (const entry of existing) {
    const clean = sanitizeCustomCondition(entry);
    if (!clean || ids.has(clean.id)) continue;
    ids.add(clean.id);
    names.add(clean.name.toLowerCase());
    conditions.push(clean);
  }

  const legacy = Array.isArray(customStatuses) ? customStatuses : [];
  for (const raw of legacy) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim().slice(0, CUSTOM_CONDITION_NAME_MAX);
    if (name === '' || names.has(name.toLowerCase())) continue;
    const base = `legacy-${legacySlug(name)}`;
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    names.add(name.toLowerCase());
    conditions.push({
      id,
      name,
      description: '',
      icon: DEFAULT_CONDITION_ICON_BY_KIND.debuff,
      kind: 'debuff',
    });
  }

  return { ...rest, customConditions: conditions };
}

/**
 * The ONE resolution rule for creature-attached conditions: a copy whose id
 * exists in the local library resolves to the library entry (so editing the
 * library updates every creature on this device); otherwise the copy itself
 * is used (so creatures still work on a device without the library).
 */
export function resolveInflictableConditions(
  statBlock: Pick<MonsterStatBlock, 'inflictableConditions'> | undefined,
  library: CustomCondition[]
): CustomCondition[] {
  const byId = new Map(library.map(entry => [entry.id, entry]));
  const seen = new Set<string>();
  const out: CustomCondition[] = [];
  for (const raw of statBlock?.inflictableConditions ?? []) {
    const copy = sanitizeCustomCondition(raw);
    if (!copy || seen.has(copy.id)) continue;
    seen.add(copy.id);
    out.push(byId.get(copy.id) ?? copy);
  }
  return out;
}

export interface CreatureCondition {
  condition: CustomCondition;
  /** Name of the first combatant that can inflict it (becomes sourceEntity). */
  sourceName: string;
}

/** Every condition any combatant can inflict, deduped by id. */
export function collectInflictableConditions(
  entities: EncounterEntity[],
  library: CustomCondition[]
): CreatureCondition[] {
  const seen = new Set<string>();
  const out: CreatureCondition[] = [];
  for (const entity of entities) {
    for (const condition of resolveInflictableConditions(
      entity.monsterStatBlock,
      library
    )) {
      if (seen.has(condition.id)) continue;
      seen.add(condition.id);
      out.push({ condition, sourceName: entity.name });
    }
  }
  return out;
}

/** The payload handed to EntityActions.onAddCondition for a custom condition. */
export function toAppliedCondition(
  condition: CustomCondition,
  sourceEntity?: string
): Omit<EncounterCondition, 'id'> {
  const description = condition.description.trim();
  return {
    name: condition.name,
    ...(description ? { description } : {}),
    icon: condition.icon,
    kind: condition.kind,
    source: 'dm',
    ...(sourceEntity ? { sourceEntity } : {}),
  };
}

/** Save-time cleanup for the library editor. */
export function cleanCustomConditions(
  list: CustomCondition[]
): CustomCondition[] {
  const seen = new Set<string>();
  const out: CustomCondition[] = [];
  for (const condition of list) {
    const name = condition.name.trim();
    if (name === '') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...condition,
      name,
      description: condition.description.trim(),
    });
  }
  return out;
}
