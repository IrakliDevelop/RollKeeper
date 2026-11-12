import Link from 'next/link';
import { CalendarDays, Map as MapIcon, MapPin, Swords } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';

export const CAMPAIGN_PAGES = [
  { label: 'Encounters', segment: 'encounters', Icon: Swords },
  { label: 'Battle maps', segment: 'battlemaps', Icon: MapIcon },
  { label: 'Locations', segment: 'locations', Icon: MapPin },
  { label: 'Calendar', segment: 'calendar', Icon: CalendarDays },
] as const;

export type CampaignPage = (typeof CAMPAIGN_PAGES)[number];

/** Links to the campaign's sub-pages: a wrapping row, or a stacked list. */
export function CampaignNav({
  code,
  vertical = false,
  className,
}: {
  code: string;
  vertical?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label="Campaign pages" className={className}>
      <ul className={cn('flex gap-2', vertical ? 'flex-col' : 'flex-wrap')}>
        {CAMPAIGN_PAGES.map(({ label, segment, Icon }) => (
          <li key={segment}>
            <Button
              asChild
              size="sm"
              variant={vertical ? 'ghost' : 'secondary'}
              className={cn(vertical && 'w-full justify-start')}
              leftIcon={<Icon size={16} aria-hidden="true" />}
            >
              <Link href={`/dm/campaign/${code}/${segment}`}>{label}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
