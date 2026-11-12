'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/forms/button';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CalendarSettingsPanel } from '@/components/ui/calendar/CalendarSettingsPanel';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarConfig } from '@/types/calendar';

export default function CalendarSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const calendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === code)
  );
  const updateConfig = useCalendarStore(state => state.updateConfig);

  const handleSave = (config: CalendarConfig) => {
    updateConfig(code, config);
    router.push(`/dm/campaign/${code}/calendar`);
  };

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{ href: `/dm/campaign/${code}/calendar`, label: 'Calendar' }}
        title={<h1 className="type-heading text-heading">Calendar settings</h1>}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {calendar ? (
          <CalendarSettingsPanel config={calendar.config} onSave={handleSave} />
        ) : (
          <div className="py-12 text-center">
            <p className="type-subheading text-heading">
              Choose a calendar first
            </p>
            <p className="type-body text-muted mt-2">
              Settings open once this campaign has a calendar.
            </p>
            <Button asChild variant="primary" className="mt-4">
              <Link href={`/dm/campaign/${code}/calendar`}>Open calendar</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
