import { describe, expect, it } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '../playerBackupCopy';
import { derivePlayerBackupCapabilities } from '../playerBackupFlags';
import {
  parsePlayerBackupRouteIntent,
  projectDashboardCharacterStatus,
  projectPlayerBackupDashboard,
  type PlayerBackupDashboardInput,
} from '../playerBackupDashboard';
import type { CharacterBackupStatusKey } from '../playerBackupStatus';

const FULL = derivePlayerBackupCapabilities({
  wizardVisible: true,
  authConfigured: true,
  lockAvailable: true,
  manual: true,
  cutover: true,
  automatic: true,
});

const UNAVAILABLE = derivePlayerBackupCapabilities({
  wizardVisible: true,
  authConfigured: false,
  lockAvailable: true,
  manual: false,
  cutover: false,
  automatic: false,
});

const LOCK_UNSAFE = derivePlayerBackupCapabilities({
  wizardVisible: true,
  authConfigured: true,
  lockAvailable: false,
  manual: true,
  cutover: true,
  automatic: true,
});

function characters(
  entries: Array<[string, CharacterBackupStatusKey]>
): PlayerBackupDashboardInput['characters'] {
  return entries.map(([id, status]) => ({ id, status }));
}

function input(
  overrides: Partial<PlayerBackupDashboardInput> = {}
): PlayerBackupDashboardInput {
  return {
    rosterHydrated: true,
    characterCount: 2,
    capabilities: FULL,
    accountId: 'acct-1',
    run: null,
    result: null,
    resultLoading: false,
    characters: characters([
      ['hero-a', 'not-backed-up'],
      ['hero-b', 'not-backed-up'],
    ]),
    hasAcknowledgedCurrentAccountCopy: false,
    ...overrides,
  };
}

describe('parsePlayerBackupRouteIntent', () => {
  it('accepts only setup, manage, and recovery', () => {
    expect(parsePlayerBackupRouteIntent('manage')).toBe('manage');
    expect(parsePlayerBackupRouteIntent('recovery')).toBe('recovery');
    expect(parsePlayerBackupRouteIntent('setup')).toBe('setup');
    expect(parsePlayerBackupRouteIntent('complete')).toBeNull();
    expect(parsePlayerBackupRouteIntent('')).toBeNull();
  });
});

describe('projectDashboardCharacterStatus', () => {
  it('keeps ongoing, paused, and one-time distinct from not backed up', () => {
    expect(
      projectDashboardCharacterStatus({
        outcome: 'protected',
        mode: 'ongoing',
        preference: 'on',
      })
    ).toBe('ongoing');
    expect(
      projectDashboardCharacterStatus({
        outcome: 'protected',
        mode: 'ongoing',
        preference: 'off',
      })
    ).toBe('paused');
    expect(
      projectDashboardCharacterStatus({
        outcome: 'protected',
        mode: 'one-time',
        preference: 'off',
      })
    ).toBe('saved-once');
    expect(projectDashboardCharacterStatus({})).toBe('not-backed-up');
  });

  it('does not treat a read-only identical preview as acknowledged backup', () => {
    expect(
      projectDashboardCharacterStatus({
        cloudState: 'identical',
        mode: 'one-time',
      })
    ).toBe('not-backed-up');
    expect(
      projectDashboardCharacterStatus({
        outcome: 'protected',
        cloudState: 'identical',
        mode: 'one-time',
        preference: 'off',
      })
    ).toBe('saved-once');
  });
});

