'use client';

import { Brain, ClockAlert } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import type { EncounterEntity } from '@/types/encounter';

interface RowBadgesProps {
  entity: EncounterEntity;
  isOnDeck: boolean;
  lastSynced?: string;
}

function SyncStatus({ lastSynced }: { lastSynced?: string }) {
  if (!lastSynced) return null;
  const elapsed = Date.now() - new Date(lastSynced).getTime();
  if (elapsed < 30000) return <Badge variant="success">Sheet synced</Badge>;
  return (
    <Badge variant="warning">
      {elapsed < 120000 ? 'Sheet sync delayed' : 'Sheet out of date'}
    </Badge>
  );
}

export function RowBadges({ entity, isOnDeck, lastSynced }: RowBadgesProps) {
  const typeLabel = entity.summonOwnerId
    ? 'Summon'
    : entity.type === 'npc'
      ? 'NPC'
      : entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const showSync = entity.type === 'player' || !!entity.summonOwnerId;
  const disposition =
    entity.playerDisposition ?? (entity.summonOwnerId ? 'ally' : 'enemy');

  return (
    <>
      <Badge variant="neutral">{typeLabel}</Badge>
      {entity.type !== 'player' && (
        <Badge variant="neutral">
          {disposition.charAt(0).toUpperCase() + disposition.slice(1)}
        </Badge>
      )}
      {isOnDeck && <Badge variant="primary">On deck</Badge>}
      {entity.concentrationSpell && (
        <Badge variant="magic">
          <Brain size={12} aria-hidden="true" />
          {entity.concentrationSpell}
        </Badge>
      )}
      {entity.hasUsedReaction && (
        <Badge variant="neutral" leftIcon={<ClockAlert size={12} />}>
          Reaction used
        </Badge>
      )}
      {entity.type === 'player' && (entity.inspirationCount ?? 0) > 0 && (
        <Badge variant="primary">{entity.inspirationCount} inspiration</Badge>
      )}
      {(entity.type === 'npc' || entity.npcSourceId) && entity.hitDice && (
        <Badge variant="neutral">
          {entity.hitDice.current} of {entity.hitDice.max} hit dice
        </Badge>
      )}
      {showSync && <SyncStatus lastSynced={lastSynced} />}
    </>
  );
}
