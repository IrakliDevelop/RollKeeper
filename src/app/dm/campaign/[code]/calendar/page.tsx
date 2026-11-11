'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Card, CardContent } from '@/components/ui/layout/card';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { Section } from '@/components/ui/layout/section';
import { CalendarPresetPicker } from '@/components/ui/calendar/CalendarPresetPicker';
import { CalendarView } from '@/components/ui/calendar/CalendarView';
import { CalendarSyncControls } from '@/components/ui/calendar/CalendarSyncControls';
import { useCalendarStore } from '@/store/calendarStore';
import { useDmStore } from '@/store/dmStore';
import { useCalendar } from '@/hooks/useCalendar';
import { useDmCalendarSync } from '@/hooks/useDmCalendarSync';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';
import { legacyCalendarProjectionAllowed } from '@/lib/durableDm/calendarLegacyProjection';

export default function CalendarPage() {
  const params = useParams();
  const code = params.code as string;
  const { exists } = useCalendar(code);
  const dmId = useDmStore(state => state.dmId);
  const campaign = useDmStore(state =>
    state.campaigns.find(value => value.code === code)
  );
  const initCalendar = useCalendarStore(state => state.initCalendar);
  const deleteCalendar = useCalendarStore(state => state.deleteCalendar);

  // Auto-push calendar changes to Redis for player sync
  const { lastPushed, error: syncError } = useDmCalendarSync(code, dmId);
  const lastPushedAgo = useTimeAgo(lastPushed);
  const legacyProjection =
    typeof localStorage === 'undefined' ||
    legacyCalendarProjectionAllowed(localStorage, code);

  const [selectedPreset, setSelectedPreset] = useState<string>(
    CALENDAR_PRESETS[0].id
  );
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleCreate = () => {
    const preset = CALENDAR_PRESETS.find(p => p.id === selectedPreset);
    if (!preset) return;
    initCalendar(code, preset.create());
  };

  const handleReset = () => {
    setConfirmingReset(true);
  };

  const handleConfirmReset = () => {
    deleteCalendar(code);
    setConfirmingReset(false);
  };

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{
          href: `/dm/campaign/${code}`,
          label: campaign?.name ?? 'Campaign',
        }}
        title={<h1 className="type-heading text-heading">Calendar</h1>}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {confirmingReset && (
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-body">
                Reset this calendar? All time progress and customizations will
                be lost.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingReset(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger-solid"
                  size="sm"
                  onClick={handleConfirmReset}
                >
                  Reset Calendar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {exists ? (
          <>
            <CalendarView campaignCode={code} onReset={handleReset} />
            {legacyProjection && (
              <div className="mt-4 flex items-center gap-2 text-xs">
                {syncError ? (
                  <span className="text-accent-red-text flex items-center gap-1">
                    <AlertCircle size={12} />
                    Sync error: {syncError}
                  </span>
                ) : lastPushedAgo ? (
                  <span className="text-muted">
                    Synced to players {lastPushedAgo}
                  </span>
                ) : (
                  <span className="text-faint">Syncing...</span>
                )}
              </div>
            )}
          </>
        ) : (
          <Section heading="Choose a calendar" contentClassName="space-y-4">
            <p className="type-body text-muted">
              Pick a calendar to start from. Months, week days, moons and eras
              can be changed in settings.
            </p>
            <CalendarPresetPicker
              value={selectedPreset}
              onChange={setSelectedPreset}
              aria-label="Choose a calendar"
            />
            <Button variant="primary" onClick={handleCreate}>
              Create calendar
            </Button>
          </Section>
        )}
        {campaign && (
          <div className="mt-6">
            <CalendarSyncControls campaign={campaign} />
          </div>
        )}
      </main>
    </div>
  );
}
