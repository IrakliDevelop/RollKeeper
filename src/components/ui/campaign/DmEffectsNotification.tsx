'use client';

import { useState } from 'react';
import { X, Zap } from 'lucide-react';
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
    <div className="contents">
      <div
        className={`border-divider bg-surface-elevated text-body pointer-events-auto rounded-md border p-4 transition-opacity duration-300 ${animatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <Zap size={14} className="text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-muted text-xs font-medium">
                DM applied {additions.length === 1 ? 'an effect' : 'effects'}
              </p>
              <p className="text-heading mt-0.5 text-sm font-bold">{label}</p>
              {additions.length === 1 && additions[0].sourceSpell && (
                <p className="text-muted mt-0.5 text-xs">
                  Source: {additions[0].sourceSpell}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted hover:text-heading shrink-0 rounded-sm p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            title="Dismiss"
            aria-label={`Dismiss ${label} notice`}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-muted mt-2 text-xs">Added to your conditions</p>
      </div>
    </div>
  );
}
