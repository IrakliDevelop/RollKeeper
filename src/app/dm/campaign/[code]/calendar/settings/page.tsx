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

  if (!calendar) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-body mb-4">No calendar found for this campaign.</p>
          <Link href={`/dm/campaign/${code}/calendar`}>
            <Button variant="primary">Set Up Calendar</Button>
          </Link>
        </div>
      </div>
    );
  }

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
        <CalendarSettingsPanel config={calendar.config} onSave={handleSave} />
      </main>
    </div>
  );
}
