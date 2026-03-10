'use client';

import React from 'react';

interface HPBarProps {
  current: number;
  max: number;
  temp?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getHPColorClass(percent: number): string {
  if (percent <= 0) return 'bg-surface-secondary';
  if (percent <= 25) return 'bg-accent-red-bg-strong';
  if (percent <= 50) return 'bg-accent-amber-bg-strong';
  return 'bg-accent-emerald-bg-strong';
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
  const colorClass = getHPColorClass(clampedPercent);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`bg-surface-secondary flex-1 overflow-hidden rounded-full ${sizeMap[size]}`}
      >
        <div
          className={`${sizeMap[size]} rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-body min-w-fit text-xs font-medium tabular-nums">
          {current}/{max}
          {temp > 0 && (
            <span className="text-accent-blue-text ml-0.5">+{temp}</span>
          )}
        </span>
      )}
    </div>
  );
}