describe('projectPlayerBackupDashboard', () => {
  it('projects not started when characters exist and nothing is acknowledged or resumable', () => {
    const view = projectPlayerBackupDashboard(input());
    expect(view.scenario).toBe('not-started');
    expect(view.title).toBe(COPY.dashboard.notStarted.title);
    expect(view.description).toBe(COPY.dashboard.notStarted.description);
    expect(view.primary.label).toBe(COPY.dashboard.notStarted.action);
    expect(view.primary.href).toBe('/player/backup');
    expect(view.secondary).toBeNull();
    expect(view.counts).toBeNull();
    expect(view.tone).toBe('none');
  });

  it('does not treat a safety receipt without a confirmed run as resumable', () => {
    const view = projectPlayerBackupDashboard(
      input({ hasAcknowledgedCurrentAccountCopy: false, run: null })
    );
    expect(view.scenario).toBe('not-started');
  });

  it('projects resumable from a confirmed unfinished run', () => {
    const view = projectPlayerBackupDashboard(
      input({
        run: {
          stage: 'confirmed',
          mode: 'ongoing',
          selectedCharacterIds: ['hero-a', 'hero-b'],
        },
        result: { complete: false, protected: [], queued: ['hero-a'] },
      })
    );
    expect(view.scenario).toBe('resumable');
    expect(view.title).toBe(COPY.dashboard.resumable.title);
    expect(view.description).toBe(COPY.dashboard.resumable.description);
    expect(view.primary.label).toBe(COPY.dashboard.resumable.action);
    expect(view.primary.href).toBe('/player/backup');
    expect(view.tone).toBe('warn');
  });

  it('stays resumable while the durable result is still loading', () => {
    const view = projectPlayerBackupDashboard(
      input({
        run: {
          stage: 'local-ready',
          mode: 'ongoing',
          selectedCharacterIds: ['hero-a'],
        },
        result: null,
        resultLoading: true,
        characters: characters([['hero-a', 'queued']]),
      })
    );
    expect(view.scenario).toBe('resumable');
    expect(view.counts).toBeNull();
  });

  it('never renders completed success with zero protected while work is queued', () => {
    const view = projectPlayerBackupDashboard(
      input({
        run: {
          stage: 'local-ready',
          mode: 'one-time',
          selectedCharacterIds: ['hero-a'],
        },
        result: { complete: false, protected: [], queued: ['hero-a'] },
        characters: characters([['hero-a', 'queued']]),
        hasAcknowledgedCurrentAccountCopy: false,
      })
    );
    expect(view.scenario).toBe('resumable');
    expect(view.description).not.toMatch(/0 character/);
  });

  it('projects ongoing complete with distinct protected, waiting, paused, and attention counts', () => {
    const view = projectPlayerBackupDashboard(
      input({
        characterCount: 5,
        hasAcknowledgedCurrentAccountCopy: true,
        run: {
          stage: 'local-ready',
          mode: 'ongoing',
          selectedCharacterIds: ['a', 'b', 'c', 'd', 'e'],
        },
        result: {
          complete: true,
          protected: ['a'],
          queued: ['b'],
        },
        characters: characters([
          ['a', 'ongoing'],
          ['b', 'queued'],
          ['c', 'paused'],
          ['d', 'needs-attention'],
          ['e', 'backing-up'],
        ]),
      })
    );
    expect(view.scenario).toBe('ongoing-complete');
    expect(view.title).toBe(COPY.dashboard.ongoing.title);
    expect(view.description).toBe(
      '1 character is protected. 1 needs attention.'
    );
    expect(view.primary.label).toBe(COPY.dashboard.manage);
    expect(view.primary.href).toBe('/player/backup?intent=manage');
    expect(view.secondary).toEqual({
      label: COPY.dashboard.restore,
      href: '/player/backup?intent=recovery',
      kind: 'restore',
    });
    expect(view.tone).toBe('ok');
    expect(view.counts).toEqual([
      { value: 1, label: COPY.dashboard.counts.protected },
      { value: 2, label: COPY.dashboard.counts.waiting },
      { value: 1, label: COPY.dashboard.counts.paused },
      { value: 1, label: COPY.dashboard.counts.attention },
    ]);
  });

  it('keeps paused and one-time distinct from not backed up', () => {
    const view = projectPlayerBackupDashboard(
      input({
        characterCount: 3,
        hasAcknowledgedCurrentAccountCopy: true,
        characters: characters([
          ['a', 'saved-once'],
          ['b', 'paused'],
          ['c', 'not-backed-up'],
        ]),
      })
    );
    expect(view.scenario).toBe('one-time-complete');
    expect(view.counts).toEqual([
      { value: 1, label: COPY.dashboard.counts.copiesSaved },
      { value: 1, label: COPY.dashboard.counts.paused },
      { value: 1, label: COPY.dashboard.counts.thisBrowserOnly },
    ]);
  });

  it('reports paused copies instead of zero saved when every acknowledged character is paused', () => {
    const view = projectPlayerBackupDashboard(
      input({
        characterCount: 2,
        hasAcknowledgedCurrentAccountCopy: true,
        characters: characters([
          ['a', 'paused'],
          ['b', 'paused'],
        ]),
      })
    );
    expect(view.scenario).toBe('one-time-complete');
    expect(view.description).not.toMatch(/0 character/);
    expect(view.counts).toEqual([
      { value: 2, label: COPY.dashboard.counts.paused },
    ]);
  });

  it('projects one-time complete when there is no stronger ongoing aggregate', () => {
    const view = projectPlayerBackupDashboard(
      input({
        characterCount: 4,
        hasAcknowledgedCurrentAccountCopy: true,
        run: {
          stage: 'local-ready',
          mode: 'one-time',
          selectedCharacterIds: ['a', 'b', 'c', 'd'],
        },
        result: {
          complete: true,
          protected: ['a', 'b', 'c', 'd'],
          queued: [],
        },
        characters: characters([
          ['a', 'saved-once'],
          ['b', 'saved-once'],
          ['c', 'saved-once'],
          ['d', 'saved-once'],
        ]),
      })
    );
    expect(view.scenario).toBe('one-time-complete');
    expect(view.title).toBe(COPY.dashboard.oneTime.title);
    expect(view.description).toBe(
      '4 characters were saved online. Later changes stay in this browser until you back up again.'
    );
    expect(view.primary.label).toBe(COPY.dashboard.manage);
    expect(view.tone).toBe('info');
  });

  it('does not treat later local-only characters as automatically protected', () => {
    const view = projectPlayerBackupDashboard(
      input({
        characterCount: 2,
        hasAcknowledgedCurrentAccountCopy: true,
        characters: characters([
          ['a', 'saved-once'],
          ['b', 'not-backed-up'],
        ]),
      })
    );
    expect(view.scenario).toBe('one-time-complete');
    expect(view.counts).toEqual([
      { value: 1, label: COPY.dashboard.counts.copiesSaved },
      { value: 1, label: COPY.dashboard.counts.thisBrowserOnly },
    ]);
  });

  it('projects no characters only from a hydrated empty roster', () => {
    expect(
      projectPlayerBackupDashboard(
        input({
          rosterHydrated: false,
          characterCount: 0,
          characters: [],
        })
      ).scenario
    ).not.toBe('no-characters');
    const view = projectPlayerBackupDashboard(
      input({ rosterHydrated: true, characterCount: 0, characters: [] })
    );
    expect(view.scenario).toBe('no-characters');
    expect(view.title).toBe(COPY.dashboard.noCharacters.title);
    expect(view.primary.label).toBe(COPY.dashboard.noCharacters.action);
    expect(view.primary.href).toBe('/player/characters/new');
    expect(view.secondary).toEqual({
      label: COPY.dashboard.noCharacters.secondary,
      href: '/player/backup?intent=recovery',
      kind: 'restore',
    });
    expect(view.tone).toBe('none');
  });

  it('projects unavailable without durable evidence when auth or lock is missing', () => {
    expect(
      projectPlayerBackupDashboard(input({ capabilities: UNAVAILABLE }))
        .scenario
    ).toBe('unavailable');
    const view = projectPlayerBackupDashboard(
      input({ capabilities: LOCK_UNSAFE })
    );
    expect(view.scenario).toBe('unavailable');
    expect(view.title).toBe(COPY.dashboard.unavailable.title);
    expect(view.description).toBe(COPY.dashboard.unavailable.description);
    expect(view.primary.label).toBe(COPY.dashboard.unavailable.action);
    expect(view.primary.href).toBe('/player/backup?intent=recovery');
    expect(view.secondary?.label).toBe(COPY.dashboard.unavailable.secondary);
    expect(view.tone).toBe('none');
  });

  it('keeps compact completed management when a lower capability is later unavailable', () => {
    const view = projectPlayerBackupDashboard(
      input({
        capabilities: UNAVAILABLE,
        hasAcknowledgedCurrentAccountCopy: true,
        characters: characters([
          ['a', 'ongoing'],
          ['b', 'paused'],
        ]),
      })
    );
    expect(view.scenario).toBe('ongoing-complete');
    expect(view.primary.kind).toBe('manage');
  });

  it.each([
    ['held-aside', 'held-aside'],
    ['failed', 'failed'],
    ['sign-in-required', 'sign-in-required'],
    ['offline', 'offline'],
  ] as const)('counts %s separately from not backed up', (_label, status) => {
    const view = projectPlayerBackupDashboard(
      input({
        hasAcknowledgedCurrentAccountCopy: true,
        characters: characters([
          ['a', 'ongoing'],
          ['b', status],
        ]),
      })
    );
    expect(view.scenario).toBe('ongoing-complete');
    const attentionOrWaiting = view.counts?.some(count => count.value >= 1);
    expect(attentionOrWaiting).toBe(true);
    expect(
      view.counts?.find(count => count.label === 'Not backed up')
    ).toBeUndefined();
  });
});
