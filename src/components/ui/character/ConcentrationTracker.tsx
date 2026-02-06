'use client';

import React from 'react';
import { Eye, X, Clock } from 'lucide-react';
import { ConcentrationState } from '@/types/character';

interface ConcentrationTrackerProps {
  concentration: ConcentrationState;
  onStopConcentration: () => void;
  className?: string;
}

export default function ConcentrationTracker({
  concentration,
  onStopConcentration,
  className = '',
}: ConcentrationTrackerProps) {
  if (!concentration.isConcentrating) {
    return null;
  }

  // Calculate duration if startedAt is available
  const getDuration = () => {
    if (!concentration.startedAt) return '';

    const start = new Date(concentration.startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (diffMinutes > 0) {
      return `${diffMinutes}m ${diffSeconds}s`;
    }
    return `${diffSeconds}s`;
  };

  return (
    <div
      className={`border-accent-amber-border from-accent-amber-bg to-accent-amber-bg-strong rounded-lg border bg-gradient-to-r p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Eye className="text-accent-amber-text-muted" size={20} />
            <div>
              <h3 className="text-accent-amber-text font-semibold">
                Concentrating
              </h3>
              <div className="text-accent-amber-text-muted flex items-center gap-2 text-sm">
                <span className="font-medium">{concentration.spellName}</span>
                {concentration.castAt && concentration.castAt > 0 && (
                  <>
                    <span>•</span>
                    <span>Level {concentration.castAt}</span>
                  </>
                )}
                {concentration.startedAt && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{getDuration()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onStopConcentration}
          className="border-accent-amber-border-strong bg-accent-amber-bg-strong text-accent-amber-text-muted hover:bg-accent-amber-bg-strong/80 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
          title="End concentration"
        >
          <X size={14} />
          End
        </button>
      </div>

      <div className="bg-accent-amber-bg-strong text-accent-amber-text-muted mt-3 rounded-md px-3 py-2 text-xs">
        <p className="mb-1 font-medium">Concentration Rules:</p>
        <ul className="text-accent-amber-text-muted space-y-1">
          <li>• Taking damage may require a Constitution saving throw</li>
          <li>• Casting another concentration spell ends this one</li>
          <li>• Being incapacitated or killed ends concentration</li>
        </ul>
      </div>
    </div>
  );
}
