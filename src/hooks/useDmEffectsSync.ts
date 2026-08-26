import { useCallback, useRef } from 'react';
import type { EncounterEntity, EncounterCondition } from '@/types/encounter';
import type { DmEffect } from '@/types/sharedState';

interface UseDmEffectsSyncOptions {
  campaignCode: string;
  dmId: string;
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

  const buildEffects = useCallback((entity: EncounterEntity): DmEffect[] => {
    const now = new Date().toISOString();
    const effects: DmEffect[] = [];

    // Additions: DM-source conditions the player should gain
    for (const c of entity.conditions) {
      if (c.source === 'dm') {
        effects.push({
          id: c.id,
          name: c.name,
          action: 'add',
          description: c.description,
          sourceSpell: c.sourceSpell,
          appliedAt: now,
        });
      }
    }

    // Removals: conditions the DM suppressed
    for (const name of entity.suppressedConditions ?? []) {
      effects.push({
        id: `remove-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        action: 'remove',
        appliedAt: now,
      });
    }

    return effects;
  }, []);

  const syncPlayerEffects = useCallback(
    (playerId: string, entity: EncounterEntity) => {
      const existing = pendingRef.current.get(playerId);
      if (existing) clearTimeout(existing);

      pendingRef.current.set(
        playerId,
        setTimeout(() => {
          pendingRef.current.delete(playerId);
          const effects = buildEffects(entity);
          pushEffects(playerId, effects);
        }, 500)
      );
    },
    [pushEffects, buildEffects]
  );

  return { syncPlayerEffects };
}
