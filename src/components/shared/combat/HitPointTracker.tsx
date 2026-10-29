'use client';

import React, { useState } from 'react';
import { HitPoints, ClassInfo } from '@/types/character';
import { isDying, isDead, isStabilized } from '@/utils/hpCalculations';
import {
  getHpNumberColor,
  getHpBarColor,
  getHpTierTextColor,
} from '@/utils/hpColor';
import { HP_STATUS_LABELS, hpStatus, hpPercent, hpTier } from '@/utils/hpState';
import { Button } from '@/components/ui/forms';
import { NumberField } from '@/components/ui/forms/NumberInput';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';
import { Section } from '@/components/ui/layout/section';

interface HitPointTrackerProps {
  hitPoints: HitPoints;
  classInfo?: ClassInfo;
  level?: number;
  constitutionScore?: number;
  onApplyDamage?: (damage: number) => void;
  onApplyHealing?: (healing: number) => void;
  onAddTemporaryHP?: (tempHP: number) => void;
  onMakeDeathSave?: (isSuccess: boolean, isCritical?: boolean) => void;
  onResetDeathSaves?: () => void;
  onToggleCalculationMode?: () => void;
  onRecalculateMaxHP?: () => void;
  onUpdateHitPoints?: (updates: Partial<HitPoints>) => void;

  onSetCurrentHitPoints?: (value: number) => void;
  editing?: boolean;
  showDeathSaves?: boolean;

  className?: string;
}

