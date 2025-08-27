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
  className = '' 
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
    <div className={`bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Eye className="text-orange-600" size={20} />
            <div>
              <h3 className="font-semibold text-orange-900">Concentrating</h3>
              <div className="flex items-center gap-2 text-sm text-orange-700">
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
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-lg transition-colors"
          title="End concentration"
        >
          <X size={14} />
          End
        </button>
      </div>
      
      <div className="mt-3 text-xs text-orange-600 bg-orange-100 rounded-md px-3 py-2">
        <p className="font-medium mb-1">Concentration Rules:</p>
        <ul className="space-y-1 text-orange-700">
          <li>• Taking damage may require a Constitution saving throw</li>
          <li>• Casting another concentration spell ends this one</li>
          <li>• Being incapacitated or killed ends concentration</li>
        </ul>
      </div>
    </div>
  );
} 