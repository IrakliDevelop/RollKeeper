'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import type { EncounterEntity } from '@/types/encounter';
import { buildPlayerEntity, type CampaignPlayer } from './buildEntity';

interface PlayerTabProps {
  players: CampaignPlayer[];
  playerColors?: Record<string, string>;
  campaignCode?: string;
  onAdd: (entity: Omit<EncounterEntity, 'id'>) => void;
}

export function PlayerTab({
  players,
  playerColors,
  campaignCode,
  onAdd,
}: PlayerTabProps) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? players.filter(player =>
        player.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : players;

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search party members…"
        aria-label="Search party members"
        leftIcon={<Search size={16} />}
        size="sm"
      />
      {filtered.length === 0 ? (
        <p className="text-muted py-6 text-sm">
          {query.trim()
            ? `No party members match “${query}”.`
            : 'No party members available. Add via the Custom tab.'}
        </p>
      ) : (
        <div className="divide-divider border-divider divide-y border-y">
          {filtered.map(player => (
            <button
              key={player.id}
              type="button"
              onClick={() =>
                onAdd(buildPlayerEntity(player, campaignCode, playerColors))
              }
              className="hover:bg-surface-hover flex w-full items-center justify-between gap-3 py-3 text-left pointer-coarse:min-h-11"
            >
              <span className="min-w-0">
                <span className="text-heading block truncate text-sm font-medium">
                  {player.name}
                </span>
                <span className="text-muted block text-xs tabular-nums">
                  {player.currentHp}/{player.maxHp} HP · AC {player.armorClass}
                </span>
              </span>
              <Badge variant="neutral" size="sm">
                Level {player.level} {player.class}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
