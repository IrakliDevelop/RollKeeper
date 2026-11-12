'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import type { CalendarConfig } from '@/types/calendar';

interface CalendarSettingsPanelProps {
  config: CalendarConfig;
  onSave: (config: CalendarConfig) => void;
}

function RemoveRowButton({
  label,
  disabled,
  className,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      <Trash2 size={14} className="text-blood-text" aria-hidden="true" />
    </Button>
  );
}

/** A row's name for its remove button, or its position when the name is blank. */
const rowLabel = (name: string, fallback: string) => name.trim() || fallback;

export function CalendarSettingsPanel({
  config,
  onSave,
}: CalendarSettingsPanelProps) {
  const [draft, setDraft] = useState<CalendarConfig>(config);
  const len = draft.weekDays.length;
  const wrapIndex = (offset: number) => ((offset % len) + len) % len;
  const visibleWeekStart = wrapIndex(draft.weekStartsOn ?? 0);
  const yearStartIndex = wrapIndex(draft.yearStartWeekdayOffset);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  const update = <K extends keyof CalendarConfig>(
    key: K,
    value: CalendarConfig[K]
  ) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => onSave(draft);

  return (
    <div className="space-y-8">
      <Section heading="Clock" level={2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberInput
            label="Hours per day"
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
            label="Minutes per hour"
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
            label="Seconds per minute"
            min={1}
            value={draft.clock.secondsPerMinute}
            onChange={v =>
              update('clock', {
                ...draft.clock,
                secondsPerMinute: v ?? 1,
              })
            }
          />
        </div>
      </Section>

      <Section heading="Week days" level={2}>
        <ul className="divide-divider divide-y">
          {draft.weekDays.map((wd, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  aria-label={`Day ${i + 1} name`}
                  value={wd.name}
                  onChange={e => {
                    const next = [...draft.weekDays];
                    next[i] = { name: e.target.value };
                    update('weekDays', next);
                  }}
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
                />
                <RemoveRowButton
                  label={`Remove ${rowLabel(wd.name, `day ${i + 1}`)}`}
                  disabled={draft.weekDays.length <= 1}
                  onClick={() => {
                    if (draft.weekDays.length <= 1) return;
                    update(
                      'weekDays',
                      draft.weekDays.filter((_, j) => j !== i)
                    );
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() =>
            update('weekDays', [...draft.weekDays, { name: 'New day' }])
          }
        >
          Add day
        </Button>
      </Section>

      <Section heading="Months" level={2}>
        <ul className="divide-divider divide-y">
          {draft.months.map((m, i) => (
            <li key={i} className="py-3">
              <div className="flex items-center gap-3">
                <span className="type-caption text-muted w-6 shrink-0 text-center">
                  {i + 1}.
                </span>
                <Input
                  aria-label={`Month ${i + 1} name`}
                  value={m.name}
                  onChange={e => {
                    const next = [...draft.months];
                    next[i] = { ...next[i], name: e.target.value };
                    update('months', next);
                  }}
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
                />
                <NumberInput
                  aria-label={`Days in ${rowLabel(m.name, `month ${i + 1}`)}`}
                  min={1}
                  value={m.days}
                  onChange={v => {
                    const next = [...draft.months];
                    next[i] = { ...next[i], days: v ?? 1 };
                    update('months', next);
                  }}
                  wrapperClassName="w-24"
                  rightIcon={
                    <span className="type-caption text-muted">days</span>
                  }
                />
                <RemoveRowButton
                  label={`Remove ${rowLabel(m.name, `month ${i + 1}`)}`}
                  disabled={draft.months.length <= 1}
                  onClick={() => {
                    if (draft.months.length <= 1) return;
                    update(
                      'months',
                      draft.months.filter((_, j) => j !== i)
                    );
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() =>
            update('months', [...draft.months, { name: 'New month', days: 30 }])
          }
        >
          Add month
        </Button>
      </Section>

      <Section heading="Seasons" level={2}>
        <ul className="divide-divider divide-y">
          {draft.seasons.map((s, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Name"
                  value={s.name}
                  onChange={e => {
                    const next = [...draft.seasons];
                    next[i] = { ...next[i], name: e.target.value };
                    update('seasons', next);
                  }}
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
                />
                <NumberInput
                  label="Start day"
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
                  label="End day"
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
                  label="Sunrise (hour)"
                  min={0}
                  max={draft.clock.hoursPerDay - 1}
                  value={s.sunriseHour}
                  onChange={v => {
                    const next = [...draft.seasons];
                    next[i] = {
                      ...next[i],
                      sunriseHour: v ?? 0,
                    };
                    update('seasons', next);
                  }}
                  wrapperClassName="w-24"
                />
                <NumberInput
                  label="Sunset (hour)"
                  min={0}
                  max={draft.clock.hoursPerDay - 1}
                  value={s.sunsetHour}
                  onChange={v => {
                    const next = [...draft.seasons];
                    next[i] = {
                      ...next[i],
                      sunsetHour: v ?? 0,
                    };
                    update('seasons', next);
                  }}
                  wrapperClassName="w-24"
                />
                <RemoveRowButton
                  label={`Remove ${rowLabel(s.name, `season ${i + 1}`)}`}
                  onClick={() =>
                    update(
                      'seasons',
                      draft.seasons.filter((_, j) => j !== i)
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() =>
            update('seasons', [
              ...draft.seasons,
              {
                name: 'New season',
                startDay: 0,
                endDay: 89,
                sunriseHour: 6,
                sunsetHour: 18,
              },
            ])
          }
        >
          Add season
        </Button>
      </Section>

      <Section heading="Moons" level={2}>
        <ul className="divide-divider divide-y">
          {draft.moons.map((m, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-start gap-3">
                <Input
                  label="Name"
                  value={m.name}
                  onChange={e => {
                    const next = [...draft.moons];
                    next[i] = { ...next[i], name: e.target.value };
                    update('moons', next);
                  }}
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
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
                <RemoveRowButton
                  label={`Remove ${rowLabel(m.name, `moon ${i + 1}`)}`}
                  className="mt-6.5"
                  onClick={() =>
                    update(
                      'moons',
                      draft.moons.filter((_, j) => j !== i)
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() =>
            update('moons', [
              ...draft.moons,
              {
                name: 'New moon',
                color: '#C0C0C0',
                phaseOffset: 0,
                period: 28,
              },
            ])
          }
        >
          Add moon
        </Button>
      </Section>

      <Section heading="Eras" level={2}>
        <ul className="divide-divider divide-y">
          {draft.eras.map((e, i) => (
            <li key={i} className="py-3">
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Name"
                  value={e.name}
                  onChange={ev => {
                    const next = [...draft.eras];
                    next[i] = { ...next[i], name: ev.target.value };
                    update('eras', next);
                  }}
                  wrapperClassName="min-w-0 flex-[1_1_12rem]"
                />
                <Input
                  label="Abbreviation"
                  value={e.abbreviation}
                  onChange={ev => {
                    const next = [...draft.eras];
                    next[i] = { ...next[i], abbreviation: ev.target.value };
                    update('eras', next);
                  }}
                  wrapperClassName="w-24"
                />
                <NumberInput
                  label="Start year"
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
                  label="End year"
                  allowEmpty
                  value={e.endYear}
                  onChange={v => {
                    const next = [...draft.eras];
                    next[i] = { ...next[i], endYear: v };
                    update('eras', next);
                  }}
                  wrapperClassName="w-24"
                />
                <RemoveRowButton
                  label={`Remove ${rowLabel(e.name, `era ${i + 1}`)}`}
                  onClick={() =>
                    update(
                      'eras',
                      draft.eras.filter((_, j) => j !== i)
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() =>
            update('eras', [
              ...draft.eras,
              { name: 'New era', abbreviation: 'NE', startYear: 1 },
            ])
          }
        >
          Add era
        </Button>
      </Section>

      <Section heading="Year and mechanics" level={2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberInput
            label="Starting year"
            value={draft.yearOffset}
            onChange={v => update('yearOffset', v ?? 0)}
            helperText="The year number at the calendar's first day."
          />
          <SelectField
            label="Year starts on"
            value={String(yearStartIndex)}
            onValueChange={value =>
              update('yearStartWeekdayOffset', Number(value))
            }
            helperText="Weekday of the calendar's first day."
          >
            {draft.weekDays.map((weekday, index) => (
              <SelectItem
                key={`${weekday.name}-${index}`}
                value={String(index)}
              >
                {weekday.name}
              </SelectItem>
            ))}
          </SelectField>
          <SelectField
            label="Week starts on"
            value={String(visibleWeekStart)}
            onValueChange={value => update('weekStartsOn', Number(value))}
            helperText="The first column in month view"
          >
            {draft.weekDays.map((weekday, index) => (
              <SelectItem
                key={`${weekday.name}-${index}`}
                value={String(index)}
              >
                {weekday.name}
              </SelectItem>
            ))}
          </SelectField>
          <NumberInput
            label="Long rest (hours)"
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
            label="Short rest (minutes)"
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
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          disabled={!isDirty}
          onClick={() => setDraft(config)}
        >
          Discard changes
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
