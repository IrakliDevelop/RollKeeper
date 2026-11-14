'use client';

import { Button } from '@/components/ui/forms/button';
import { AppIcon } from '@/components/ui/icons';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import type { SpellAoe } from '@/types/spellAoe';

export interface CastingBannerProps {
  spellName: string;
  aoe: SpellAoe;
  onCancel: () => void;
}

/** Neutral strip, mounted under the map tool island, shown while a spell's AoE template placement is armed on the battle map. */
export function CastingBanner({
  spellName,
  aoe,
  onCancel,
}: CastingBannerProps) {
  const instruction =
    aoe.shape === 'cone' || aoe.shape === 'line'
      ? 'Tap the map, then drag to aim'
      : 'Tap the map to place the template';

  return (
    <div
      className={`${OVERLAY_SURFACE} pointer-events-auto flex max-w-full items-center gap-3 px-3 py-2`}
    >
      <AppIcon name="spell" className="text-lapis-text size-4 shrink-0" />
      <div className="min-w-0">
        <p className="type-ui text-heading">
          Placing {spellName} · {aoe.sizeFeet} ft {aoe.shape}
        </p>
        <p className="type-small text-muted">{instruction}</p>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
