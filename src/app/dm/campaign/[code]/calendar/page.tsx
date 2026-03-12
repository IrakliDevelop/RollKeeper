'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/layout/card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CalendarView } from '@/components/ui/calendar/CalendarView';
import { useCalendarStore } from '@/store/calendarStore';
import { useDmStore } from '@/store/dmStore';
import { useCalendar } from '@/hooks/useCalendar';
import { useDmCalendarSync } from '@/hooks/useDmCalendarSync';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { CALENDAR_PRESETS } from '@/utils/calendarPresets';

export default function CalendarPage() {
  const params = useParams();
  const code = params.code as string;
  const { exists } = useCalendar(code);
  const dmId = useDmStore(state => state.dmId);
  const initCalendar = useCalendarStore(state => state.initCalendar);
  const deleteCalendar = useCalendarStore(state => state.deleteCalendar);

  // Auto-push calendar changes to Redis for player sync
  const { lastPushed, error: syncError } = useDmCalendarSync(code, dmId);
  const lastPushedAgo = useTimeAgo(lastPushed);

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
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href={`/dm/campaign/${code}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Campaign
                </Button>
              </Link>
              <div className="ml-6 flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <h1 className="text-heading text-xl font-bold">Calendar</h1>
              </div>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

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
                <Button variant="danger" size="sm" onClick={handleConfirmReset}>
                  Reset Calendar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {exists ? (
          <>
            <CalendarView campaignCode={code} onReset={handleReset} />
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
          </>
        ) : (
          <Card>
            <CardHeader className="p-6">
              <CardTitle>Set Up Campaign Calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
              <p className="text-body">
                Choose a calendar preset to get started. You can fully customize
                days, months, moons, and more in settings afterwards.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CALENDAR_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      selectedPreset === preset.id
                        ? 'border-accent-blue-border bg-accent-blue-bg'
                        : 'border-divider bg-surface hover:bg-surface-secondary'
                    }`}
                  >
                    <span className="text-heading font-semibold">
                      {preset.name}
                    </span>
                    <p className="text-muted mt-1 text-xs">
                      {getPresetDescription(preset.id)}
                    </p>
                  </button>
                ))}
              </div>

              <Button variant="primary" onClick={handleCreate}>
                Create Calendar
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function getPresetDescription(id: string): string {
  switch (id) {
    case 'default':
      return '7-day weeks, 12 months of 30 days, 4 seasons, 1 moon';
    case 'harptos':
      return 'Faer\u00fbn calendar with 10-day tendays, 5 holidays, Sel\u00fbne moon';
    case 'greyhawk':
      return '7-day weeks, 12 months of 28 days, 4 festivals, 2 moons';
    case 'barovia':
      return '7-day weeks, 12 months of 28 days, 28-day moon cycle';
    default:
      return '';
  }
}
