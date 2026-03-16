'use client';

import { useState } from 'react';
import { Sparkles, X, Zap } from 'lucide-react';
import type { DmEffect } from '@/types/sharedState';

interface DmEffectsNotificationProps {
  effects: DmEffect[];
  onDismiss: () => void;
}

export function DmEffectsNotification({
  effects,
  onDismiss,
}: DmEffectsNotificationProps) {
  const [animatingOut, setAnimatingOut] = useState(false);

  const additions = effects.filter(e => e.action === 'add');
  if (additions.length === 0) return null;

  const handleDismiss = () => {
    setAnimatingOut(true);
    setTimeout(() => onDismiss(), 300);
  };

  const label =
    additions.length === 1
      ? additions[0].name
      : additions.map(e => e.name).join(', ');

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 w-80 sm:w-96">
      <div
        className={`pointer-events-auto rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl shadow-amber-200/40 transition-all duration-300 dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-100 dark:shadow-amber-900/30 ${
          animatingOut
            ? 'translate-x-full opacity-0'
            : 'animate-in slide-in-from-right-full translate-x-0 opacity-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 animate-pulse rounded-full bg-amber-200 p-1.5 text-amber-700 dark:bg-amber-800 dark:text-amber-300">
              <Zap size={14} />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                DM applied {additions.length === 1 ? 'an effect' : 'effects'}
              </p>
              <p className="mt-0.5 text-sm font-bold text-amber-900 dark:text-amber-100">
                {label}
              </p>
              {additions.length === 1 && additions[0].sourceSpell && (
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  Source: {additions[0].sourceSpell}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded p-0.5 text-amber-400 transition-colors hover:bg-amber-200 hover:text-amber-700 dark:text-amber-500 dark:hover:bg-amber-800 dark:hover:text-amber-200"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          <Sparkles size={10} className="mr-1 inline" />
          Added to your conditions
        </p>
      </div>
    </div>
  );
}
