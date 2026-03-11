'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href={`/dm/campaign/${code}/calendar`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Calendar
                </Button>
              </Link>
              <div className="ml-6 flex items-center gap-3">
                <Settings className="text-muted h-6 w-6" />
                <h1 className="text-heading text-xl font-bold">
                  Calendar Settings
                </h1>
              </div>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <CalendarSettingsPanel config={calendar.config} onSave={handleSave} />
      </main>
    </div>
  );
}
