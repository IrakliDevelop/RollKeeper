'use client';

import { Button } from '@/components/ui/forms/button';
import { AppIcon } from '@/components/ui/icons';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

import { cn } from '@/utils/cn';

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
    <div className="pointer-events-auto fixed top-[var(--dm-vtt-panel-top,8rem)] left-1/2 z-20 -translate-x-1/2">
      <div
        className={cn(OVERLAY_SURFACE, 'flex items-center gap-2 px-3 py-1.5')}
      >
        <span className="type-ui text-body flex items-center gap-1.5">
          <AppIcon name="location" className="text-muted size-4" aria-hidden />
          Choose a spot on the map for {entityName}
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
