'use client';

import { Button } from '@/components/ui/forms/button';

interface PlacementBannerProps {
  entityName: string;
  onCancel: () => void;
}

/** Top-center banner shown while a tap-armed placement is pending — sibling
 * extraction from `DmVttScreen.tsx` to stay under the 150-line file cap. */
export function PlacementBanner({
  entityName,
  onCancel,
}: PlacementBannerProps) {
  return (
    <div className="pointer-events-auto fixed top-16 left-1/2 z-20 -translate-x-1/2">
      <div className="bg-accent-blue-bg border-accent-blue-border flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-1.5 shadow-lg">
        <span className="text-accent-blue-text text-sm font-medium">
          📍 Click the map to place {entityName}
        </span>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
