'use client';

import { useState } from 'react';
import { Angry, X } from 'lucide-react';

interface DmCounterNotificationProps {
  label: string;
  value: number;
  delta: number;
  onDismiss: () => void;
}

export function DmCounterNotification({
  label,
  value,
  delta,
  onDismiss,
}: DmCounterNotificationProps) {
  const [animatingOut, setAnimatingOut] = useState(false);

  const handleDismiss = () => {
    setAnimatingOut(true);
    setTimeout(() => onDismiss(), 300);
  };

  const increased = delta > 0;

  return (
    <div className="contents">
      <div
        className={`border-divider bg-surface-elevated text-body pointer-events-auto rounded-md border p-4 transition-opacity duration-300 ${animatingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <Angry size={14} className="text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-muted text-xs font-medium">{label}</p>
              <p className="text-heading mt-0.5 text-sm font-bold">
                {increased
                  ? `+${delta} — now at ${value}`
                  : `${delta} — now at ${value}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted hover:text-heading shrink-0 rounded-sm p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            title="Dismiss"
            aria-label="Dismiss DM counter notification"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-muted mt-2 text-xs">Updated by your DM</p>
      </div>
    </div>
  );
}
