'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  Shield,
  ClockAlert,
  Brain,
  Zap,
  Footprints,
  Award,
  Sparkles,
  Sun,
  Moon,
  Plus,
  Minus,
  X,
  AlertCircle,
  Bird,
  Mountain,
  Waves,
  Music,
  Wand2,
} from 'lucide-react';
import { CharacterState } from '@/types/character';
import {
  calculateCharacterArmorClass,
  calculateModifier,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  formatModifier,
  getProficiencyBonus,
  getBuffSpeedBonus,
} from '@/utils/calculations';

interface CharacterHUDProps {
  character: CharacterState;
  calendarDays?: number | null;
  onShortRest: () => void;
  onLongRest: () => void;
  onIncrementDays: () => void;
  onDecrementDays: () => void;
  onToggleInspiration: () => void;
  onToggleReaction: () => void;
  onUseBardicInspiration?: () => void;
  onRestoreBardicInspiration?: () => void;
  onStopConcentration: () => void;
  onNavigateToConditions?: () => void;
  onNavigateToBuffs?: () => void;
  onNavigateToCombat?: () => void;
  onNavigateToSpells?: () => void;
  onToggleBuff?: (id: string) => void;
  onUpdateCharacter?: (updates: Partial<CharacterState>) => void;
}

export default function CharacterHUD({
  character,
  calendarDays,
  onShortRest,
  onLongRest,
  onIncrementDays,
  onDecrementDays,
  onToggleInspiration,
  onToggleReaction,
  onUseBardicInspiration,
  onRestoreBardicInspiration,
  onStopConcentration,
  onNavigateToConditions,
  onNavigateToBuffs,
  onNavigateToCombat,
  onNavigateToSpells,
  onToggleBuff,
  onUpdateCharacter,
}: CharacterHUDProps) {
  const totalLevel = character.totalLevel || character.level;
  const proficiencyBonus = getProficiencyBonus(totalLevel);
  const totalAC = calculateCharacterArmorClass(character);
  const spellSaveDC = calculateSpellSaveDC(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const initiativeModifier = character.initiative.isOverridden
    ? character.initiative.value
    : Math.floor((character.abilities.dexterity - 10) / 2);

  const hpCurrent = character.hitPoints.current;
  const hpMax = character.hitPoints.max;
  const hpTemp = character.hitPoints.temporary;
  const hpPercent = hpMax > 0 ? Math.round((hpCurrent / hpMax) * 100) : 0;

  const activeConditionsCount =
    (character.conditionsAndDiseases?.activeConditions?.length || 0) +
    (character.conditionsAndDiseases?.activeDiseases?.length || 0);

  const isConcentrating = character.concentration?.isConcentrating;
  const inspirationCount = character.heroicInspiration?.count || 0;
  const hasInspiration = inspirationCount > 0;
  const hasUsedReaction = character.reaction?.hasUsedReaction ?? false;

  // Bardic Inspiration (bard only)
  const isBard =
    character.classes?.some(c => c.className.toLowerCase() === 'bard') ||
    character.class?.name?.toLowerCase() === 'bard';
  const bardicMaxUses = isBard
    ? Math.max(1, calculateModifier(character.abilities.charisma))
    : 0;
  const bardicUsesRemaining = isBard
    ? Math.max(
        0,
        bardicMaxUses - (character.bardicInspiration?.usesExpended ?? 0)
      )
    : 0;

  const activeBuffs = (character.temporaryBuffs || []).filter(b => b.isActive);
  const activeBuffCount = activeBuffs.length;

  const getHPColor = () => {
    if (hpPercent > 60) return 'bg-emerald-500';
    if (hpPercent > 30) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getHPTextColor = () => {
    if (hpCurrent === 0) return 'text-red-500';
    if (hpPercent <= 30) return 'text-amber-500';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const hasContextualIndicators =
    isConcentrating || activeConditionsCount > 0 || activeBuffCount > 0;

  return (
    <div className="border-divider bg-surface-raised mx-auto mb-4 max-w-7xl rounded-xl border p-4 shadow-sm">
      {/* Row 1: Stats + Status Indicators */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary Stats */}
        <div className="flex flex-wrap items-center gap-2">
          {/* HP */}
          <button
            onClick={onNavigateToCombat}
            className="border-divider hover:bg-surface-hover flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors"
            title="Go to Combat tab"
          >
            <Heart className="h-5 w-5 text-red-500" />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${getHPTextColor()}`}>
                  {hpCurrent}
                </span>
                <span className="text-faint text-sm">/</span>
                <span className="text-muted text-sm">{hpMax}</span>
                {hpTemp > 0 && (
                  <span className="text-sm font-medium text-blue-500">
                    +{hpTemp}
                  </span>
                )}
              </div>
              <div className="bg-surface-secondary h-1.5 w-20 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getHPColor()}`}
                  style={{ width: `${Math.min(100, hpPercent)}%` }}
                />
              </div>
            </div>
          </button>

          {/* AC */}
          <StatChip
            icon={<Shield className="h-5 w-5 text-blue-500" />}
            value={String(totalAC)}
            label="AC"
            onClick={onNavigateToCombat}
          />

          {/* Initiative */}
          <StatChip
            icon={<Zap className="h-5 w-5 text-amber-500" />}
            value={formatModifier(initiativeModifier)}
            label="Init"
          />

          {/* Speed */}
          <SpeedChip
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />

          {/* Proficiency Bonus */}
          <StatChip
            icon={<Award className="h-5 w-5 text-purple-500" />}
            value={formatModifier(proficiencyBonus)}
            label="Prof"
          />

          {/* Spell Attack - conditional */}
          {spellAttackBonus !== null && (
            <StatChip
              icon={<Wand2 className="h-5 w-5 text-indigo-500" />}
              value={formatModifier(spellAttackBonus)}
              label="Atk"
              onClick={onNavigateToSpells}
            />
          )}

          {/* Spell Save DC - conditional */}
          {spellSaveDC !== null && (
            <StatChip
              icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
              value={String(spellSaveDC)}
              label="DC"
              onClick={onNavigateToSpells}
            />
          )}
        </div>

        {/* Contextual Indicators */}
        {hasContextualIndicators && (
          <div className="border-divider flex flex-wrap items-center gap-2 border-l pl-3">
            {isConcentrating && (
              <button
                onClick={onStopConcentration}
                className="bg-accent-amber-bg text-accent-amber-text flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
                title={`Concentrating on ${character.concentration.spellName || 'spell'} — click to stop`}
              >
                <Brain className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[100px] truncate">
                  {character.concentration.spellName || 'Conc.'}
                </span>
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {activeConditionsCount > 0 && (
              <button
                onClick={onNavigateToConditions}
                className="bg-accent-red-bg text-accent-red-text animate-condition-pulse flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
                title="View active conditions"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{activeConditionsCount}</span>
              </button>
            )}

            {/* Active Buffs */}
            {activeBuffCount > 0 && (
              <ActiveBuffsIndicator
                buffs={activeBuffs}
                onNavigate={onNavigateToBuffs}
                onToggle={onToggleBuff}
              />
            )}
          </div>
        )}
      </div>

      {/* Row 2: Quick Actions */}
      <div className="border-divider mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {/* Short Rest */}
        <button
          onClick={onShortRest}
          className="border-divider text-muted hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:text-amber-600"
          title="Short Rest"
        >
          <Sun className="h-4 w-4" />
          <span className="hidden sm:inline">Short</span>
        </button>

        {/* Long Rest */}
        <button
          onClick={onLongRest}
          className="border-divider text-muted hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:text-indigo-600"
          title="Long Rest"
        >
          <Moon className="h-4 w-4" />
          <span className="hidden sm:inline">Long</span>
        </button>

        {/* Day Counter */}
        <div className="border-divider text-muted flex items-center gap-1 rounded-lg border px-2 py-1.5">
          {calendarDays == null && (
            <button
              onClick={onDecrementDays}
              className="hover:text-body rounded p-0.5 transition-colors"
              title="Decrease day"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="min-w-[48px] text-center text-sm font-medium">
            Day {(calendarDays ?? character.daysSpent ?? 0) + 1}
          </span>
          {calendarDays == null && (
            <button
              onClick={onIncrementDays}
              className="hover:text-body rounded p-0.5 transition-colors"
              title="Increase day"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Heroic Inspiration */}
        <button
          onClick={onToggleInspiration}
          className={`relative rounded-lg border px-2.5 py-2 transition-colors ${
            hasInspiration
              ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-400'
              : 'border-divider text-muted hover:bg-surface-hover hover:text-amber-600'
          }`}
          title={
            hasInspiration
              ? `Use Heroic Inspiration (${inspirationCount} available)`
              : 'Add Heroic Inspiration'
          }
        >
          <Sparkles
            className={`h-4 w-4 ${hasInspiration ? 'fill-current' : ''}`}
          />
          {inspirationCount > 1 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[10px] font-bold text-white dark:bg-amber-400 dark:text-amber-950">
              {inspirationCount}
            </span>
          )}
        </button>

        {/* Bardic Inspiration (Bard only) */}
        {isBard && onUseBardicInspiration && onRestoreBardicInspiration && (
          <button
            onClick={
              bardicUsesRemaining > 0
                ? onUseBardicInspiration
                : onRestoreBardicInspiration
            }
            className={`relative rounded-lg border px-2.5 py-2 transition-colors ${
              bardicUsesRemaining > 0
                ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                : 'border-divider text-muted hover:bg-surface-hover hover:text-indigo-600'
            }`}
            title={
              bardicUsesRemaining > 0
                ? `Expend Bardic Inspiration (${bardicUsesRemaining}/${bardicMaxUses})`
                : `Restore Bardic Inspiration (0/${bardicMaxUses})`
            }
          >
            <Music className="h-4 w-4" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-0.5 text-[10px] font-bold text-white dark:bg-indigo-400 dark:text-indigo-950">
              {bardicUsesRemaining}
            </span>
          </button>
        )}

        {/* Reaction Toggle */}
        <button
          onClick={onToggleReaction}
          className={`rounded-lg border px-2.5 py-2 transition-colors ${
            hasUsedReaction
              ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-600 dark:bg-red-950 dark:text-red-400'
              : 'border-divider text-muted hover:bg-surface-hover hover:text-red-600'
          }`}
          title={
            hasUsedReaction
              ? 'Reaction used — click to reset'
              : 'Mark reaction as used'
          }
        >
          <ClockAlert className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  value,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`border-divider flex items-center gap-1.5 rounded-lg border px-3 py-2.5 ${
        onClick ? 'hover:bg-surface-hover cursor-pointer transition-colors' : ''
      }`}
      title={label}
      onClick={onClick}
    >
      {icon}
      <span className="text-heading text-lg font-bold">{value}</span>
      <span className="text-faint hidden text-xs uppercase sm:inline">
        {label}
      </span>
    </Tag>
  );
}

function SpeedChip({
  character,
  onUpdateCharacter,
}: {
  character: CharacterState;
  onUpdateCharacter?: (updates: Partial<CharacterState>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasExtraSpeeds = !!(
    character.flySpeed ||
    character.climbSpeed ||
    character.swimSpeed
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border-divider hover:bg-surface-hover flex items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-colors"
        title="Click to edit speeds"
      >
        <Footprints className="h-5 w-5 text-emerald-500" />
        <span className="text-heading text-lg font-bold">
          {character.speed + getBuffSpeedBonus(character)}ft
        </span>
        {hasExtraSpeeds && (
          <div className="text-muted flex items-center gap-1 text-xs">
            {!!character.flySpeed && (
              <span
                className="flex items-center gap-0.5"
                title={`Fly ${character.flySpeed}ft`}
              >
                <Bird size={10} />
                {character.flySpeed}
              </span>
            )}
            {!!character.climbSpeed && (
              <span
                className="flex items-center gap-0.5"
                title={`Climb ${character.climbSpeed}ft`}
              >
                <Mountain size={10} />
                {character.climbSpeed}
              </span>
            )}
            {!!character.swimSpeed && (
              <span
                className="flex items-center gap-0.5"
                title={`Swim ${character.swimSpeed}ft`}
              >
                <Waves size={10} />
                {character.swimSpeed}
              </span>
            )}
          </div>
        )}
        <span className="text-faint hidden text-xs uppercase sm:inline">
          Spd
        </span>
      </button>

      {isOpen && onUpdateCharacter && (
        <div className="bg-surface-raised border-divider absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border p-3 shadow-lg">
          <div className="space-y-2">
            <SpeedRow
              icon={<Footprints size={14} className="text-emerald-500" />}
              label="Walk"
              value={character.speed}
              onChange={v => onUpdateCharacter({ speed: v })}
            />
            <SpeedRow
              icon={<Bird size={14} className="text-emerald-500" />}
              label="Fly"
              value={character.flySpeed || 0}
              onChange={v => onUpdateCharacter({ flySpeed: v })}
            />
            <SpeedRow
              icon={<Mountain size={14} className="text-emerald-500" />}
              label="Climb"
              value={character.climbSpeed || 0}
              onChange={v => onUpdateCharacter({ climbSpeed: v })}
            />
            <SpeedRow
              icon={<Waves size={14} className="text-emerald-500" />}
              label="Swim"
              value={character.swimSpeed || 0}
              onChange={v => onUpdateCharacter({ swimSpeed: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SpeedRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-body w-12 text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, value - 5))}
          className="text-muted hover:text-body hover:bg-surface-hover rounded p-0.5 transition-colors"
        >
          <Minus size={12} />
        </button>
        <input
          type="number"
          value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="text-heading bg-surface-secondary w-14 [appearance:textfield] rounded px-1.5 py-0.5 text-center text-sm font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          onClick={() => onChange(value + 5)}
          className="text-muted hover:text-body hover:bg-surface-hover rounded p-0.5 transition-colors"
        >
          <Plus size={12} />
        </button>
        <span className="text-faint text-xs">ft</span>
      </div>
    </div>
  );
}

function ActiveBuffsIndicator({
  buffs,
  onNavigate,
  onToggle,
}: {
  buffs: CharacterState['temporaryBuffs'];
  onNavigate?: () => void;
  onToggle?: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-accent-blue-bg text-accent-blue-text flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
        title="Active buffs — click to view"
      >
        <Zap className="h-3.5 w-3.5" />
        <span>{buffs.length}</span>
      </button>

      {isOpen && (
        <div className="bg-surface-raised border-divider absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-heading text-xs font-bold uppercase">
              Active Buffs
            </span>
            {onNavigate && (
              <button
                onClick={() => {
                  onNavigate();
                  setIsOpen(false);
                }}
                className="text-accent-blue-text text-xs font-medium hover:underline"
              >
                Manage
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {buffs.map(buff => (
              <div
                key={buff.id}
                className="border-divider flex items-center justify-between rounded-md border px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-heading truncate text-sm font-medium">
                    {buff.name}
                  </div>
                  <div className="text-muted truncate text-xs">
                    {buff.effects
                      .map(e => {
                        const statLabels: Record<string, string> = {
                          ac: 'AC',
                          maxHp: 'Max HP',
                          tempHp: 'Temp HP',
                          speed: 'Speed',
                          savingThrow: 'Save',
                          attackBonus: 'Atk',
                        };
                        const stat = statLabels[e.targetStat] || e.targetStat;
                        if (e.mode === 'add')
                          return `${stat} ${e.value >= 0 ? '+' : ''}${e.value}`;
                        if (e.mode === 'set') return `${stat} = ${e.value}`;
                        if (e.mode === 'floor') return `${stat} min ${e.value}`;
                        return `${e.value} ${stat}`;
                      })
                      .join(', ')}
                  </div>
                </div>
                {onToggle && (
                  <button
                    onClick={() => onToggle(buff.id)}
                    className="text-muted hover:text-accent-red-text ml-2 shrink-0 rounded p-0.5 transition-colors"
                    title={`Deactivate ${buff.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
