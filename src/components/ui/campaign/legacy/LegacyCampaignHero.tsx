'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Map, MapPinned, RefreshCw, Swords } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { LegacyBannerUpload } from './LegacyBannerUpload';

export interface LegacyCampaignHeroProps {
  code: string;
  bannerUrl?: string;
  onBannerChange: (url: string | undefined) => void;
  lastFetched: Date | null;
  onRefresh: () => Promise<void> | void;
}

/**
 * The campaign page header from before the Felt and Brass redesign: the sync
 * bar, then the banner between the coloured page tiles. Kept as-is for the
 * classic layout; below lg the tiles hide and LegacyCampaignHeaderLinks
 * carries the page links.
 */
export function LegacyCampaignHero({
  code,
  bannerUrl,
  onBannerChange,
  lastFetched,
  onRefresh,
}: LegacyCampaignHeroProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <>
      {/* Sync Status Bar */}
      <div className="border-divider border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-muted text-sm">
              Auto-refreshing every 10s
              {lastFetched && (
                <span className="ml-2">
                  · Last updated {lastFetched.toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            leftIcon={
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
            }
          >
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Campaign Banner with Side Panels */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav aria-label="Campaign pages" className="flex items-stretch gap-4">
          {/* Locations + Battle Maps (stacked) */}
          <div className="hidden flex-col gap-2 lg:flex lg:w-44">
            <Link
              href={`/dm/campaign/${code}/locations`}
              className="border-accent-emerald-border bg-accent-emerald-bg hover:bg-accent-emerald-bg-strong flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2 transition-colors"
            >
              <MapPinned size={22} className="text-accent-emerald-text-muted" />
              <div className="text-accent-emerald-text text-sm font-semibold">
                Locations
              </div>
            </Link>
            <Link
              href={`/dm/campaign/${code}/battlemaps`}
              className="border-accent-orange-border bg-accent-orange-bg flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2 transition-colors hover:shadow-md"
            >
              <Map size={22} className="text-accent-orange-text-muted" />
              <div className="text-accent-orange-text text-sm font-semibold">
                Battle Maps
              </div>
            </Link>
          </div>

          {/* Banner */}
          <div className="min-w-0 flex-1 lg:max-w-2xl">
            <LegacyBannerUpload
              bannerUrl={bannerUrl}
              campaignCode={code}
              onBannerChange={onBannerChange}
            />
          </div>

          {/* Calendar */}
          <Link
            href={`/dm/campaign/${code}/calendar`}
            className="border-accent-amber-border bg-accent-amber-bg hover:bg-accent-amber-bg-strong hidden flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 transition-colors lg:flex lg:w-44"
          >
            <CalendarDays size={28} className="text-accent-amber-text-muted" />
            <div className="text-accent-amber-text text-sm font-semibold">
              Calendar
            </div>
          </Link>

          {/* Encounters */}
          <Link
            href={`/dm/campaign/${code}/encounters`}
            className="border-accent-red-border bg-accent-red-bg hover:bg-accent-red-bg-strong hidden flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 transition-colors lg:flex lg:w-44"
          >
            <Swords size={28} className="text-accent-red-text-muted" />
            <div className="text-accent-red-text text-sm font-semibold">
              Encounters
            </div>
          </Link>
        </nav>
      </div>
    </>
  );
}

/** The classic header's page links, shown below lg where the tiles hide. */
export function LegacyCampaignHeaderLinks({ code }: { code: string }) {
  return (
    <>
      <Link href={`/dm/campaign/${code}/locations`} className="lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<MapPinned size={16} />}
        >
          Locations
        </Button>
      </Link>
      <Link href={`/dm/campaign/${code}/calendar`} className="lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<CalendarDays size={16} />}
        >
          Calendar
        </Button>
      </Link>
      <Link href={`/dm/campaign/${code}/encounters`} className="lg:hidden">
        <Button variant="secondary" size="sm" leftIcon={<Swords size={16} />}>
          Encounters
        </Button>
      </Link>
      <Link href={`/dm/campaign/${code}/battlemaps`} className="lg:hidden">
        <Button variant="secondary" size="sm" leftIcon={<Map size={16} />}>
          Battle Maps
        </Button>
      </Link>
    </>
  );
}
