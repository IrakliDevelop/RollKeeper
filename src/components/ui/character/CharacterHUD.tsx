'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ClockAlert,
  Zap,
  Footprints,
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
import { NumberField } from '@/components/ui/forms/NumberInput';
import { badgeVariants } from '@/components/ui/layout/badge';
import { AcShield } from '@/components/ui/game/AcShield';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import {
  calculateCharacterArmorClass,
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  formatModifier,
  getProficiencyBonus,
  getBuffSpeedBonus,
} from '@/utils/calculations';
import { getActiveClassResources } from '@/utils/classResources';
import { cn } from '@/utils/cn';
import {
  CLASS_RESOURCE_ICONS,
  CLASS_RESOURCE_COLORS,
} from './classResourceStyles';
import { HudHitPoints } from './HudHitPoints';
import { HudStat } from './HudStat';

interface CharacterHUDProps {
  character: CharacterState;
  calendarDays?: number | null;
  onShortRest: () => void;
  onLongRest: () => void;
  onIncrementDays: () => void;
  onDecrementDays: () => void;
  onToggleInspiration: () => void;
  onToggleReaction: () => void;
  onUseClassResource?: (id: string) => void;
  onRestoreClassResource?: (id: string) => void;
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
  onUseClassResource,
  onRestoreClassResource,
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

  const activeConditionsCount =
    (character.conditionsAndDiseases?.activeConditions?.length || 0) +
    (character.conditionsAndDiseases?.activeDiseases?.length || 0);

  const isConcentrating = character.concentration?.isConcentrating;
  const inspirationCount = character.heroicInspiration?.count || 0;
  const hasInspiration = inspirationCount > 0;
  const hasUsedReaction = character.reaction?.hasUsedReaction ?? false;

  // Class resource chips (capped to protect layout). Intentionally narrow
  // deps: only recompute when fields that affect resource maxima change.
  const classResourceChips = useMemo(
    () => getActiveClassResources(character).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      character.classes,
      character.class,
      character.level,
      character.totalLevel,
      character.abilities,
      character.classResources,
    ]
  );

  const activeBuffs = (character.temporaryBuffs || []).filter(b => b.isActive);
  const activeBuffCount = activeBuffs.length;

  const hasContextualIndicators =
    isConcentrating || activeConditionsCount > 0 || activeBuffCount > 0;

  return (
    <div className="border-divider bg-surface-raised mx-auto mb-4 max-w-7xl rounded-xl border p-4 shadow-sm">
      {/* Row 1: Stats + Status Indicators */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary Stats */}
        <div className="flex flex-wrap items-stretch gap-2">
          {/* HP */}
          <HudHitPoints
            characterId={character.id}
            current={character.hitPoints.current}
            max={character.hitPoints.max}
            temporary={character.hitPoints.temporary}
            onClick={onNavigateToCombat}
          />

          {/* AC */}
          <HudStat caption="AC" onClick={onNavigateToCombat}>
            <AcShield value={totalAC} />
          </HudStat>

          {/* Initiative */}
          <HudStat
            caption="Initiative"
            value={formatModifier(initiativeModifier)}
          />

          {/* Speed */}
          <SpeedChip
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />

          {/* Proficiency Bonus */}
          <HudStat
            caption="Proficiency"
            value={formatModifier(proficiencyBonus)}
          />

          {/* Spell Attack - conditional */}
          {spellAttackBonus !== null && (
            <HudStat
              caption="Spell attack"
              value={formatModifier(spellAttackBonus)}
              onClick={onNavigateToSpells}
            />
          )}

          {/* Spell Save DC - conditional */}
          {spellSaveDC !== null && (
            <HudStat
              caption="Spell save DC"
              value={String(spellSaveDC)}
              onClick={onNavigateToSpells}
            />
          )}
        </div>

        {/* Contextual Indicators */}
        {hasContextualIndicators && (
          <div className="border-divider flex flex-wrap items-center gap-2 border-l pl-3 pointer-coarse:gap-x-3 pointer-coarse:gap-y-6">
            {isConcentrating && (
              <ConditionChip
                kind="concentration"
                name={`Concentrating on ${character.concentration.spellName || 'spell'}`}
                onRemove={onStopConcentration}
              />
            )}

            {activeConditionsCount > 0 && (
              <button
                type="button"
                onClick={onNavigateToConditions}
                aria-label={
                  activeConditionsCount === 1
                    ? '1 condition. Open the Combat tab'
                    : `${activeConditionsCount} conditions. Open the Combat tab`
                }
                className={cn(
                  badgeVariants({ variant: 'warning' }),
                  'hover:bg-surface-hover focus-visible:outline-ring min-h-6 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11'
                )}
              >
                <AlertCircle className="size-3.5" aria-hidden="true" />
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

        {/* Class resource chips */}
        {onUseClassResource &&
          onRestoreClassResource &&
          classResourceChips.map(resource => {
            const Icon = CLASS_RESOURCE_ICONS[resource.definition.icon];
            const colors = CLASS_RESOURCE_COLORS[resource.definition.color];
            const isPool = resource.definition.displayStyle === 'pool';
            const hasUses = resource.usesRemaining > 0;
            return (
              <button
                key={resource.definition.id}
                onClick={
                  isPool
                    ? undefined
                    : hasUses
                      ? () => onUseClassResource(resource.definition.id)
                      : () => onRestoreClassResource(resource.definition.id)
                }
                aria-disabled={isPool || undefined}
                className={`relative rounded-lg border px-2.5 py-2 transition-colors ${
                  hasUses
                    ? colors.chipOn
                    : 'border-divider text-muted hover:bg-surface-hover'
                } ${isPool ? 'cursor-default' : ''}`}
                title={
                  isPool
                    ? `${resource.definition.name}: ${resource.usesRemaining}/${resource.maxUses} (manage in Actions tab)`
                    : hasUses
                      ? `Expend ${resource.definition.name} (${resource.usesRemaining}/${resource.maxUses})`
                      : `Restore ${resource.definition.name} (0/${resource.maxUses})`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="bg-surface-elevated text-heading border-divider absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-0.5 text-[10px] font-bold">
                  {resource.usesRemaining}
                </span>
              </button>
            );
          })}

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
    <div className="relative flex" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="border-divider hover:bg-surface-hover focus-visible:outline-ring flex cursor-pointer flex-col items-center justify-center rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        title="Click to edit speeds"
      >
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="flex items-baseline">
            <span className="type-num-lg text-heading">
              {character.speed + getBuffSpeedBonus(character)}
            </span>
            <span className="type-small text-muted">ft</span>
          </span>
          {hasExtraSpeeds && (
            <span className="type-caption text-muted flex items-center gap-1">
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
            </span>
          )}
        </span>{' '}
        <span className="type-caption text-muted whitespace-nowrap">Speed</span>
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
        <NumberField
          value={value}
          onChange={v => onChange(Math.max(0, v ?? 0))}
          min={0}
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
        className="bg-accent-blue-bg text-accent-blue-text flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:opacity-80 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
