import { derivePlayerBackupCapabilities } from '@/lib/playerBackup/playerBackupFlags';
import {
  projectPlayerBackupDashboard,
  type PlayerBackupDashboardView,
} from '@/lib/playerBackup/playerBackupDashboard';
import type { CharacterBackupStatusKey } from '@/lib/playerBackup/playerBackupStatus';

export const PLAYER_BACKUP_DASHBOARD_SCENARIOS = [
  'not-started',
  'resumable',
  'ongoing-complete',
  'one-time-complete',
  'no-characters',
  'unavailable',
] as const;

export type PlayerBackupDashboardScenarioId =
  (typeof PLAYER_BACKUP_DASHBOARD_SCENARIOS)[number];

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

function rows(
  entries: Array<[string, CharacterBackupStatusKey]>
): Array<{ id: string; status: CharacterBackupStatusKey }> {
  return entries.map(([id, status]) => ({ id, status }));
}

export function createPlayerBackupDashboardFixture(
  scenario: PlayerBackupDashboardScenarioId
): PlayerBackupDashboardView {
  switch (scenario) {
    case 'not-started':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 2,
        capabilities: FULL,
        accountId: 'acct-1',
        run: null,
        result: null,
        resultLoading: false,
        characters: rows([
          ['hero-a', 'not-backed-up'],
          ['hero-b', 'not-backed-up'],
        ]),
        hasAcknowledgedCurrentAccountCopy: false,
      });
    case 'resumable':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 2,
        capabilities: FULL,
        accountId: 'acct-1',
        run: {
          stage: 'confirmed',
          mode: 'ongoing',
          selectedCharacterIds: ['hero-a', 'hero-b'],
        },
        result: { complete: false, protected: [], queued: ['hero-a'] },
        resultLoading: false,
        characters: rows([
          ['hero-a', 'queued'],
          ['hero-b', 'not-backed-up'],
        ]),
        hasAcknowledgedCurrentAccountCopy: false,
      });
    case 'ongoing-complete':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 5,
        capabilities: FULL,
        accountId: 'acct-1',
        run: {
          stage: 'local-ready',
          mode: 'ongoing',
          selectedCharacterIds: ['a', 'b', 'c', 'd', 'e'],
        },
        result: { complete: true, protected: ['a'], queued: ['b'] },
        resultLoading: false,
        characters: rows([
          ['a', 'ongoing'],
          ['b', 'queued'],
          ['c', 'paused'],
          ['d', 'needs-attention'],
          ['e', 'backing-up'],
        ]),
        hasAcknowledgedCurrentAccountCopy: true,
      });
    case 'one-time-complete':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 4,
        capabilities: FULL,
        accountId: 'acct-1',
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
        resultLoading: false,
        characters: rows([
          ['a', 'saved-once'],
          ['b', 'saved-once'],
          ['c', 'saved-once'],
          ['d', 'saved-once'],
        ]),
        hasAcknowledgedCurrentAccountCopy: true,
      });
    case 'no-characters':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 0,
        capabilities: FULL,
        accountId: 'acct-1',
        run: null,
        result: null,
        resultLoading: false,
        characters: [],
        hasAcknowledgedCurrentAccountCopy: false,
      });
    case 'unavailable':
      return projectPlayerBackupDashboard({
        rosterHydrated: true,
        characterCount: 2,
        capabilities: UNAVAILABLE,
        accountId: null,
        run: null,
        result: null,
        resultLoading: false,
        characters: rows([
          ['hero-a', 'not-backed-up'],
          ['hero-b', 'not-backed-up'],
        ]),
        hasAcknowledgedCurrentAccountCopy: false,
      });
  }
}
