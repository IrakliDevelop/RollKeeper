import { buildSharedInitiative } from '@/utils/buildSharedInitiative';
import type { CombatConfig } from '@/types/encounter';

import type {
  PublicationPayload,
  PublicationRunState,
} from './combatPublisher';
import { PUBLIC_ID, type TableCombatReadModel } from './combatReadModel';
import type { TableWorkspaceSnapshotV1 } from './schema';

/**
 * Player-facing initiative for a scene run: the existing
 * `buildSharedInitiative` masking over the read model, whose entity ids are
 * scene member ids. No scene name, run label, actor/encounter id or future
 * run reaches the payload; any identity failing the server grammar blocks
 * publication instead of sending a malformed request (R2-1).
 */
export function buildScenePublication(
  model: TableCombatReadModel,
  config: CombatConfig
): PublicationPayload {
  if (!model.running) return { status: 'not-running' };
  if (
    !PUBLIC_ID.test(model.run.runId) ||
    model.participants.some(view => !view.validIdentity)
  )
    return { status: 'invalid-identity' };
  // Never publish 0 HP / dead derived from missing player data (F1).
  if (model.participants.some(view => view.missingPlayerData))
    return { status: 'waiting-player-data' };
  // `name` stays local: buildSharedInitiative never publishes it, but the
  // encounter label is replaced anyway so nothing private is carried along.
  const initiative = buildSharedInitiative(
    { ...model.encounter, name: '' },
    config
  );
  return { status: 'ok', initiative };
}

/** Publication inputs for the lease holder: the active run and pending ends. */
export function publicationRunState(
  snapshot: TableWorkspaceSnapshotV1
): PublicationRunState {
  const activeRunId = snapshot.campaign?.activeRunId ?? null;
  const active = activeRunId
    ? snapshot.encounters.find(run => run.runId === activeRunId && run.isActive)
    : undefined;
  return {
    active: active
      ? {
          runId: active.runId,
          combatGeneration: active.combatGeneration ?? 0,
          publication: active.publication ?? null,
        }
      : null,
    pendingEnds: snapshot.encounters
      .filter(
        run =>
          run.publication?.intent === 'end' &&
          !run.publication.acknowledged &&
          run.runId !== activeRunId
      )
      .map(run => ({
        runId: run.runId,
        combatGeneration: run.publication!.combatGeneration,
      })),
  };
}
