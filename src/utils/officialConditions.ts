import { getCanonicalConditionIconName } from '@/utils/conditionIcons';

import type { ProcessedCondition } from '@/types/character';
import type { CustomCondition } from '@/types/encounter';

function conditionId(name: string): string {
  return `official-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** One canonical rules entry per condition, preferring the 2024 PHB. */
export function selectCanonicalConditions(
  conditions: ProcessedCondition[]
): ProcessedCondition[] {
  const byName = new Map<string, ProcessedCondition>();
  for (const condition of conditions) {
    const key = condition.name.toLowerCase();
    const current = byName.get(key);
    if (!current || condition.source === 'XPHB') byName.set(key, condition);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Canonical condition snapshot suitable for NPC presets and combat effects. */
export function toOfficialCondition(
  condition: ProcessedCondition
): CustomCondition {
  return {
    id: conditionId(condition.name),
    name: condition.name,
    description: condition.description,
    icon: getCanonicalConditionIconName(condition.name) ?? 'trending-down',
    kind: 'debuff',
    origin: 'official',
    rulesSource: condition.source,
  };
}

export function buildOfficialConditions(
  conditions: ProcessedCondition[]
): CustomCondition[] {
  return selectCanonicalConditions(conditions).map(toOfficialCondition);
}
