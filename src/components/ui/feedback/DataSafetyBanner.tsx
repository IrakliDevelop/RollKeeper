'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

const DISMISS_KEY = 'rollkeeper-data-warning-dismissed';

interface DataSafetyBannerProps {
  onExport: () => void;
}

/**
 * One-time, dismissible reminder that character data lives only in this browser,
 * nudging the user to keep an exported backup. Dismissal persists.
 */
export function DataSafetyBanner({ onExport }: DataSafetyBannerProps) {
  // Hidden on first paint until we know the persisted choice (avoids a flash).
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
    setDismissed(true);
  };

  return (
    <div className="border-accent-amber-border bg-accent-amber-bg mb-6 flex items-start gap-3 rounded-lg border p-4">
      <AlertTriangle className="text-accent-amber-text mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-heading text-sm font-medium">
          Your characters are saved only in this browser
        </p>
        <p className="text-muted text-sm">
          Clearing browser data or switching devices will lose them. Export a
          backup to stay safe.
        </p>
      </div>
      <Button
        variant="warning"
        size="sm"
        leftIcon={<Download size={16} />}
        onClick={onExport}
      >
        Export All
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={16} />
      </Button>
    </div>
  );
}