export function HitPointTracker({
  hitPoints,
  onApplyDamage,
  onApplyHealing,
  onAddTemporaryHP,
  onMakeDeathSave,
  onResetDeathSaves,
  onToggleCalculationMode,
  onUpdateHitPoints,
  onSetCurrentHitPoints,
  editing = true,
  showDeathSaves = true,
  className = '',
}: HitPointTrackerProps) {
  const [damageAmount, setDamageAmount] = useState<number | undefined>(
    undefined
  );
  const [healingAmount, setHealingAmount] = useState<number | undefined>(
    undefined
  );
  const [tempHPAmount, setTempHPAmount] = useState<number | undefined>(
    undefined
  );

  const isCharacterDying = isDying(hitPoints);
  const isCharacterDead = isDead(hitPoints);
  const isCharacterStabilized = isStabilized(hitPoints);

  const handleDamage = () => {
    if (damageAmount != null && damageAmount > 0 && onApplyDamage) {
      onApplyDamage(damageAmount);
      setDamageAmount(undefined);
    }
  };

  const handleHealing = () => {
    if (healingAmount != null && healingAmount > 0 && onApplyHealing) {
      onApplyHealing(healingAmount);
      setHealingAmount(undefined);
    }
  };

  const handleTempHP = () => {
    if (tempHPAmount != null && tempHPAmount > 0 && onAddTemporaryHP) {
      onAddTemporaryHP(tempHPAmount);
      setTempHPAmount(undefined);
    }
  };

  const handleAddSuccess = () => {
    if (
      onMakeDeathSave &&
      hitPoints.deathSaves &&
      hitPoints.deathSaves.successes < 3
    ) {
      onMakeDeathSave(true, false);
    }
  };

  const handleRemoveSuccess = () => {
    if (
      onUpdateHitPoints &&
      hitPoints.deathSaves &&
      hitPoints.deathSaves.successes > 0
    ) {
      onUpdateHitPoints({
        deathSaves: {
          ...hitPoints.deathSaves,
          successes: hitPoints.deathSaves.successes - 1,
          isStabilized: false, // No longer stabilized if removing a success
        },
      });
    }
  };

  const handleAddFailure = () => {
    if (
      onMakeDeathSave &&
      hitPoints.deathSaves &&
      hitPoints.deathSaves.failures < 3
    ) {
      onMakeDeathSave(false, false);
    }
  };

  const handleRemoveFailure = () => {
    if (
      onUpdateHitPoints &&
      hitPoints.deathSaves &&
      hitPoints.deathSaves.failures > 0
    ) {
      onUpdateHitPoints({
        deathSaves: {
          ...hitPoints.deathSaves,
          failures: hitPoints.deathSaves.failures - 1,
        },
      });
    }
  };

  const handleCriticalSuccess = () => {
    if (onMakeDeathSave) {
      onMakeDeathSave(true, true);
    }
  };

  const tier = hpTier(hpPercent(hitPoints.current, hitPoints.max));
  const status = isCharacterDead
    ? 'Dead'
    : isCharacterDying
      ? 'Dying'
      : isCharacterStabilized
        ? 'Stabilized'
        : HP_STATUS_LABELS[hpStatus(hitPoints.current, hitPoints.max)];
  const mode = hitPoints.calculationMode ?? 'auto';
  return (
    <Section
      heading="Hit points"
      level={3}
      className={className}
      trailing={
        <span
          className={`type-ui ${isCharacterStabilized ? 'text-ember-text' : getHpTierTextColor(tier)}`}
        >
          {status}
        </span>
      }
    >
      <div
        data-hp-status={hpStatus(hitPoints.current, hitPoints.max)}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-4">
          <span
            className={`type-num-xl ${getHpNumberColor(hitPoints.current, hitPoints.max)}`}
          >
            <InPlaceField
              label="Current HP"
              value={hitPoints.current}
              editing
              min={0}
              max={hitPoints.max}
              onCommit={value => onSetCurrentHitPoints?.(value)}
            />
          </span>
          <span className="type-num-lg text-body">
            /{' '}
            <InPlaceField
              label="Max HP"
              value={hitPoints.max}
              editing={editing && mode === 'manual'}
              min={1}
              onCommit={max => onUpdateHitPoints?.({ max })}
            />
          </span>
          <span className="type-num-md text-frost-text">
            +
            <InPlaceField
              label="Temp HP"
              value={hitPoints.temporary}
              editing
              min={0}
              onCommit={temporary => onUpdateHitPoints?.({ temporary })}
            />{' '}
            temp
          </span>
        </div>
        <div className="bg-divider h-1 w-full">
          <div
            className={`h-full ${getHpBarColor(hitPoints.current, hitPoints.max)}`}
            style={{ width: `${hpPercent(hitPoints.current, hitPoints.max)}%` }}
          />
        </div>
        <div className="type-small text-muted flex items-center gap-2">
          <span>Max: {mode === 'auto' ? 'Auto' : 'Manual'}</span>
          {editing && onToggleCalculationMode && (
            <Button
              size="sm"
              onClick={onToggleCalculationMode}
              aria-label={`Switch to ${mode === 'auto' ? 'manual' : 'auto'} calculation`}
            >
              {mode === 'auto' ? 'Manual' : 'Auto'}
            </Button>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="type-ui text-body block">
                Damage
                <NumberField
                  aria-label="Damage"
                  value={damageAmount}
                  onChange={setDamageAmount}
                  allowEmpty
                  min={1}
                  placeholder="8"
                  className="border-input-border bg-surface-inset text-heading mt-1 h-10 w-full rounded-sm border px-2 pointer-coarse:min-h-11 pointer-coarse:text-base"
                />
              </label>
            </div>
            <Button
              size="sm"
              aria-label="Halve damage (resistance)"
              onClick={() => {
                if (damageAmount != null && damageAmount > 0)
                  setDamageAmount(Math.floor(damageAmount / 2));
              }}
            >
              ½×
            </Button>
            <Button
              size="sm"
              aria-label="Double damage (vulnerability)"
              onClick={() => {
                if (damageAmount != null && damageAmount > 0)
                  setDamageAmount(damageAmount * 2);
              }}
            >
              2×
            </Button>
            <Button
              variant="danger"
              disabled={
                damageAmount == null || damageAmount <= 0 || !onApplyDamage
              }
              onClick={handleDamage}
            >
              Damage
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="type-ui text-body block">
                Healing
                <NumberField
                  aria-label="Healing"
                  value={healingAmount}
                  onChange={setHealingAmount}
                  allowEmpty
                  min={1}
                  placeholder="8"
                  className="border-input-border bg-surface-inset text-heading mt-1 h-10 w-full rounded-sm border px-2 pointer-coarse:min-h-11 pointer-coarse:text-base"
                />
              </label>
            </div>
            <Button
              disabled={
                healingAmount == null || healingAmount <= 0 || !onApplyHealing
              }
              onClick={handleHealing}
            >
              Heal
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="type-ui text-body block">
                Temp HP
                <NumberField
                  aria-label="Temp HP amount"
                  value={tempHPAmount}
                  onChange={setTempHPAmount}
                  allowEmpty
                  min={1}
                  placeholder="8"
                  className="border-input-border bg-surface-inset text-heading mt-1 h-10 w-full rounded-sm border px-2 pointer-coarse:min-h-11 pointer-coarse:text-base"
                />
              </label>
            </div>
            <Button
              disabled={
                tempHPAmount == null || tempHPAmount <= 0 || !onAddTemporaryHP
              }
              onClick={handleTempHP}
            >
              Add temp HP
            </Button>
          </div>
        </div>
        {showDeathSaves &&
          (isCharacterDying ||
            isCharacterStabilized ||
            hitPoints.deathSaves) && (
            <Section
              heading="Death saves"
              level={4}
              trailing={
                onResetDeathSaves && (
                  <Button
                    size="sm"
                    aria-label="Reset death saves"
                    onClick={onResetDeathSaves}
                  >
                    Reset
                  </Button>
                )
              }
            >
              <div className="space-y-3">
                {hitPoints.deathSaves &&
                  ([true, false] as const).map(success => {
                    const count = success
                      ? hitPoints.deathSaves!.successes
                      : hitPoints.deathSaves!.failures;
                    const noun = success ? 'success' : 'failure';
                    return (
                      <div
                        key={noun}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="type-ui text-body">
                          {success ? 'Successes' : 'Failures'}
                        </span>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(index => {
                            const marked = index < count;
                            return (
                              <button
                                key={index}
                                type="button"
                                aria-label={`${marked ? 'Clear' : 'Mark'} a death save ${noun}`}
                                disabled={
                                  !marked &&
                                  (!onMakeDeathSave ||
                                    isCharacterDead ||
                                    isCharacterStabilized)
                                }
                                onClick={
                                  marked
                                    ? success
                                      ? handleRemoveSuccess
                                      : handleRemoveFailure
                                    : success
                                      ? handleAddSuccess
                                      : handleAddFailure
                                }
                                className="focus-visible:outline-brass-border inline-flex size-6 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 pointer-coarse:size-11"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`size-3 rounded-full border ${success ? 'border-verdigris-border' : 'border-blood-border'} ${marked ? (success ? 'bg-verdigris-fill' : 'bg-blood-fill') : 'bg-transparent'}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {isCharacterDying && onMakeDeathSave && (
                  <Button onClick={handleCriticalSuccess}>
                    Natural 20: regain 1 HP
                  </Button>
                )}
                <div className="type-small text-muted space-y-1">
                  <p>Roll d20: 10 or higher = success, 9 or below = failure</p>
                  <p>Natural 20: regain 1 HP and become conscious</p>
                  <p>3 successes: stabilized but unconscious</p>
                  <p>3 failures: dead</p>
                </div>
              </div>
            </Section>
          )}
      </div>
    </Section>
  );
}
