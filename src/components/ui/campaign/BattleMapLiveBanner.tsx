'use client';

import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

interface BattleMapLiveBannerProps {
  campaignCode: string;
  battleMapId: string;
  mapName?: string;
  characterId: string;
  /** Fired when the player clicks Join — the parent hides the banner after. */
  onJoin?: () => void;
  /** Compact icon-only pill (bottom-right) for players who already joined
   * but have no initiative panel to reach the map from. */
  compact?: boolean;
}

export function BattleMapLiveBanner({
  campaignCode,
  battleMapId,
  mapName,
  characterId,
  onJoin,
  compact = false,
}: BattleMapLiveBannerProps) {
  const href = `/player/campaign/${campaignCode}/battlemap/${battleMapId}?character=${encodeURIComponent(characterId)}`;

  if (compact) {
    return (
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="bg-surface-elevated pointer-events-auto self-end"
      >
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <MapIcon size={16} aria-hidden="true" />
          Open battle map
        </Link>
      </Button>
    );
  }

  return (
    <div className="bg-surface-elevated border-divider pointer-events-auto flex w-full flex-wrap items-center gap-3 rounded-md border p-3">
      <MapIcon size={18} className="text-muted shrink-0" aria-hidden="true" />
      <span className="type-ui text-body min-w-0 flex-1 break-words">
        Battle map{mapName ? ` “${mapName}”` : ''} is live
      </span>
      <Button asChild variant="secondary" size="sm">
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onJoin}
        >
          Join map
        </Link>
      </Button>
    </div>
  );
}
