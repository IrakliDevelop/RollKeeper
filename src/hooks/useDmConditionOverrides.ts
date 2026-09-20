import { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { isConditionIconName } from '@/utils/conditionIconRegistry';
import { loadAllConditions } from '@/utils/conditionsDiseasesLoader';
import type { ProcessedCondition } from '@/types/character';
import type { DmEffect } from '@/types/sharedState';

/**
 * Look up the canonical description for a condition name.
 * Prioritizes XPHB (2024) over PHB (2014).
 */
function findCanonicalCondition(
  name: string,
  conditions: ProcessedCondition[]
): ProcessedCondition | null {
  const matches = conditions.filter(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (matches.length === 0) return null;

  const xphb = matches.find(c => c.source === 'XPHB');
  if (xphb) return xphb;

  return matches[0];
}

export interface ResolvedDmEffectCondition {
  source: string;
  description: string;
  icon?: string;
}

/**
 * What an `add` effect becomes on the sheet. A DM custom condition (it carries
 * a valid registry icon) keeps the DM's own text and icon — the canonical
 * lookup is skipped even when its name collides with a 5e condition. A
 * standard effect is unchanged: canonical XPHB text wins over the DM text.
 */
export function resolveDmEffectCondition(
  effect: DmEffect,
  conditions: ProcessedCondition[]
): ResolvedDmEffectCondition {
  const isCustom =
    effect.origin === 'custom' ||
    (effect.origin === undefined && isConditionIconName(effect.icon));
  if (isCustom) {
    return {
      source: 'DM',
      description: effect.description || 'Custom effect applied by DM',
      icon: effect.icon,
    };
  }
  const canonical = findCanonicalCondition(effect.name, conditions);
  return {
    source: canonical?.source ?? effect.rulesSource ?? 'DM',
    description:
      canonical?.description ||
      effect.description ||
      (effect.kind === 'buff'
        ? 'Buff applied by DM'
        : 'Custom effect applied by DM'),
  };
}

/**
 * Applies DM condition overrides (additions/removals) from the shared state
 * into the player's character store, then acknowledges so they're cleared
 * from Redis. After acknowledgment the player "owns" the conditions and
 * normal bidirectional sync takes over.
 */
export function useDmConditionOverrides(
  dmEffects: DmEffect[] | undefined,
  onAcknowledged: () => void
) {
  const [conditionsDb, setConditionsDb] = useState<ProcessedCondition[]>([]);
  const [conditionsReady, setConditionsReady] = useState(false);
  const acknowledgedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    loadAllConditions().then(conditions => {
      if (active) {
        setConditionsDb(conditions);
        setConditionsReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!conditionsReady || !dmEffects || dmEffects.length === 0) return;

    // Build a fingerprint of the current batch to avoid re-processing
    const batchKey = dmEffects
      .map(e => `${e.action}-${e.name}-${e.appliedAt}`)
      .join('|');
    if (acknowledgedRef.current.has(batchKey)) return;

    const { character, addCondition, removeCondition } =
      useCharacterStore.getState();
    const activeConditions =
      character.conditionsAndDiseases?.activeConditions ?? [];

    let appliedAny = false;

    for (const effect of dmEffects) {
      if (effect.action === 'remove') {
        const existing = activeConditions.find(c => c.name === effect.name);
        if (existing) {
          removeCondition(existing.id);
          appliedAny = true;
        }
      } else if (effect.action === 'add') {
        const alreadyHas = activeConditions.some(c => c.name === effect.name);
        if (!alreadyHas) {
          const resolved = resolveDmEffectCondition(effect, conditionsDb);
          addCondition(
            effect.name,
            resolved.source,
            resolved.description,
            1,
            effect.sourceSpell ? `Source: ${effect.sourceSpell}` : undefined,
            resolved.icon,
            effect.kind
          );
          appliedAny = true;
        }
      }
    }

    // Mark this batch as processed and acknowledge to clear from Redis.
    // Even if nothing was applied (idempotent), acknowledge so the
    // effects don't linger for the next reload.
    acknowledgedRef.current.add(batchKey);
    onAcknowledged();

    if (appliedAny) {
      console.log(`Applied ${dmEffects.length} DM effect(s) and acknowledged`);
    }
  }, [dmEffects, conditionsDb, conditionsReady, onAcknowledged]);
}
