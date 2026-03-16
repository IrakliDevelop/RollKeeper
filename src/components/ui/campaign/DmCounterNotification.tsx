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
    <div className="pointer-events-none fixed top-20 right-4 z-50 w-80 sm:w-96">
      <div
        className={`pointer-events-auto rounded-lg border border-purple-300 bg-purple-50 p-4 text-purple-950 shadow-xl shadow-purple-200/40 transition-all duration-300 dark:border-purple-700 dark:bg-purple-950/90 dark:text-purple-100 dark:shadow-purple-900/30 ${
          animatingOut
            ? 'translate-x-full opacity-0'
            : 'animate-in slide-in-from-right-full translate-x-0 opacity-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 animate-pulse rounded-full bg-purple-200 p-1.5 text-purple-700 dark:bg-purple-800 dark:text-purple-300">
              <Angry size={14} />
            </div>
            <div>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold text-purple-900 dark:text-purple-100">
                {increased
                  ? `+${delta} — now at ${value}`
                  : `${delta} — now at ${value}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded p-0.5 text-purple-400 transition-colors hover:bg-purple-200 hover:text-purple-700 dark:text-purple-500 dark:hover:bg-purple-800 dark:hover:text-purple-200"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
          <Angry size={10} className="mr-1 inline" />
          Updated by your DM
        </p>
      </div>
    </div>
  );
}
