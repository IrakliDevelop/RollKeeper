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
} from 'lucide-react';
import { CharacterState } from '@/types/character';
import {
  calculateCharacterArmorClass,
  calculateSpellSaveDC,
  formatModifier,
  getProficiencyBonus,
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
  onStopConcentration: () => void;
  onNavigateToConditions?: () => void;
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
  onStopConcentration,
  onNavigateToConditions,
  onUpdateCharacter,
}: CharacterHUDProps) {
  const totalLevel = character.totalLevel || character.level;
  const proficiencyBonus = getProficiencyBonus(totalLevel);
  const totalAC = calculateCharacterArmorClass(character);
  const spellSaveDC = calculateSpellSaveDC(character);
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
  const hasInspiration = (character.heroicInspiration?.count || 0) > 0;
  const hasUsedReaction = character.reaction?.hasUsedReaction ?? false;

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

  return (
    <div className="border-divider bg-surface-raised mx-auto mb-4 max-w-7xl rounded-xl border p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary Stats */}
        <div className="flex flex-wrap items-center gap-2">
          {/* HP */}
          <div className="border-divider flex items-center gap-2 rounded-lg border px-3 py-2.5">
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
          </div>

          {/* AC */}
          <StatChip
            icon={<Shield className="h-5 w-5 text-blue-500" />}
            value={String(totalAC)}
            label="AC"
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

          {/* Spell Save DC - conditional */}
          {spellSaveDC !== null && (
            <StatChip
              icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
              value={String(spellSaveDC)}
              label="DC"
            />
          )}
        </div>

        {/* Contextual Indicators */}
        {(isConcentrating || activeConditionsCount > 0) && (
          <div className="border-divider flex items-center gap-2 border-l pl-3">
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
                className="bg-accent-red-bg text-accent-red-text flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
                title="View active conditions"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{activeConditionsCount}</span>
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Utility Quick Actions */}
        <div className="flex items-center gap-2">
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
              Day {calendarDays ?? character.daysSpent ?? 0}
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

          {/* Heroic Inspiration */}
          <button
            onClick={onToggleInspiration}
            className={`rounded-lg border px-2.5 py-2 transition-colors ${
              hasInspiration
                ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-400'
                : 'border-divider text-muted hover:bg-surface-hover hover:text-amber-600'
            }`}
            title={
              hasInspiration
                ? 'Use Heroic Inspiration'
                : 'Add Heroic Inspiration'
            }
          >
            <Sparkles
              className={`h-4 w-4 ${hasInspiration ? 'fill-current' : ''}`}
            />
          </button>

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
    </div>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className="border-divider flex items-center gap-1.5 rounded-lg border px-3 py-2.5"
      title={label}
    >
      {icon}
      <span className="text-heading text-lg font-bold">{value}</span>
      <span className="text-faint hidden text-xs uppercase sm:inline">
        {label}
      </span>
    </div>
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
          {character.speed}ft
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
