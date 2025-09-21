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
  onUpdateHitPoints: (updates: Partial<HitPoints>) => void;
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
      readonly={false}
      compact={false}
      showControls={true}
      showDeathSaves={true}
      showCalculationInfo={true}
      hideLabels={false}
      className={className}
    />
  );
}
