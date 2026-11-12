'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';
import { BannerImageControls } from './BannerImageControls';
import { CampaignBanner } from './CampaignBanner';
import { CAMPAIGN_PAGES, type CampaignPage } from './CampaignNav';

const LEFT_SEGMENTS = ['locations', 'battlemaps'];
const RIGHT_SEGMENTS = ['calendar', 'encounters'];

function pagesFor(segments: string[]): CampaignPage[] {
  return segments.flatMap(segment =>
    CAMPAIGN_PAGES.filter(page => page.segment === segment)
  );
}

const LEFT_PAGES = pagesFor(LEFT_SEGMENTS);
const RIGHT_PAGES = pagesFor(RIGHT_SEGMENTS);

function PageLinks({ code, pages }: { code: string; pages: CampaignPage[] }) {
  return (
    <ul className="flex h-full flex-col gap-2">
      {pages.map(({ label, segment, Icon }) => (
        <li key={segment} className="flex flex-1">
          <Button
            asChild
            variant="secondary"
            className="h-full min-h-11 w-full"
            leftIcon={<Icon size={18} aria-hidden="true" />}
          >
            <Link href={`/dm/campaign/${code}/${segment}`}>{label}</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export interface CampaignBannerHeroProps {
  code: string;
  bannerUrl?: string;
  onBannerChange: (url: string | undefined) => void;
}

/** The banner layout: the banner across the top, between the page links. */
export function CampaignBannerHero({
  code,
  bannerUrl,
  onBannerChange,
}: CampaignBannerHeroProps) {
  return (
    <nav
      aria-label="Campaign pages"
      className="grid grid-cols-2 gap-2 lg:grid-cols-[11rem_minmax(0,1fr)_11rem] lg:gap-4"
    >
      <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        {bannerUrl ? (
          <CampaignBanner
            src={bannerUrl}
            sizes="(max-width: 1024px) 100vw, 800px"
            className="aspect-[16/7] lg:aspect-[16/5]"
          />
        ) : (
          <div className="bg-surface-inset flex aspect-[16/7] flex-col items-center justify-center gap-3 rounded-md p-4 text-center lg:aspect-[16/5]">
            <p className="type-body text-muted">No banner image yet</p>
            <BannerImageControls
              bannerUrl={bannerUrl}
              campaignCode={code}
              onBannerChange={onBannerChange}
            />
          </div>
        )}
      </div>
      <div className="lg:col-start-1 lg:row-start-1">
        <PageLinks code={code} pages={LEFT_PAGES} />
      </div>
      <div className="lg:col-start-3 lg:row-start-1">
        <PageLinks code={code} pages={RIGHT_PAGES} />
      </div>
    </nav>
  );
}
