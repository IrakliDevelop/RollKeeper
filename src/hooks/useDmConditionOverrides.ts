import { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { loadAllConditions } from '@/utils/conditionsDiseasesLoader';
import type { ProcessedCondition } from '@/types/character';
import type { DmEffect } from '@/types/sharedState';

/**
 * Look up the canonical description for a condition name.
 * Prioritizes XPHB (2024) over PHB (2014).
 */
function findConditionDescription(
  name: string,
  conditions: ProcessedCondition[]
): string | null {
  const matches = conditions.filter(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (matches.length === 0) return null;

  const xphb = matches.find(c => c.source === 'XPHB');
  if (xphb) return xphb.description;

  return matches[0].description;
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
  const acknowledgedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadAllConditions().then(setConditionsDb);
  }, []);

  useEffect(() => {
    if (!dmEffects || dmEffects.length === 0) return;

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
          const canonicalDesc = findConditionDescription(
            effect.name,
            conditionsDb
          );
          const source = canonicalDesc ? 'XPHB' : 'DM';
          const description =
            canonicalDesc ||
            effect.description ||
            'Custom effect applied by DM';

          addCondition(
            effect.name,
            source,
            description,
            1,
            effect.sourceSpell ? `Source: ${effect.sourceSpell}` : undefined
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
  }, [dmEffects, conditionsDb, onAcknowledged]);
}
