import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';
import { openExistingRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';

import type { PlayerBackupCloudComparison } from './playerBackupCloudPreview';
import {
  dashboardOngoingDescription,
  dashboardOneTimeDescription,
  PLAYER_BACKUP_COPY as COPY,
} from './playerBackupCopy';
import type { PlayerBackupCapabilities } from './playerBackupFlags';
import type { PlayerBackupCharacterOutcome } from './playerBackupOnlineExecution';
import type { PlayerBackupRunStage } from './playerBackupRunRepository';
import {
  projectCharacterBackupStatus,
  type CharacterBackupEvidence,
  type CharacterBackupStatusKey,
} from './playerBackupStatus';

export type PlayerBackupDashboardScenario =
  | 'not-started'
  | 'resumable'
  | 'ongoing-complete'
  | 'one-time-complete'
  | 'no-characters'
  | 'unavailable';

export type PlayerBackupDashboardActionKind =
  | 'setup'
  | 'continue'
  | 'manage'
  | 'restore'
  | 'create'
  | 'safety';

export interface PlayerBackupDashboardCharacterEvidence {
  id: string;
  status: CharacterBackupStatusKey;
}

export interface PlayerBackupDashboardInput {
  rosterHydrated: boolean;
  characterCount: number;
  capabilities: Pick<
    PlayerBackupCapabilities,
    'setup' | 'authConfigured' | 'lockAvailable'
  >;
  accountId: string | null;
  run: {
    stage: PlayerBackupRunStage;
    mode: 'one-time' | 'ongoing';
    selectedCharacterIds: readonly string[];
  } | null;
  result: {
    complete: boolean;
    protected: readonly string[];
    queued: readonly string[];
  } | null;
  resultLoading: boolean;
  characters: readonly PlayerBackupDashboardCharacterEvidence[];
  hasAcknowledgedCurrentAccountCopy: boolean;
}

export interface PlayerBackupDashboardAction {
  label: string;
  href: string;
  kind: PlayerBackupDashboardActionKind;
}

export interface PlayerBackupDashboardCount {
  value: number;
  label: string;
}

export interface PlayerBackupDashboardView {
  scenario: PlayerBackupDashboardScenario;
  tone: 'ok' | 'warn' | 'info' | 'none';
  title: string;
  description: string;
  counts: PlayerBackupDashboardCount[] | null;
  primary: PlayerBackupDashboardAction;
  secondary: PlayerBackupDashboardAction | null;
}

export const PLAYER_BACKUP_ROUTE_INTENTS = [
  'setup',
  'manage',
  'recovery',
] as const;

export type PlayerBackupRouteIntent =
  (typeof PLAYER_BACKUP_ROUTE_INTENTS)[number];

export function parsePlayerBackupRouteIntent(
  value: string | null | undefined
): PlayerBackupRouteIntent | null {
  if (value === 'setup' || value === 'manage' || value === 'recovery') {
    return value;
  }
  return null;
}

export async function readPlayerBackupCharacterPolicies(options: {
  factory: IDBFactory;
  accountId: string;
  characterIds: readonly string[];
}): Promise<{
  characterPolicies: Record<string, 'on' | 'off'>;
  futureDefault: 'on' | 'off' | null;
}> {
  const database = await openExistingRollkeeperDatabase({
    factory: options.factory,
  });
  if (!database) return { characterPolicies: {}, futureDefault: null };
  try {
    const preferences = new AutomaticCharacterSyncPreferences(database);
    const confirmed = await preferences.readConfirmedSelection(
      `user:${options.accountId}`,
      options.characterIds
    );
    return {
      characterPolicies: confirmed.characterPolicies,
      futureDefault: confirmed.futureDefault,
    };
  } finally {
    database.close();
  }
}

export function projectDashboardCharacterStatus(input: {
  outcome?: PlayerBackupCharacterOutcome | null;
  preference?: 'on' | 'off' | null;
  cloudState?: PlayerBackupCloudComparison | null;
  conflict?: boolean;
  mode?: 'one-time' | 'ongoing' | null;
}): CharacterBackupStatusKey {
  const preference =
    input.preference ??
    (input.mode === 'ongoing'
      ? 'on'
      : input.mode === 'one-time'
        ? 'off'
        : null);
  const evidence: CharacterBackupEvidence = {
    preference,
    conflict: input.conflict,
  };
  if (input.outcome === 'protected') {
    evidence.acknowledged = true;
    if (preference === 'off' && input.mode === 'ongoing') {
      evidence.explicitlyPaused = true;
    }
  }
  if (input.outcome === 'queued' || input.outcome === 'pending') {
    evidence.queued = true;
  }
  if (input.outcome === 'offline' || input.cloudState === 'unavailable') {
    evidence.offline = true;
  }
  if (input.outcome === 'auth-required') evidence.authRequired = true;
  if (
    input.outcome === 'needs-attention' ||
    (input.cloudState === 'different' &&
      !(input.outcome === 'protected' && input.mode === 'one-time')) ||
    input.cloudState === 'newer'
  ) {
    evidence.conflict = true;
  }
  if (input.outcome === 'failed') evidence.failed = true;
  if (input.outcome === 'held-aside' || input.cloudState === 'future') {
    evidence.heldAside = true;
  }
  return projectCharacterBackupStatus(evidence).key;
}

const SETUP_HREF = '/player/backup';
const MANAGE_HREF = '/player/backup?intent=manage';
const RECOVERY_HREF = '/player/backup?intent=recovery';
const CREATE_HREF = '/player/characters/new';

const WAITING: ReadonlySet<CharacterBackupStatusKey> = new Set([
  'queued',
  'backing-up',
  'offline',
]);

const ATTENTION: ReadonlySet<CharacterBackupStatusKey> = new Set([
  'needs-attention',
  'failed',
  'held-aside',
  'sign-in-required',
]);

function countBy(
  characters: readonly PlayerBackupDashboardCharacterEvidence[],
  match: (status: CharacterBackupStatusKey) => boolean
): number {
  return characters.reduce(
    (total, character) => total + (match(character.status) ? 1 : 0),
    0
  );
}

function setupBlocked(
  capabilities: PlayerBackupDashboardInput['capabilities']
): boolean {
  return (
    !capabilities.authConfigured ||
    !capabilities.lockAvailable ||
    capabilities.setup === 'unavailable' ||
    capabilities.setup === 'read-only'
  );
}

function hasUnfinishedRun(input: PlayerBackupDashboardInput): boolean {
  if (!input.run) return false;
  if (input.resultLoading) return true;
  if (!input.result) return true;
  return !input.result.complete;
}

function action(
  kind: PlayerBackupDashboardActionKind,
  label: string,
  href: string
): PlayerBackupDashboardAction {
  return { kind, label, href };
}

export function projectPlayerBackupDashboard(
  input: PlayerBackupDashboardInput
): PlayerBackupDashboardView {
  const restore = action('restore', COPY.dashboard.restore, RECOVERY_HREF);

  if (input.rosterHydrated && input.characterCount === 0) {
    return {
      scenario: 'no-characters',
      tone: 'none',
      title: COPY.dashboard.noCharacters.title,
      description: COPY.dashboard.noCharacters.description,
      counts: null,
      primary: action(
        'create',
        COPY.dashboard.noCharacters.action,
        CREATE_HREF
      ),
      secondary: action(
        'restore',
        COPY.dashboard.noCharacters.secondary,
        RECOVERY_HREF
      ),
    };
  }

  const ongoingCount = countBy(
    input.characters,
    status => status === 'ongoing'
  );
  const pausedCount = countBy(input.characters, status => status === 'paused');
  const waitingCount = countBy(input.characters, status => WAITING.has(status));
  const attentionCount = countBy(input.characters, status =>
    ATTENTION.has(status)
  );
  const savedOnceCount = countBy(
    input.characters,
    status => status === 'saved-once'
  );
  const localOnlyCount = countBy(
    input.characters,
    status => status === 'not-backed-up'
  );

  if (hasUnfinishedRun(input) && ongoingCount === 0 && savedOnceCount === 0) {
    return {
      scenario: 'resumable',
      tone: 'warn',
      title: COPY.dashboard.resumable.title,
      description: COPY.dashboard.resumable.description,
      counts: null,
      primary: action('continue', COPY.dashboard.resumable.action, SETUP_HREF),
      secondary: null,
    };
  }

  if (ongoingCount > 0) {
    return {
      scenario: 'ongoing-complete',
      tone: 'ok',
      title: COPY.dashboard.ongoing.title,
      description: dashboardOngoingDescription(ongoingCount, attentionCount),
      counts: [
        { value: ongoingCount, label: COPY.dashboard.counts.protected },
        { value: waitingCount, label: COPY.dashboard.counts.waiting },
        { value: pausedCount, label: COPY.dashboard.counts.paused },
        { value: attentionCount, label: COPY.dashboard.counts.attention },
      ],
      primary: action('manage', COPY.dashboard.manage, MANAGE_HREF),
      secondary: restore,
    };
  }

  if (
    input.hasAcknowledgedCurrentAccountCopy &&
    savedOnceCount + pausedCount > 0
  ) {
    const counts = [
      ...(savedOnceCount > 0
        ? [
            {
              value: savedOnceCount,
              label:
                savedOnceCount === 1
                  ? COPY.dashboard.counts.copySaved
                  : COPY.dashboard.counts.copiesSaved,
            },
          ]
        : []),
      ...(pausedCount > 0
        ? [{ value: pausedCount, label: COPY.dashboard.counts.paused }]
        : []),
      ...(localOnlyCount > 0
        ? [
            {
              value: localOnlyCount,
              label: COPY.dashboard.counts.thisBrowserOnly,
            },
          ]
        : []),
    ];
    return {
      scenario: 'one-time-complete',
      tone: 'info',
      title: COPY.dashboard.oneTime.title,
      description: dashboardOneTimeDescription(savedOnceCount, pausedCount),
      counts,
      primary: action('manage', COPY.dashboard.manage, MANAGE_HREF),
      secondary: restore,
    };
  }

  if (setupBlocked(input.capabilities)) {
    return {
      scenario: 'unavailable',
      tone: 'none',
      title: COPY.dashboard.unavailable.title,
      description: COPY.dashboard.unavailable.description,
      counts: null,
      primary: action(
        'safety',
        COPY.dashboard.unavailable.action,
        RECOVERY_HREF
      ),
      secondary: action(
        'restore',
        COPY.dashboard.unavailable.secondary,
        RECOVERY_HREF
      ),
    };
  }

  return {
    scenario: 'not-started',
    tone: 'none',
    title: COPY.dashboard.notStarted.title,
    description: COPY.dashboard.notStarted.description,
    counts: null,
    primary: action('setup', COPY.dashboard.notStarted.action, SETUP_HREF),
    secondary: null,
  };
}
