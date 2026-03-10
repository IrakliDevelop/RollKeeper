'use client';

import React from 'react';
import { Shield, Swords, Heart, Sparkles, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { CampaignPlayerData } from '@/types/campaign';

function getClassBadgeVariant(
  className: string
):
  | 'danger'
  | 'secondary'
  | 'neutral'
  | 'warning'
  | 'success'
  | 'primary'
  | 'info' {
  const variants: Record<
    string,
    | 'danger'
    | 'secondary'
    | 'neutral'
    | 'warning'
    | 'success'
    | 'primary'
    | 'info'
  > = {
    Fighter: 'danger',
    Wizard: 'secondary',
    Rogue: 'neutral',
    Cleric: 'warning',
    Ranger: 'success',
    Paladin: 'primary',
    Barbarian: 'danger',
    Bard: 'info',
    Druid: 'success',
    Monk: 'warning',
    Sorcerer: 'secondary',
    Warlock: 'primary',
  };
  return variants[className] || 'neutral';
}

function getHpColor(current: number, max: number): string {
  if (max === 0) return 'bg-gray-400';
  const pct = current / max;
  if (pct > 0.5) return 'bg-green-500';
  if (pct > 0.25) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getFreshnessDot(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 30) return 'bg-green-500';
  if (seconds < 120) return 'bg-yellow-500';
  return 'bg-red-500';
}

interface PlayerSummaryCardProps {
  player: CampaignPlayerData;
}

export function PlayerSummaryCard({ player }: PlayerSummaryCardProps) {
  const { characterData: char } = player;

  const currentHp = char.hitPoints?.current ?? 0;
  const maxHp = char.hitPoints?.max ?? 0;
  const tempHp = char.hitPoints?.temporary ?? 0;
  const ac = char.isTempACActive ? char.tempArmorClass : char.armorClass;
  const charClass = char.class?.name || 'Unknown';
  const level = char.totalLevel || char.level || 1;

  const equippedWeapon = char.weapons?.find(w => w.isEquipped);
  const isConcentrating = char.concentration?.isConcentrating;
  const concentrationSpell = char.concentration?.spellName;

  const activeConditions = char.conditionsAndDiseases?.activeConditions ?? [];

  return (
    <div className="border-divider bg-surface-raised rounded-lg border-2 shadow-md transition-all hover:shadow-lg">
      <div className="p-5">
        {/* Header: Name, Race, Class, Level */}
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-heading mb-1 truncate text-lg font-semibold">
              {char.name || player.characterName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-body text-sm">
                {char.race || 'Unknown'}
              </span>
              <span className="text-faint">·</span>
              <Badge variant={getClassBadgeVariant(charClass)}>
                {charClass}
              </Badge>
              <span className="text-faint">·</span>
              <span className="text-body text-sm font-medium">Lv. {level}</span>
            </div>
          </div>
          <div className="text-muted ml-2 flex-shrink-0 text-xs">
            {player.playerName}
          </div>
        </div>

        {/* HP Bar */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Heart size={14} className="text-red-500" />
              <span className="text-heading text-sm font-medium">
                {currentHp} / {maxHp} HP
              </span>
              {tempHp > 0 && (
                <span className="text-accent-blue-text text-xs">
                  (+{tempHp} temp)
                </span>
              )}
            </div>
          </div>
          <div className="bg-surface-secondary h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${getHpColor(currentHp, maxHp)}`}
              style={{
                width: `${maxHp > 0 ? Math.min(100, (currentHp / maxHp) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-accent-blue-text-muted" />
            <span className="text-heading text-sm font-semibold">{ac} AC</span>
          </div>
          {equippedWeapon && (
            <div className="flex items-center gap-1.5">
              <Swords size={14} className="text-muted" />
              <span className="text-body truncate text-sm">
                {equippedWeapon.name}
              </span>
            </div>
          )}
        </div>

        {/* Concentration & Conditions */}
        <div className="flex flex-wrap gap-1.5">
          {isConcentrating && concentrationSpell && (
            <Badge variant="info" size="sm">
              <Sparkles size={10} className="mr-1" />
              {concentrationSpell}
            </Badge>
          )}
          {activeConditions.map(condition => (
            <Badge key={condition.name} variant="warning" size="sm">
              <AlertTriangle size={10} className="mr-1" />
              {condition.name}
            </Badge>
          ))}
        </div>

        {/* Sync Footer */}
        <div className="border-divider mt-4 flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getFreshnessDot(player.lastSynced)}`}
            />
            <span className="text-muted text-xs">
              Synced {formatTimeAgo(player.lastSynced)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
