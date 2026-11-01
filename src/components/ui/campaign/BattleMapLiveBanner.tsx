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
  embedded?: boolean;
}

export function BattleMapLiveBanner({
  campaignCode,
  battleMapId,
  mapName,
  characterId,
  onJoin,
  compact = false,
  embedded = false,
}: BattleMapLiveBannerProps) {
  const href = `/player/campaign/${campaignCode}/battlemap/${battleMapId}?character=${encodeURIComponent(characterId)}`;

  if (compact) {
    if (embedded) {
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
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open battle map${mapName ? ` “${mapName}”` : ''}`}
        aria-label="Open battle map"
        className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text fixed right-4 bottom-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg"
      >
        <MapIcon size={18} />
      </Link>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'bg-surface-elevated border-divider pointer-events-auto flex w-full flex-wrap items-center gap-3 rounded-md border p-3'
          : 'border-accent-emerald-border bg-accent-emerald-bg fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2 shadow-lg'
      }
    >
      <MapIcon
        size={18}
        className={
          embedded ? 'text-muted shrink-0' : 'text-accent-emerald-text'
        }
      />
      <span className="text-body min-w-0 flex-1 text-sm break-words">
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
