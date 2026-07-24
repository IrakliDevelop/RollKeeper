'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/layout/card';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import type { CalendarConfig } from '@/types/calendar';

interface CalendarSettingsPanelProps {
  config: CalendarConfig;
  onSave: (config: CalendarConfig) => void;
}

export function CalendarSettingsPanel({
  config,
  onSave,
}: CalendarSettingsPanelProps) {
  const [draft, setDraft] = useState<CalendarConfig>(config);

  const update = <K extends keyof CalendarConfig>(
    key: K,
    value: CalendarConfig[K]
  ) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => onSave(draft);

  return (
    <div className="space-y-6">
      {/* Clock */}
      <Card>
        <CardHeader>
          <CardTitle>Clock</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 p-4">
          <NumberInput
            label="Hours per Day"
            min={1}
            value={draft.clock.hoursPerDay}
            onChange={v =>
              update('clock', {
                ...draft.clock,
                hoursPerDay: v ?? 1,
              })
            }
          />
          <NumberInput
            label="Minutes per Hour"
            min={1}
            value={draft.clock.minutesPerHour}
            onChange={v =>
              update('clock', {
                ...draft.clock,
                minutesPerHour: v ?? 1,
              })
            }
          />
          <NumberInput
            label="Seconds per Minute"
            min={1}
            value={draft.clock.secondsPerMinute}
            onChange={v =>
              update('clock', {
                ...draft.clock,
                secondsPerMinute: v ?? 1,
              })
            }
          />
        </CardContent>
      </Card>

      {/* Week Days */}
      <Card>
        <CardHeader>
          <CardTitle>Week Days</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {draft.weekDays.map((wd, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={wd.name}
                onChange={e => {
                  const next = [...draft.weekDays];
                  next[i] = { name: e.target.value };
                  update('weekDays', next);
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (draft.weekDays.length <= 1) return;
                  update(
                    'weekDays',
                    draft.weekDays.filter((_, j) => j !== i)
                  );
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              update('weekDays', [...draft.weekDays, { name: 'New Day' }])
            }
          >
            Add Day
          </Button>
        </CardContent>
      </Card>

      {/* Months */}
      <Card>
        <CardHeader>
          <CardTitle>Months</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {draft.months.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted w-6 shrink-0 text-center text-xs">
                {i + 1}.
              </span>
              <Input
                value={m.name}
                onChange={e => {
                  const next = [...draft.months];
                  next[i] = { ...next[i], name: e.target.value };
                  update('months', next);
                }}
                wrapperClassName="flex-1 min-w-0"
              />
              <NumberInput
                min={1}
                value={m.days}
                onChange={v => {
                  const next = [...draft.months];
                  next[i] = { ...next[i], days: v ?? 1 };
                  update('months', next);
                }}
                wrapperClassName="w-24"
                rightIcon={<span className="text-muted text-xs">days</span>}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (draft.months.length <= 1) return;
                  update(
                    'months',
                    draft.months.filter((_, j) => j !== i)
                  );
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              update('months', [
                ...draft.months,
                { name: 'New Month', days: 30 },
              ])
            }
          >
            Add Month
          </Button>
        </CardContent>
      </Card>

      {/* Seasons */}
      <Card>
        <CardHeader>
          <CardTitle>Seasons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {draft.seasons.map((s, i) => (
            <div
              key={i}
              className="bg-surface-secondary flex items-end gap-2 rounded p-3"
            >
              <Input
                label="Name"
                value={s.name}
                onChange={e => {
                  const next = [...draft.seasons];
                  next[i] = { ...next[i], name: e.target.value };
                  update('seasons', next);
                }}
                wrapperClassName="flex-1 min-w-0"
              />
              <NumberInput
                label="Start Day"
                min={0}
                value={s.startDay}
                onChange={v => {
                  const next = [...draft.seasons];
                  next[i] = {
                    ...next[i],
                    startDay: v ?? 0,
                  };
                  update('seasons', next);
                }}
                wrapperClassName="w-20"
              />
              <NumberInput
                label="End Day"
                min={0}
                value={s.endDay}
                onChange={v => {
                  const next = [...draft.seasons];
                  next[i] = { ...next[i], endDay: v ?? 0 };
                  update('seasons', next);
                }}
                wrapperClassName="w-20"
              />
              <NumberInput
                label="Sunrise"
                min={0}
                value={s.sunriseHour}
                onChange={v => {
                  const next = [...draft.seasons];
                  next[i] = {
                    ...next[i],
                    sunriseHour: v ?? 0,
                  };
                  update('seasons', next);
                }}
                wrapperClassName="w-20"
              />
              <NumberInput
                label="Sunset"
                min={0}
                value={s.sunsetHour}
                onChange={v => {
                  const next = [...draft.seasons];
                  next[i] = {
                    ...next[i],
                    sunsetHour: v ?? 0,
                  };
                  update('seasons', next);
                }}
                wrapperClassName="w-20"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update(
                    'seasons',
                    draft.seasons.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              update('seasons', [
                ...draft.seasons,
                {
                  name: 'New Season',
                  startDay: 0,
                  endDay: 89,
                  sunriseHour: 6,
                  sunsetHour: 18,
                },
              ])
            }
          >
            Add Season
          </Button>
        </CardContent>
      </Card>

      {/* Moons */}
      <Card>
        <CardHeader>
          <CardTitle>Moons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {draft.moons.map((m, i) => (
            <div
              key={i}
              className="bg-surface-secondary flex items-start gap-2 rounded p-3"
            >
              <Input
                label="Name"
                value={m.name}
                onChange={e => {
                  const next = [...draft.moons];
                  next[i] = { ...next[i], name: e.target.value };
                  update('moons', next);
                }}
                wrapperClassName="flex-1 min-w-0"
                helperText="&nbsp;"
              />
              <NumberInput
                label="Period"
                min={1}
                value={m.period}
                onChange={v => {
                  const next = [...draft.moons];
                  next[i] = { ...next[i], period: v ?? 1 };
                  update('moons', next);
                }}
                wrapperClassName="w-20"
                helperText="Days per cycle"
              />
              <NumberInput
                label="Offset"
                value={m.phaseOffset}
                onChange={v => {
                  const next = [...draft.moons];
                  next[i] = {
                    ...next[i],
                    phaseOffset: v ?? 0,
                  };
                  update('moons', next);
                }}
                wrapperClassName="w-24"
                helperText="First new moon day"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-6"
                onClick={() =>
                  update(
                    'moons',
                    draft.moons.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              update('moons', [
                ...draft.moons,
                {
                  name: 'New Moon',
                  color: '#C0C0C0',
                  phaseOffset: 0,
                  period: 28,
                },
              ])
            }
          >
            Add Moon
          </Button>
        </CardContent>
      </Card>

      {/* Eras */}
      <Card>
        <CardHeader>
          <CardTitle>Eras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {draft.eras.map((e, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                label="Name"
                value={e.name}
                onChange={ev => {
                  const next = [...draft.eras];
                  next[i] = { ...next[i], name: ev.target.value };
                  update('eras', next);
                }}
                wrapperClassName="flex-1 min-w-0"
              />
              <Input
                label="Abbr"
                value={e.abbreviation}
                onChange={ev => {
                  const next = [...draft.eras];
                  next[i] = { ...next[i], abbreviation: ev.target.value };
                  update('eras', next);
                }}
                wrapperClassName="w-20"
              />
              <NumberInput
                label="Start Year"
                value={e.startYear}
                onChange={v => {
                  const next = [...draft.eras];
                  next[i] = {
                    ...next[i],
                    startYear: v ?? 0,
                  };
                  update('eras', next);
                }}
                wrapperClassName="w-24"
              />
              <NumberInput
                label="End Year"
                allowEmpty
                value={e.endYear}
                onChange={v => {
                  const next = [...draft.eras];
                  next[i] = { ...next[i], endYear: v };
                  update('eras', next);
                }}
                wrapperClassName="w-24"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  update(
                    'eras',
                    draft.eras.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() =>
              update('eras', [
                ...draft.eras,
                { name: 'New Era', abbreviation: 'NE', startYear: 1 },
              ])
            }
          >
            Add Era
          </Button>
        </CardContent>
      </Card>

      {/* Year & Mechanics */}
      <Card>
        <CardHeader>
          <CardTitle>Year & Mechanics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-3">
          <NumberInput
            label="Starting Year"
            value={draft.yearOffset}
            onChange={v => update('yearOffset', v ?? 0)}
            helperText="The year number shown at time zero"
          />
          <NumberInput
            label="First Day of Week"
            min={0}
            max={draft.weekDays.length - 1}
            value={draft.yearStartWeekdayOffset}
            onChange={v => update('yearStartWeekdayOffset', v ?? 0)}
            helperText={`0 = ${draft.weekDays[0]?.name ?? 'first day'}`}
          />
          <NumberInput
            label="Long Rest (hours)"
            min={1}
            value={draft.mechanics.hoursPerLongRest}
            onChange={v =>
              update('mechanics', {
                ...draft.mechanics,
                hoursPerLongRest: v ?? 1,
              })
            }
          />
          <NumberInput
            label="Short Rest (minutes)"
            min={1}
            value={draft.mechanics.minutesPerShortRest}
            onChange={v =>
              update('mechanics', {
                ...draft.mechanics,
                minutesPerShortRest: v ?? 1,
              })
            }
          />
          <NumberInput
            label="Round (seconds)"
            min={1}
            value={draft.mechanics.secondsPerRound}
            onChange={v =>
              update('mechanics', {
                ...draft.mechanics,
                secondsPerRound: v ?? 1,
              })
            }
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setDraft(config)}>
          Reset
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
