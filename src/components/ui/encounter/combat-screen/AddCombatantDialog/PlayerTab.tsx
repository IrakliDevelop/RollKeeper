'use client';

import React, { useState } from 'react';
import { Search, Milk } from 'lucide-react';
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
    ? players.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : players;

  return (
    <div className="space-y-3 pb-4">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="text-muted absolute top-1/2 left-[14px] -translate-y-1/2"
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search party members…"
          className="border-divider bg-surface-raised focus:border-accent-amber-border w-full rounded-[11px] border-[1.5px] py-3 pr-3 pl-9 text-sm focus:outline-none"
        />
      </div>

      {/* Roster rows */}
      {filtered.length === 0 ? (
        <p className="text-muted py-8 text-center text-[13.5px] font-semibold">
          {query.trim()
            ? `No party members match "${query}".`
            : 'No party members available. Add via the Custom tab.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(player => {
            const tokenColor = playerColors?.[player.id];
            return (
              <button
                key={player.id}
                onClick={() =>
                  onAdd(buildPlayerEntity(player, campaignCode, playerColors))
                }
                className="border-divider bg-surface-raised hover:border-accent-blue-border hover:bg-accent-blue-bg w-full rounded-[14px] border-[1.5px] px-[14px] py-[13px] text-left transition-all"
              >
                <div className="flex items-center gap-3">
                  {/* Token chip */}
                  <div className="bg-accent-blue-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]">
                    <Milk
                      size={22}
                      style={tokenColor ? { color: tokenColor } : undefined}
                      className={tokenColor ? '' : 'text-accent-blue-text'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-heading truncate text-[15px] font-bold">
                        {player.name}
                      </span>
                      <span className="bg-accent-blue-bg text-accent-blue-text shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
                        Lv{player.level} {player.class}
                      </span>
                    </div>
                    <div className="text-muted mt-0.5 text-[12.5px] font-semibold tabular-nums">
                      {player.currentHp}/{player.maxHp} HP · AC{' '}
                      {player.armorClass}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
