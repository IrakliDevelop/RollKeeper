'use client';

import React from 'react';
import { HitPoints, ClassInfo } from '@/types/character';
import { HitPointTracker } from '@/components/shared/combat';

interface HitPointManagerProps {
  hitPoints: HitPoints;
  classInfo: ClassInfo;
  level: number;
  constitutionScore: number;
  onApplyDamage: (damage: number) => void;
  onApplyHealing: (healing: number) => void;
  onAddTemporaryHP: (tempHP: number) => void;
  onMakeDeathSave: (isSuccess: boolean, isCritical?: boolean) => void;
  onResetDeathSaves: () => void;
  onToggleCalculationMode: () => void;
  onRecalculateMaxHP: () => void;
  onSetCurrentHitPoints: (value: number) => void;
  onUpdateHitPoints: (updates: Partial<HitPoints>) => void;
  /** Sheet mode: false shows the build values as plain text. Defaults to true (editable) for callers outside the character sheet. */
  editing?: boolean;
  className?: string;
}

export default function HitPointManager({
  hitPoints,
  classInfo,
  level,
  constitutionScore,
  onApplyDamage,
  onApplyHealing,
  onAddTemporaryHP,
  onMakeDeathSave,
  onResetDeathSaves,
  onToggleCalculationMode,
  onRecalculateMaxHP,
  onUpdateHitPoints,
  onSetCurrentHitPoints,
  editing = true,
  className = '',
}: HitPointManagerProps) {
  // Use the shared HitPointTracker component with full functionality
  return (
    <HitPointTracker
      hitPoints={hitPoints}
      classInfo={classInfo}
      level={level}
      constitutionScore={constitutionScore}
      onApplyDamage={onApplyDamage}
      onApplyHealing={onApplyHealing}
      onAddTemporaryHP={onAddTemporaryHP}
      onMakeDeathSave={onMakeDeathSave}
      onResetDeathSaves={onResetDeathSaves}
      onToggleCalculationMode={onToggleCalculationMode}
      onRecalculateMaxHP={onRecalculateMaxHP}
      onUpdateHitPoints={onUpdateHitPoints}
      onSetCurrentHitPoints={onSetCurrentHitPoints}
      editing={editing}
      showDeathSaves={true}
      className={className}
    />
  );
}
