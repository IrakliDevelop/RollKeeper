'use client';

import React, { useState } from 'react';
import {
  Heart,
  Plus,
  Minus,
  RotateCcw,
  Calculator,
  Edit3,
  Skull,
  Shield,
  HelpCircle,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { HitPoints, ClassInfo } from '@/types/character';
import { isDying, isDead, isStabilized } from '@/utils/hpCalculations';
import { Button } from '@/components/ui/forms';

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

  // Display options
  readonly?: boolean;
  compact?: boolean;
  showControls?: boolean;
  showDeathSaves?: boolean;
  showCalculationInfo?: boolean;
  hideLabels?: boolean;

  className?: string;
}

export function HitPointTracker({
  hitPoints,
  classInfo,
  level,
  onApplyDamage,
  onApplyHealing,
  onAddTemporaryHP,
  onMakeDeathSave,
  onResetDeathSaves,
  onToggleCalculationMode,
  onUpdateHitPoints,
  readonly = false,
  compact = false,
  showControls = true,
  showDeathSaves = true,
  showCalculationInfo = true,
  hideLabels = false,
  className = '',
}: HitPointTrackerProps) {
  const [damageAmount, setDamageAmount] = useState('');
  const [healingAmount, setHealingAmount] = useState('');
  const [tempHPAmount, setTempHPAmount] = useState('');

  const isCharacterDying = isDying(hitPoints);
  const isCharacterDead = isDead(hitPoints);
  const isCharacterStabilized = isStabilized(hitPoints);
  const isUnconscious = hitPoints.current === 0;

  const handleDamage = () => {
    const damage = parseInt(damageAmount);
    if (!isNaN(damage) && damage > 0 && onApplyDamage) {
      onApplyDamage(damage);
      setDamageAmount('');
    }
  };

  const handleHealing = () => {
    const healing = parseInt(healingAmount);
    if (!isNaN(healing) && healing > 0 && onApplyHealing) {
      onApplyHealing(healing);
      setHealingAmount('');
    }
  };

  const handleTempHP = () => {
    const tempHP = parseInt(tempHPAmount);
    if (!isNaN(tempHP) && tempHP > 0 && onAddTemporaryHP) {
      onAddTemporaryHP(tempHP);
      setTempHPAmount('');
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

  const getStatusColor = () => {
    if (isCharacterDead) return 'text-inverse bg-gray-800';
    if (isCharacterDying) return 'text-accent-red-text bg-accent-red-bg';
    if (isCharacterStabilized)
      return 'text-accent-amber-text bg-accent-amber-bg';
    if (isUnconscious) return 'text-accent-orange-text bg-accent-orange-bg';
    if (hitPoints.current <= hitPoints.max * 0.25)
      return 'text-accent-red-text bg-accent-red-bg';
    if (hitPoints.current <= hitPoints.max * 0.5)
      return 'text-accent-amber-text bg-accent-amber-bg';
    return 'text-accent-green-text bg-accent-green-bg';
  };

  const getCurrentHPBoxColor = () => {
    if (isCharacterDead) return 'bg-gray-800 border-gray-900';
    if (isCharacterDying) return 'bg-accent-red-bg border-accent-red-border';
    if (isCharacterStabilized)
      return 'bg-accent-amber-bg border-accent-amber-border';
    if (isUnconscious) return 'bg-accent-orange-bg border-accent-orange-border';
    if (hitPoints.current <= hitPoints.max * 0.25)
      return 'bg-accent-red-bg border-accent-red-border';
    if (hitPoints.current <= hitPoints.max * 0.5)
      return 'bg-accent-amber-bg border-accent-amber-border';
    return 'bg-accent-green-bg border-accent-green-border';
  };

  const getCurrentHPTextColor = () => {
    if (isCharacterDead) return 'text-inverse';
    if (isCharacterDying) return 'text-accent-red-text';
    if (isCharacterStabilized) return 'text-accent-amber-text';
    if (isUnconscious) return 'text-accent-orange-text';
    if (hitPoints.current <= hitPoints.max * 0.25)
      return 'text-accent-red-text';
    if (hitPoints.current <= hitPoints.max * 0.5)
      return 'text-accent-amber-text';
    return 'text-accent-green-text';
  };

  const getStatusText = () => {
    if (isCharacterDead) return '💀 Dead';
    if (isCharacterDying) return '💔 Dying';
    if (isCharacterStabilized) return '😵 Stabilized';
    if (isUnconscious) return '😵 Unconscious';
    return '❤️ Alive';
  };

  const containerClasses = compact
    ? `bg-surface-raised rounded-lg shadow border border-accent-red-border p-3 space-y-3 ${className}`
    : `bg-surface-raised rounded-lg shadow-lg border border-accent-red-border p-6 space-y-6 ${className}`;

  const gridSizeClasses = compact ? 'gap-1 sm:gap-2' : 'gap-2 sm:gap-4';
  const minHeightClasses = compact
    ? 'min-h-[60px]'
    : 'min-h-[80px] sm:min-h-[90px]';

  return (
    <div className={containerClasses}>
      {!hideLabels && (
        <div className="flex items-center justify-between">
          <h3
            className={`${compact ? 'text-base' : 'text-lg'} text-accent-red-text flex items-center gap-2 font-semibold`}
          >
            <Heart size={compact ? 16 : 20} />
            Hit Points
          </h3>
          <div
            className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor()}`}
          >
            {getStatusText()}
          </div>
        </div>
      )}

      {/* HP Display */}
      <div className={`grid grid-cols-3 ${gridSizeClasses}`}>
        <div className="text-center">
          <div
            className={`rounded-lg border-2 p-2 ${compact ? 'sm:p-2' : 'sm:p-3'} transition-colors ${getCurrentHPBoxColor()} ${minHeightClasses} flex flex-col justify-center`}
          >
            <div
              className={`mb-1 text-xs font-medium ${getCurrentHPTextColor()}`}
            >
              CURRENT
            </div>
            {readonly ? (
              <div
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} font-bold ${getCurrentHPTextColor()}`}
              >
                {hitPoints.current}
              </div>
            ) : (
              <input
                type="number"
                value={hitPoints.current}
                onChange={e =>
                  onUpdateHitPoints?.({
                    current: parseInt(e.target.value) || 0,
                  })
                }
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} w-full border-none bg-transparent text-center font-bold outline-none ${getCurrentHPTextColor()} leading-tight`}
                min="0"
                max={hitPoints.max}
                style={{ maxWidth: '100%' }}
              />
            )}
          </div>
        </div>

        <div className="text-center">
          <div
            className={`border-accent-red-border bg-accent-red-bg rounded-lg border-2 p-2 ${compact ? 'sm:p-2' : 'sm:p-3'} relative ${minHeightClasses} flex flex-col justify-center`}
          >
            <div className="text-accent-red-text mb-1 flex items-center justify-center gap-1 text-xs font-medium">
              <span className="hidden sm:inline">MAXIMUM</span>
              <span className="sm:hidden">MAX</span>
              {!readonly && onToggleCalculationMode && (
                <button
                  onClick={onToggleCalculationMode}
                  className="text-accent-red-text-muted hover:text-accent-red-text transition-colors"
                  title={`Switch to ${hitPoints.calculationMode === 'auto' ? 'manual' : 'auto'} calculation`}
                >
                  {hitPoints.calculationMode === 'auto' ? (
                    <Calculator size={12} />
                  ) : (
                    <Edit3 size={12} />
                  )}
                </button>
              )}
            </div>
            {readonly ? (
              <div
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} text-accent-red-text font-bold`}
              >
                {hitPoints.max}
              </div>
            ) : (
              <input
                type="number"
                value={hitPoints.max}
                onChange={e =>
                  onUpdateHitPoints?.({ max: parseInt(e.target.value) || 0 })
                }
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} text-accent-red-text w-full border-none bg-transparent text-center leading-tight font-bold outline-none`}
                disabled={hitPoints.calculationMode === 'auto'}
                min="1"
                style={{ maxWidth: '100%' }}
              />
            )}
            {hitPoints.calculationMode === 'auto' && (
              <div className="absolute -top-1 -right-1">
                <div className="rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                  AUTO
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <div
            className={`border-accent-blue-border bg-accent-blue-bg rounded-lg border-2 p-2 ${compact ? 'sm:p-2' : 'sm:p-3'} ${minHeightClasses} flex flex-col justify-center`}
          >
            <div className="text-accent-blue-text mb-1 text-xs font-medium">
              <span>TEMP</span>
            </div>
            {readonly ? (
              <div
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} text-accent-blue-text font-bold`}
              >
                {hitPoints.temporary}
              </div>
            ) : (
              <input
                type="number"
                value={hitPoints.temporary}
                onChange={e =>
                  onUpdateHitPoints?.({
                    temporary: parseInt(e.target.value) || 0,
                  })
                }
                className={`${compact ? 'text-lg' : 'text-lg sm:text-xl'} text-accent-blue-text w-full border-none bg-transparent text-center leading-tight font-bold outline-none`}
                min="0"
                style={{ maxWidth: '100%' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* HP Management Actions */}
      {!readonly && showControls && (
        <div className="space-y-3">
          {/* Damage */}
          <div className="space-y-2">
            <label className="text-accent-red-text-muted block text-sm font-medium">
              Apply Damage
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={damageAmount}
                onChange={e => setDamageAmount(e.target.value)}
                placeholder="Amount"
                className="border-accent-red-border bg-surface-raised text-heading focus:border-accent-red-border-strong focus:ring-accent-red-bg-strong w-24 rounded-md border px-3 py-2 text-center focus:ring-2"
                min="1"
              />
              <button
                onClick={handleDamage}
                disabled={!damageAmount || parseInt(damageAmount) <= 0}
                className="disabled:bg-surface-hover disabled:text-muted flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed"
              >
                <Minus size={16} />
                Apply Damage
              </button>
            </div>
          </div>

          {/* Healing */}
          <div className="space-y-2">
            <label className="text-accent-green-text block text-sm font-medium">
              Apply Healing
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={healingAmount}
                onChange={e => setHealingAmount(e.target.value)}
                placeholder="Amount"
                className="border-accent-green-border bg-surface-raised text-heading focus:border-accent-green-border-strong focus:ring-accent-green-bg-strong w-24 rounded-md border px-3 py-2 text-center focus:ring-2"
                min="1"
              />
              <button
                onClick={handleHealing}
                disabled={!healingAmount || parseInt(healingAmount) <= 0}
                className="disabled:bg-surface-hover disabled:text-muted flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                Apply Healing
              </button>
            </div>
          </div>

          {/* Temporary HP */}
          <div className="space-y-2">
            <label className="text-accent-blue-text-muted block text-sm font-medium">
              Add Temporary HP
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={tempHPAmount}
                onChange={e => setTempHPAmount(e.target.value)}
                placeholder="Amount"
                className="border-accent-blue-border bg-surface-raised text-heading focus:border-accent-blue-border-strong focus:ring-accent-blue-bg-strong w-24 rounded-md border px-3 py-2 text-center focus:ring-2"
                min="1"
              />
              <button
                onClick={handleTempHP}
                disabled={!tempHPAmount || parseInt(tempHPAmount) <= 0}
                className="disabled:bg-surface-hover disabled:text-muted flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed"
              >
                <Shield size={16} />
                Add Temp HP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Death Saving Throws */}
      {showDeathSaves &&
        (isCharacterDying || isCharacterStabilized || hitPoints.deathSaves) && (
          <div className="border-divider from-surface-raised to-surface-secondary mt-4 rounded-xl border-2 bg-gradient-to-br p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 p-2 shadow-md">
                  <Skull size={18} className="text-white" />
                </div>
                <div>
                  <h4 className="text-heading text-lg font-bold">
                    Death Saving Throws
                  </h4>
                  {isCharacterStabilized && (
                    <span className="text-accent-amber-text text-xs font-medium">
                      Stabilized
                    </span>
                  )}
                  {isCharacterDead && (
                    <span className="text-accent-red-text-muted text-xs font-medium">
                      Dead
                    </span>
                  )}
                </div>
              </div>
              {!readonly && onResetDeathSaves && (
                <Button
                  onClick={onResetDeathSaves}
                  variant="ghost"
                  size="sm"
                  leftIcon={<RotateCcw size={14} />}
                  title="Reset death saves"
                >
                  Reset
                </Button>
              )}
            </div>

            {hitPoints.deathSaves && (
              <div className="space-y-3">
                {/* Success/Failure Interactive Display - Stacked vertically */}
                <div className="space-y-3">
                  {/* Successes */}
                  <div className="border-accent-green-border bg-accent-green-bg rounded-lg border-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex w-24 shrink-0 items-center gap-2">
                        <Check
                          size={16}
                          className="text-accent-green-text shrink-0"
                        />
                        <span className="text-accent-green-text text-sm font-semibold">
                          Successes
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3].map(i => {
                          const isFilled = i <= hitPoints.deathSaves!.successes;
                          const isNextEmpty =
                            i === hitPoints.deathSaves!.successes + 1;
                          const isLastFilled =
                            isFilled && i === hitPoints.deathSaves!.successes;
                          const canAdd =
                            !readonly &&
                            isCharacterDying &&
                            onMakeDeathSave &&
                            isNextEmpty;
                          const canRemove =
                            !readonly && onUpdateHitPoints && isLastFilled;
                          const canClick = canAdd || canRemove;

                          return (
                            <button
                              key={i}
                              onClick={
                                canAdd
                                  ? handleAddSuccess
                                  : canRemove
                                    ? handleRemoveSuccess
                                    : undefined
                              }
                              disabled={!canClick}
                              className={`relative h-9 w-9 rounded-full border-2 transition-all duration-200 ${
                                isFilled
                                  ? 'border-green-500 bg-green-500 shadow-md'
                                  : 'border-accent-green-border-strong bg-surface-raised'
                              } ${
                                canAdd
                                  ? 'hover:bg-accent-green-bg-strong cursor-pointer hover:scale-110 hover:border-green-500 hover:shadow-lg active:scale-95'
                                  : canRemove
                                    ? 'cursor-pointer hover:scale-110 hover:border-green-600 hover:bg-green-600 hover:shadow-lg active:scale-95'
                                    : 'cursor-default'
                              } `}
                              title={
                                canAdd
                                  ? 'Click to add success'
                                  : canRemove
                                    ? 'Click to undo success'
                                    : undefined
                              }
                            >
                              {isFilled && (
                                <Check
                                  size={18}
                                  className="absolute inset-0 m-auto text-white"
                                />
                              )}
                              {canAdd && !isFilled && (
                                <span className="text-accent-green-text absolute inset-0 m-auto flex h-full w-full items-center justify-center opacity-50">
                                  <Check size={14} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Failures */}
                  <div className="border-accent-red-border bg-accent-red-bg rounded-lg border-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex w-24 shrink-0 items-center gap-2">
                        <X
                          size={16}
                          className="text-accent-red-text-muted shrink-0"
                        />
                        <span className="text-accent-red-text-muted text-sm font-semibold">
                          Failures
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3].map(i => {
                          const isFilled = i <= hitPoints.deathSaves!.failures;
                          const isNextEmpty =
                            i === hitPoints.deathSaves!.failures + 1;
                          const isLastFilled =
                            isFilled && i === hitPoints.deathSaves!.failures;
                          const canAdd =
                            !readonly &&
                            isCharacterDying &&
                            onMakeDeathSave &&
                            isNextEmpty;
                          const canRemove =
                            !readonly && onUpdateHitPoints && isLastFilled;
                          const canClick = canAdd || canRemove;

                          return (
                            <button
                              key={i}
                              onClick={
                                canAdd
                                  ? handleAddFailure
                                  : canRemove
                                    ? handleRemoveFailure
                                    : undefined
                              }
                              disabled={!canClick}
                              className={`relative h-9 w-9 rounded-full border-2 transition-all duration-200 ${
                                isFilled
                                  ? 'border-red-500 bg-red-500 shadow-md'
                                  : 'border-accent-red-border-strong bg-surface-raised'
                              } ${
                                canAdd
                                  ? 'hover:bg-accent-red-bg-strong cursor-pointer hover:scale-110 hover:border-red-500 hover:shadow-lg active:scale-95'
                                  : canRemove
                                    ? 'cursor-pointer hover:scale-110 hover:border-red-600 hover:bg-red-600 hover:shadow-lg active:scale-95'
                                    : 'cursor-default'
                              } `}
                              title={
                                canAdd
                                  ? 'Click to add failure'
                                  : canRemove
                                    ? 'Click to undo failure'
                                    : undefined
                              }
                            >
                              {isFilled && (
                                <X
                                  size={18}
                                  className="absolute inset-0 m-auto text-white"
                                />
                              )}
                              {canAdd && !isFilled && (
                                <span className="text-accent-red-text-muted absolute inset-0 m-auto flex h-full w-full items-center justify-center opacity-50">
                                  <X size={14} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Critical Success Button */}
                {!readonly && isCharacterDying && onMakeDeathSave && (
                  <div className="flex justify-center">
                    <Button
                      onClick={handleCriticalSuccess}
                      variant="warning"
                      size="sm"
                      leftIcon={<Sparkles size={16} />}
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-white shadow-md hover:from-amber-600 hover:to-yellow-600"
                    >
                      Natural 20! (Regain 1 HP)
                    </Button>
                  </div>
                )}

                {/* Help Info */}
                <div className="border-divider bg-surface-raised rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <HelpCircle
                      size={14}
                      className="text-faint mt-0.5 shrink-0"
                    />
                    <div className="text-muted space-y-0.5 text-xs">
                      <p>
                        <span className="font-medium">Roll d20:</span> 10+ =
                        Success, 9 or below = Failure
                      </p>
                      <p>
                        <span className="text-accent-amber-text font-medium">
                          Natural 20:
                        </span>{' '}
                        Regain 1 HP and become conscious
                      </p>
                      <p>
                        <span className="text-accent-green-text font-medium">
                          3 Successes:
                        </span>{' '}
                        Stabilized but unconscious
                      </p>
                      <p>
                        <span className="text-accent-red-text-muted font-medium">
                          3 Failures:
                        </span>{' '}
                        Dead
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* HP Calculation Mode Info */}
      {showCalculationInfo && classInfo && level && !compact && (
        <div className="border-divider border-t pt-4">
          <div className="flex items-start gap-3">
            <HelpCircle size={16} className="text-muted mt-0.5" />
            <div className="text-muted space-y-1 text-xs">
              <p>
                <strong>Auto Mode:</strong> Max HP calculated using D&D 5e rules
                (Level 1: full hit die + CON, subsequent levels: average hit die
                + CON)
              </p>
              <p>
                <strong>Manual Mode:</strong> Set your own maximum HP value
              </p>
              {hitPoints.calculationMode === 'auto' && (
                <p className="text-accent-blue-text-muted">
                  Current calculation: Level {level} {classInfo.name} ={' '}
                  {hitPoints.max} HP
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
