import { useCallback, useRef } from 'react';
import { isConditionIconName } from '@/utils/conditionIconRegistry';
import type { EncounterEntity } from '@/types/encounter';
import type { DmEffect } from '@/types/sharedState';

interface UseDmEffectsSyncOptions {
  campaignCode: string;
  dmId: string;
}

/**
 * DM condition overrides for one player entity:
 * - `add`: DM-source conditions the player should gain (with the DM's
 *   description and, for custom conditions, the registry icon)
 * - `remove`: player-source conditions the DM explicitly removed (suppressed)
 */
export function buildDmEffects(
  entity: EncounterEntity,
  now: string
): DmEffect[] {
  const effects: DmEffect[] = [];

  for (const c of entity.conditions) {
    if (c.source !== 'dm') continue;
    effects.push({
      id: c.id,
      name: c.name,
      action: 'add',
      description: c.description,
      ...(isConditionIconName(c.icon) ? { icon: c.icon } : {}),
      ...(c.kind ? { kind: c.kind } : {}),
      ...(c.origin ? { origin: c.origin } : {}),
      ...(c.rulesSource ? { rulesSource: c.rulesSource } : {}),
      sourceSpell: c.sourceSpell,
      appliedAt: now,
    });
  }

  for (const name of entity.suppressedConditions ?? []) {
    effects.push({
      id: `remove-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      action: 'remove',
      appliedAt: now,
    });
  }

  return effects;
}

/**
 * Computes DM condition overrides for a player entity and pushes them to Redis.
 *
 * Overrides include:
 * - `add`: DM-source conditions the player should gain
 * - `remove`: player-source conditions the DM explicitly removed (suppressed)
 */
export function useDmEffectsSync({
  campaignCode,
  dmId,
}: UseDmEffectsSyncOptions) {
  const pendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const pushEffects = useCallback(
    async (playerId: string, effects: DmEffect[]) => {
      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'effects',
            data: { playerId, effects },
            dmId,
          }),
        });
      } catch (err) {
        console.warn('Failed to sync DM effects to player:', err);
      }
    },
    [campaignCode, dmId]
  );

  const syncPlayerEffects = useCallback(
    (playerId: string, entity: EncounterEntity) => {
      const existing = pendingRef.current.get(playerId);
      if (existing) clearTimeout(existing);

      pendingRef.current.set(
        playerId,
        setTimeout(() => {
          pendingRef.current.delete(playerId);
          pushEffects(
            playerId,
            buildDmEffects(entity, new Date().toISOString())
          );
        }, 500)
      );
    },
    [pushEffects]
  );

  return { syncPlayerEffects };
}
