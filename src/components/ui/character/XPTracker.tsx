'use client';

import React from 'react';
import { XPTracker as SharedXPTracker } from '@/components/shared/character';

interface XPTrackerProps {
  currentXP: number;
  currentLevel: number;
  onAddXP: (xpToAdd: number) => void;
  onSetXP: (newXP: number) => void;
  className?: string;
}

export default function XPTracker({
  currentXP,
  currentLevel,
  onAddXP,
  onSetXP,
  className = ''
}: XPTrackerProps) {
  // Use the shared XPTracker component with full functionality
  return (
    <SharedXPTracker
      currentXP={currentXP}
      currentLevel={currentLevel}
      onAddXP={onAddXP}
      onSetXP={onSetXP}
      readonly={false}
      compact={false}
      hideControls={false}
      hideProgressBar={false}
      hideLevelUpAlert={false}
      hideThresholds={false}
      className={className}
    />
  );
} 