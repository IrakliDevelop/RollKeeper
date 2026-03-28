'use client';

import React from 'react';
import Image from 'next/image';
import {
  Shield,
  Swords,
  Heart,
  Sparkles,
  Brain,
  AlertTriangle,
  Angry,
  Minus,
  Plus,
  Eye,
  Lightbulb,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { CampaignPlayerData } from '@/types/campaign';
import {
  calculateCharacterArmorClass,
  calculatePassivePerception,
  calculatePassiveInsight,
  calculatePassiveInvestigation,
} from '@/utils/calculations';

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
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onClick?: () => void;
}

export function PlayerSummaryCard({
  player,
  customCounterLabel,
  counterValue = 0,
  onAdjustCounter,
  onClick,
}: PlayerSummaryCardProps) {
  const { characterData: char } = player;

  const currentHp = char.hitPoints?.current ?? 0;
  const maxHp = char.hitPoints?.max ?? 0;
  const tempHp = char.hitPoints?.temporary ?? 0;
  const ac = calculateCharacterArmorClass(char);
  const charClass = char.class?.name || 'Unknown';
  const level = char.totalLevel || char.level || 1;

  const equippedWeapon = char.weapons?.find(w => w.isEquipped);
  const isConcentrating = char.concentration?.isConcentrating;
  const concentrationSpell = char.concentration?.spellName;
  const inspirationCount = char.heroicInspiration?.count ?? 0;

  const passivePerception = calculatePassivePerception(char);
  const passiveInsight = calculatePassiveInsight(char);
  const passiveInvestigation = calculatePassiveInvestigation(char);

  const activeConditions = char.conditionsAndDiseases?.activeConditions ?? [];
  const avatarSrc = char.avatar?.trim();

  return (
    <div
      className={`border-divider bg-surface-raised rounded-lg border-2 shadow-md transition-all hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="p-3">
        {/* Header: optional avatar + name, race, class, level */}
        <div className="mb-3 flex gap-3">
          {avatarSrc ? (
            <div className="border-divider relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2">
              <Image
                src={avatarSrc}
                alt={char.name || player.characterName || 'Character'}
                fill
                className="object-cover"
                sizes="56px"
                unoptimized={avatarSrc.startsWith('data:')}
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-heading mb-0.5 truncate text-base leading-tight font-semibold">
                  {char.name || player.characterName}
                </h3>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-body text-xs">
                    {char.race || 'Unknown'}
                  </span>
                  <span className="text-faint">·</span>
                  <Badge variant={getClassBadgeVariant(charClass)}>
                    {charClass}
                  </Badge>
                  <span className="text-faint">·</span>
                  <span className="text-body text-xs font-medium">
                    Lv. {level}
                  </span>
                </div>
              </div>
              <div className="text-muted max-w-[40%] shrink-0 truncate text-right text-[10px] leading-tight">
                {player.playerName}
              </div>
            </div>

            {/* HP Bar */}
            <div className="mb-2">
              <div className="mb-0.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Heart size={12} className="text-accent-red-text shrink-0" />
                  <span className="text-heading text-xs font-medium">
                    {currentHp} / {maxHp} HP
                  </span>
                  {tempHp > 0 && (
                    <span className="text-accent-blue-text text-[10px]">
                      (+{tempHp} temp)
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-surface-secondary h-2 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${getHpColor(currentHp, maxHp)}`}
                  style={{
                    width: `${maxHp > 0 ? Math.min(100, (currentHp / maxHp) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1">
                <Shield size={12} className="text-accent-blue-text-muted" />
                <span className="text-heading text-xs font-semibold">
                  {ac} AC
                </span>
              </div>
              {equippedWeapon && (
                <div className="flex max-w-[min(100%,12rem)] min-w-0 items-center gap-1">
                  <Swords size={12} className="text-muted shrink-0" />
                  <span className="text-body truncate text-xs">
                    {equippedWeapon.name}
                  </span>
                </div>
              )}
              <div
                className="flex items-center gap-0.5"
                title={
                  inspirationCount > 0
                    ? `${inspirationCount} Heroic Inspiration dice — player can reroll and take the better result`
                    : 'No Heroic Inspiration'
                }
              >
                {Array.from(
                  { length: Math.max(inspirationCount, 1) },
                  (_, i) => {
                    const isActive = i < inspirationCount;
                    return (
                      <div
                        key={i}
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                          isActive
                            ? 'scale-105 border-yellow-600 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-sm'
                            : 'bg-surface-raised border-yellow-300 text-yellow-600 dark:border-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        <Sparkles
                          size={9}
                          className={isActive ? 'fill-current' : ''}
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Passive Scores */}
            <div className="bg-surface-secondary mb-2 flex items-center justify-between rounded-md px-2 py-1.5">
              <div
                className="flex items-center gap-1"
                title="Passive Perception"
              >
                <Eye size={11} className="text-accent-emerald-text" />
                <span className="text-muted text-[9px] tracking-wide uppercase">
                  Perc
                </span>
                <span className="text-heading text-xs font-bold">
                  {passivePerception}
                </span>
              </div>
              <div className="bg-divider h-3 w-px" />
              <div className="flex items-center gap-1" title="Passive Insight">
                <Lightbulb size={11} className="text-accent-amber-text" />
                <span className="text-muted text-[9px] tracking-wide uppercase">
                  Ins
                </span>
                <span className="text-heading text-xs font-bold">
                  {passiveInsight}
                </span>
              </div>
              <div className="bg-divider h-3 w-px" />
              <div
                className="flex items-center gap-1"
                title="Passive Investigation"
              >
                <Search size={11} className="text-accent-blue-text" />
                <span className="text-muted text-[9px] tracking-wide uppercase">
                  Inv
                </span>
                <span className="text-heading text-xs font-bold">
                  {passiveInvestigation}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* DM Custom Counter — mini colored boxes */}
        {customCounterLabel && onAdjustCounter && (
          <div
            className="border-accent-purple-border bg-accent-purple-bg mb-2 flex items-center justify-between rounded-md border px-2 py-1.5"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="group"
            aria-label={customCounterLabel}
          >
            <div className="flex items-center gap-2">
              <span className="text-accent-purple-text flex items-center gap-1 text-xs font-semibold">
                <Angry size={12} />
                {customCounterLabel}
              </span>
              <div className="flex gap-1">
                {counterValue > 0 ? (
                  Array.from({ length: counterValue }, (_, i) => (
                    <div
                      key={i}
                      className="flex h-5 w-5 items-center justify-center rounded border-2 border-purple-500 bg-purple-500 text-white shadow-sm"
                    >
                      <Angry size={10} />
                    </div>
                  ))
                ) : (
                  <span className="text-accent-purple-text text-xs opacity-60">
                    0
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAdjustCounter(-1);
                }}
                className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
                disabled={counterValue <= 0}
              >
                <Minus size={12} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAdjustCounter(1);
                }}
                className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Concentration & Conditions */}
        <div className="flex flex-wrap gap-1.5">
          {isConcentrating && concentrationSpell && (
            <Badge variant="info" size="sm">
              <Brain size={10} className="mr-1" />
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
        <div className="border-divider mt-2 flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getFreshnessDot(player.lastSynced)}`}
            />
            <span className="text-muted text-xs">
              Synced {formatTimeAgo(player.lastSynced)}
            </span>
          </div>
          {onClick && (
            <span className="text-muted text-xs">Click for details</span>
          )}
        </div>
      </div>
    </div>
  );
}
