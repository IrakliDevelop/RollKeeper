'use client';

import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

interface BattleMapLiveBannerProps {
  campaignCode: string;
  battleMapId: string;
  mapName?: string;
  characterId: string;
}

export function BattleMapLiveBanner({
  campaignCode,
  battleMapId,
  mapName,
  characterId,
}: BattleMapLiveBannerProps) {
  return (
    <div className="border-accent-emerald-border bg-accent-emerald-bg fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2 shadow-lg">
      <MapIcon size={18} className="text-accent-emerald-text" />
      <span className="text-body text-sm">
        Battle map{mapName ? ` “${mapName}”` : ''} is live
      </span>
      <Link
        href={`/player/campaign/${campaignCode}/battlemap/${battleMapId}?character=${encodeURIComponent(characterId)}`}
      >
        <Button variant="success" className="px-3 py-1 text-xs">
          Join map
        </Button>
      </Link>
    </div>
  );
}
