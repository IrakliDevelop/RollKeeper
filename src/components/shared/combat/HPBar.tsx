'use client';

import React from 'react';

import { getHpBarColor } from '@/utils/hpColor';

interface HPBarProps {
  current: number;
  max: number;
  temp?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function HPBar({
  current,
  max,
  temp = 0,
  showLabel = true,
  size = 'md',
  className = '',
}: HPBarProps) {
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const colorClass = getHpBarColor(current, max);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        data-hp-track
        className={`bg-surface-inset flex-1 overflow-hidden rounded-sm ${sizeMap[size]}`}
      >
        <div
          className={`${sizeMap[size]} rounded-sm transition-all duration-300 ${colorClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-body min-w-fit text-xs font-medium tabular-nums">
          {current}/{max}
          {temp > 0 && (
            <span className="text-frost-text ml-1">+{temp} temp HP</span>
          )}
        </span>
      )}
    </div>
  );
}
