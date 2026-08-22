import { describe, expect, it } from 'vitest';

import {
  buildCalendarManifest,
  CALENDAR_FAMILY_INVENTORY,
  projectCalendarForLegacyPlayers,
  registeredDurableDmFamilies,
} from './calendarFamily';

const envelope = (calendar: Record<string, unknown>) =>
  JSON.stringify({ state: { calendars: [calendar] }, version: 3 });

describe('Slice 11B calendar family', () => {
  it('registers only the Slice 11A canary and calendar families', () => {
    expect(registeredDurableDmFamilies).toEqual([
      'campaign_settings',
      'calendar',
    ]);
    expect(CALENDAR_FAMILY_INVENTORY).toMatchObject({
      family: 'calendar',
      localStorageKeys: ['rollkeeper-calendar-data'],
      persistenceVersions: { 'rollkeeper-calendar-data': 3 },
      stableIdentity: 'campaignCode',
      excludedFamilies: expect.arrayContaining([
        'campaign_settings',
        'character',
        'membership',
        'location',
        'encounter_definition',
        'battle_map',
      ]),
    });
  });

  it('preserves the complete calendar record and typed event references', async () => {
    const manifest = await buildCalendarManifest({
      campaignCode: 'ABC123',
      rawEnvelope: envelope({
        campaignCode: 'ABC123',
        config: {
          clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
          weekDays: [{ name: 'Firstday' }],
          months: [{ name: 'Dawn', days: 30 }],
          seasons: [],
          moons: [],
          namedYears: [],
          eras: [],
          yearOffset: 0,
          yearStartWeekdayOffset: 0,
          mechanics: {
            hoursPerLongRest: 8,
            minutesPerShortRest: 60,
            secondsPerRound: 6,
          },
        },
        currentTime: 12,
        startTime: 0,
        weather: 'clear',
        events: [
          {
            id: 'evt-stable',
            title: 'Vault opens',
            description: 'DM detail',
            year: 1,
            month: 0,
            day: 2,
            createdAt: 10,
            visibility: 'private',
            references: [{ family: 'location', legacyId: 'loc-1' }],
          },
        ],
      }),
    });

    expect(manifest.blockers).toEqual([]);
    expect(manifest.records).toHaveLength(1);
    expect(manifest.records[0].legacyId).toBe('ABC123');
    expect(manifest.records[0].payload.events[0].id).toBe('evt-stable');
    expect(manifest.records[0].references).toEqual([
      {
        family: 'location',
        legacyId: 'loc-1',
        path: 'events[0].references[0]',
      },
    ]);
  });

  it('quarantines duplicate event IDs and unsupported references', async () => {
    const manifest = await buildCalendarManifest({
      campaignCode: 'ABC123',
      rawEnvelope: envelope({
        campaignCode: 'ABC123',
        config: {},
        currentTime: 0,
        startTime: 0,
        events: [
          {
            id: 'same',
            title: 'A',
            description: '',
            year: 1,
            month: 0,
            day: 0,
            createdAt: 1,
          },
          {
            id: 'same',
            title: 'B',
            description: '',
            year: 1,
            month: 0,
            day: 1,
            createdAt: 2,
            references: [{ family: 'npc', legacyId: 'npc-1' }],
          },
        ],
      }),
    });
    expect(manifest.blockers.map(value => value.kind)).toEqual([
      'duplicate-event-id',
      'unsupported-reference',
    ]);
  });

  it('projects only explicitly public or discovered safe fields', () => {
    const projection = projectCalendarForLegacyPlayers({
      config: {
        clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
        weekDays: [{ name: 'Firstday' }],
        months: [{ name: 'Dawn', days: 30 }],
        seasons: [],
        moons: [{ name: 'Moon', color: '#fff', phaseOffset: 0, period: 30 }],
        namedYears: [],
        eras: [],
        yearOffset: 0,
        yearStartWeekdayOffset: 0,
        mechanics: {
          hoursPerLongRest: 8,
          minutesPerShortRest: 60,
          secondsPerRound: 6,
        },
      },
      currentTime: 42,
      startTime: 0,
      weather: 'rain',
      events: [
        {
          id: 'private',
          title: 'Secret',
          description: 'never',
          year: 1,
          month: 0,
          day: 0,
          createdAt: 1,
          visibility: 'private',
        },
        {
          id: 'public',
          title: 'Festival',
          description: 'Known',
          year: 1,
          month: 0,
          day: 1,
          createdAt: 2,
          visibility: 'public',
        },
        {
          id: 'legacy',
          title: 'Legacy secret',
          description: 'never',
          year: 1,
          month: 0,
          day: 2,
          createdAt: 3,
        },
      ],
      dmNotes: 'raw JSON must never pass through',
    } as never);
    expect(projection.events).toEqual([
      {
        id: 'public',
        title: 'Festival',
        description: 'Known',
        year: 1,
        month: 0,
        day: 1,
        visibility: 'public',
      },
    ]);
    expect(JSON.stringify(projection)).not.toContain('Secret');
    expect(JSON.stringify(projection)).not.toContain('dmNotes');
    expect(projection.config.moons).toHaveLength(1);
  });
});
