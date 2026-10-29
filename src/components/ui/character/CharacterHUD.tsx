'use client';

import React, { useState, useMemo } from 'react';
import {
  ClockAlert,
  Zap,
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
import * as Popover from '@radix-ui/react-popover';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { SpeedEditor } from './SpeedEditor';
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
  /**
   * Sheet mode: false shows the speed as a plain tile (no popover). Defaults
   * to true (editable) for callers outside the character sheet.
   */
  editing?: boolean;
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
  editing = true,
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
    <div className="mx-auto mb-4 max-w-7xl">
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
            editing={editing}
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

            {/* Active buffs */}
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
        <Button
          type="button"
          size="sm"
          aria-label="Take a short rest"
          onClick={onShortRest}
          leftIcon={<Sun className="size-4" aria-hidden />}
        >
          <span className="hidden sm:inline">Short</span>
        </Button>
        <Button
          type="button"
          size="sm"
          aria-label="Take a long rest"
          onClick={onLongRest}
          leftIcon={<Moon className="size-4" aria-hidden />}
        >
          <span className="hidden sm:inline">Long</span>
        </Button>
        <div className="text-muted flex items-center gap-1">
          {calendarDays == null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Go back a day"
              onClick={onDecrementDays}
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>
          )}
          <span className="type-ui min-w-12 text-center">
            Day {(calendarDays ?? character.daysSpent ?? 0) + 1}
          </span>
          {calendarDays == null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Advance a day"
              onClick={onIncrementDays}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        <Button
          type="button"
          size="sm"
          selected={hasInspiration}
          onClick={onToggleInspiration}
          className="relative"
          aria-label={
            hasInspiration
              ? `Use heroic inspiration (${inspirationCount} left)`
              : 'Gain heroic inspiration'
          }
        >
          <Sun className="size-4" aria-hidden />
          {inspirationCount > 1 && (
            <span className="type-caption bg-brass-fill text-on-brass absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full">
              {inspirationCount}
            </span>
          )}
        </Button>

        {/* Class resource chips */}
        {onUseClassResource &&
          onRestoreClassResource &&
          classResourceChips.map(resource => {
            const Icon = CLASS_RESOURCE_ICONS[resource.definition.icon];
            const colors = CLASS_RESOURCE_COLORS[resource.definition.color];
            const isPool = resource.definition.displayStyle === 'pool';
            const hasUses = resource.usesRemaining > 0;
            return (
              <Button
                type="button"
                size="sm"
                key={resource.definition.id}
                onClick={
                  isPool
                    ? undefined
                    : hasUses
                      ? () => onUseClassResource(resource.definition.id)
                      : () => onRestoreClassResource(resource.definition.id)
                }
                aria-disabled={isPool || undefined}
                className={`relative ${
                  hasUses
                    ? colors.chipOn
                    : 'border-divider text-muted hover:bg-surface-hover'
                } ${isPool ? 'cursor-default' : ''}`}
                aria-label={
                  isPool
                    ? `${resource.definition.name}: ${resource.usesRemaining} of ${resource.maxUses}. Change it on the Actions tab.`
                    : hasUses
                      ? `Spend 1 ${resource.definition.name} (${resource.usesRemaining} of ${resource.maxUses} left)`
                      : `Restore 1 ${resource.definition.name}`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="bg-surface-elevated text-heading border-divider absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-0.5 text-[10px] font-bold">
                  {resource.usesRemaining}
                </span>
              </Button>
            );
          })}

        <Button
          type="button"
          size="sm"
          onClick={onToggleReaction}
          aria-label="Reaction used"
          aria-pressed={hasUsedReaction}
          className={
            hasUsedReaction
              ? 'border-input-border bg-surface-inset text-heading'
              : ''
          }
        >
          <ClockAlert className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function SpeedChip({
  character,
  editing,
  onUpdateCharacter,
}: {
  character: CharacterState;
  editing: boolean;
  onUpdateCharacter?: (updates: Partial<CharacterState>) => void;
}) {
  const hasExtraSpeeds = !!(
    character.flySpeed ||
    character.climbSpeed ||
    character.swimSpeed
  );
  const valueLine = (
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
    </span>
  );

  if (!editing || !onUpdateCharacter)
    return <HudStat caption="Speed">{valueLine}</HudStat>;
  return (
    <SpeedEditor
      character={character}
      onSave={onUpdateCharacter}
      trigger={
        <button
          type="button"
          aria-label="Edit speeds"
          className="border-divider hover:bg-surface-hover focus-visible:outline-ring flex cursor-pointer flex-col items-center justify-center rounded-sm border px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          {valueLine}{' '}
          <span className="type-caption text-muted whitespace-nowrap">
            Speed
          </span>
        </button>
      }
    />
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

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={
            buffs.length === 1
              ? '1 active buff'
              : `${buffs.length} active buffs`
          }
        >
          <Zap className="size-3.5" aria-hidden />
          <span>{buffs.length}</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label="Active buffs"
          align="end"
          sideOffset={8}
          className={`${OVERLAY_SURFACE} z-50 w-64 max-w-[calc(100vw-1rem)] p-3`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="type-label-heading text-heading">
              Active buffs
            </span>
            {onNavigate && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  onNavigate();
                  setIsOpen(false);
                }}
              >
                Manage buffs
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {buffs.map(buff => (
              <div
                key={buff.id}
                className="flex items-center justify-between gap-2 py-2 pointer-coarse:min-h-11"
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(buff.id)}
                    className="text-muted hover:text-blood-text shrink-0"
                    aria-label={`Deactivate ${buff.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
