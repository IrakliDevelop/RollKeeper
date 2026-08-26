'use client';

import React from 'react';
import { Brain, ClockAlert, Sparkles } from 'lucide-react';
import type { EncounterEntity } from '@/types/encounter';

const TYPE_STYLES: Record<
  string,
  { badge: string; badgeBg: string; border: string }
> = {
  player: {
    badge: 'text-accent-blue-text',
    badgeBg: 'bg-accent-blue-bg-strong',
    border: 'border-accent-blue-border',
  },
  npc: {
    badge: 'text-accent-amber-text',
    badgeBg: 'bg-accent-amber-bg-strong',
    border: 'border-accent-amber-border',
  },
  monster: {
    badge: 'text-accent-purple-text',
    badgeBg: 'bg-accent-purple-bg-strong',
    border: 'border-accent-purple-border',
  },
  lair: {
    badge: 'text-accent-emerald-text',
    badgeBg: 'bg-accent-emerald-bg-strong',
    border: 'border-accent-emerald-border',
  },
};

interface SyncDotProps {
  lastSynced?: string;
}

function SyncDot({ lastSynced }: SyncDotProps) {
  if (!lastSynced) return null;
  const ago = Date.now() - new Date(lastSynced).getTime();
  const colorClass =
    ago < 30000
      ? 'bg-accent-emerald-text-muted'
      : ago < 120000
        ? 'bg-accent-amber-text-muted'
        : 'bg-accent-red-text-muted';
  const label =
    ago < 30000
      ? 'Synced recently'
      : ago < 120000
        ? 'Synced >30s ago'
        : 'Sync stale';
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass}`}
      title={label}
    />
  );
}

interface RowBadgesProps {
  entity: EncounterEntity;
  isOnDeck: boolean;
  lastSynced?: string;
}

export function RowBadges({ entity, isOnDeck, lastSynced }: RowBadgesProps) {
  const style = entity.summonOwnerId
    ? TYPE_STYLES.player
    : (TYPE_STYLES[entity.type] ?? TYPE_STYLES.monster);
  const badgeLabel = entity.summonOwnerId
    ? 'Summon'
    : entity.type === 'npc'
      ? 'NPC'
      : entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const showSyncDot = entity.type === 'player' || !!entity.summonOwnerId;

  return (
    <>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${style.badgeBg} ${style.badge} ${style.border}`}
      >
        {badgeLabel}
      </span>

      {isOnDeck && (
        <span className="bg-accent-amber-bg text-accent-amber-text shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em]">
          ON DECK
        </span>
      )}

      {entity.concentrationSpell && (
        <span className="bg-accent-orange-bg text-accent-orange-text shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <Brain size={10} className="mr-0.5 inline" />
          {entity.concentrationSpell}
        </span>
      )}

      {entity.hasUsedReaction && (
        <span className="bg-accent-red-bg text-accent-red-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <ClockAlert size={10} />
          Reaction
        </span>
      )}

      {entity.type === 'player' && (entity.inspirationCount ?? 0) > 0 && (
        <span className="bg-accent-amber-bg text-accent-amber-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <Sparkles size={10} />
          {entity.inspirationCount}
        </span>
      )}

      {entity.type === 'npc' && entity.hitDice && (
        <span className="bg-accent-purple-bg text-accent-purple-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium">
          HD {entity.hitDice.current}/{entity.hitDice.max}
        </span>
      )}

      {showSyncDot && <SyncDot lastSynced={lastSynced} />}
    </>
  );
}
