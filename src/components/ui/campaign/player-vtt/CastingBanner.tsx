'use client';

import { Button } from '@/components/ui/forms/button';
import type { SpellAoe } from '@/types/spellAoe';

export interface CastingBannerProps {
  spellName: string;
  aoe: SpellAoe;
  onCancel: () => void;
}

/** Fixed banner shown while a spell's AoE template placement is armed on the battle map. */
export function CastingBanner({
  spellName,
  aoe,
  onCancel,
}: CastingBannerProps) {
  return (
    <div className="bg-accent-purple-bg border-accent-purple-border text-accent-purple-text pointer-events-auto fixed top-[64px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 shadow-xl">
      <span className="text-sm font-medium">
        ✨ Placing {spellName} — tap the map to drop the {aoe.shape} ·{' '}
        {aoe.sizeFeet} ft
      </span>
      <Button variant="ghost" size="lg" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
