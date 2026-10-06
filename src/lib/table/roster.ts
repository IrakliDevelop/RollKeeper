import { PLAYER_TOKEN_KIND } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import { ANNOTATIONS_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { playerLayerId } from '@/components/ui/campaign/location-map/playerLayer';
import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/location-map/tokenIdentity';

import type { TableRepository, TableWorkspaceMutation } from './repository';
import {
  canonicalJson,
  type JsonObject,
  type TableActorLiveStatsV1,
  type TableActorProfileV1,
  type TableActorRecordV1,
  type TableCommitResult,
  type TableMemberControlV1,
  type TableSceneMemberV1,
  type TableSceneRecordV1,
  type TableWorkspaceSnapshotV1,
} from './schema';

/**
 * Pure scene-roster identity, alias and command planning for PR02.
 *
 * Control identity is the server-authorized campaign player id
 * (`legacyPlayerId`, the relay principal). It comes only from the campaign
 * players snapshot (`GET /api/campaign/[code]/players`) and is never inferred
 * from names, display names or account ids. `sceneMemberId` is a local
 * binding key and never authorizes anything.
 */

/** One entry of the server-authorized campaign players snapshot. */
export interface TableCampaignPlayer {
  playerId: string;
  characterId: string;
  name: string;
}

export type TablePlayerVerification =
  | { status: 'verified'; legacyPlayerId: string; characterId: string }
  | { status: 'missing' }
  | { status: 'ambiguous' };

/**
 * Exact identity verification: a player id must appear exactly once, or a
 * character id must map to exactly one player id. Anything else is missing
 * or ambiguous and leaves control with the DM.
 */
export function verifyPlayerIdentity(
  players: readonly TableCampaignPlayer[],
  id: string
): TablePlayerVerification {
  const byPlayer = players.filter(player => player.playerId === id);
  if (byPlayer.length > 1) return { status: 'ambiguous' };
  if (byPlayer.length === 1) {
    return {
      status: 'verified',
      legacyPlayerId: id,
      characterId: byPlayer[0]!.characterId,
    };
  }
  const byCharacter = players.filter(player => player.characterId === id);
  const playerIds = new Set(byCharacter.map(player => player.playerId));
  if (playerIds.size > 1) return { status: 'ambiguous' };
  if (playerIds.size === 1) {
    return {
      status: 'verified',
      legacyPlayerId: byCharacter[0]!.playerId,
      characterId: id,
    };
  }
  return { status: 'missing' };
}

// ─── Token control fields (R1, R9, C6) ───────────────────────────────────

type TokenFields = Record<string, unknown>;

/** Fields stamped on a DM-placed party token: the shipped player token kind. */
export function partyTokenFields(
  sceneMemberId: string,
  legacyPlayerId: string
): TokenFields {
  return {
    tokenKind: PLAYER_TOKEN_KIND,
    characterId: legacyPlayerId,
    layerId: playerLayerId(legacyPlayerId),
    sceneMemberId,
  };
}

/** DM-managed token: combatant kind keyed by the stable member id. */
export function dmTokenFields(sceneMemberId: string): TokenFields {
  return {
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId: sceneMemberId,
    sceneMemberId,
    layerId: ANNOTATIONS_LAYER_ID,
  };
}

/**
 * Explicit Give player control / Return to DM control conversion. Element
 * id and `sceneMemberId` are kept; the relay derives every player right from
 * these fields alone.
 */
export function tokenControlPatch(
  token: TokenFields,
  sceneMemberId: string,
  control: TableMemberControlV1
): { set: TokenFields; unset: string[] } {
  if (control.kind === 'player') {
    return {
      set: partyTokenFields(sceneMemberId, control.legacyPlayerId),
      unset: 'entityId' in token ? ['entityId'] : [],
    };
  }
  return {
    set: dmTokenFields(sceneMemberId),
    unset: 'characterId' in token ? ['characterId'] : [],
  };
}

export function tokenMatchesControl(
  token: TokenFields,
  control: TableMemberControlV1
): boolean {
  if (control.kind === 'dm') return token.tokenKind !== PLAYER_TOKEN_KIND;
  return (
    token.tokenKind === PLAYER_TOKEN_KIND &&
    token.characterId === control.legacyPlayerId &&
    token.layerId === playerLayerId(control.legacyPlayerId)
  );
}

// ─── Derived roster ─────────────────────────────────────────────────────

export type TableRosterControlStatus =
  | { kind: 'player'; legacyPlayerId: string }
  | { kind: 'dm' }
  | {
      kind: 'unavailable';
      reason:
        | 'identity-unresolved'
        | 'control-unavailable'
        /** No current players snapshot: never claim player control. */
        | 'verification-unavailable';
    };

export interface TableRosterEntry {
  sceneMemberId: string | null;
  actorId: string;
  /** PR01-adopted encounter entity id (legacy combatant token key), if any. */
  sourceEntityId: string | null;
  name: string;
  category: TableActorProfileV1['category'];
  avatarUrl: string | null;
  tokenCells: number;
  walkFeet: number | null;
  /** PR01-adopted encounter PC: DM-managed copy, read-only stats (R8). */
  adoptedPc: boolean;
  /** Party member or adopted PC: the only members a player may control. */
  playerIdentity: boolean;
  statsEditable: boolean;
  liveStats: TableActorLiveStatsV1 | null;
  control: TableRosterControlStatus;
  /** Verified identity of a party or adopted PC actor, if any. */
  verifiedLegacyPlayerId: string | null;
  /**
   * Persisted identity claim (explicit control, party reference or verified
   * adopted PC) used only for exact alias matching and movement lookup —
   * never as an authorization signal.
   */
  identityLegacyPlayerId: string | null;
  boundTokenIds: string[];
  aliasTokenIds: string[];
  /** Bound tokens whose control fields disagree with the member's control. */
  mismatchedTokenIds: string[];
  removed: boolean;
}

export interface TableSceneRoster {
  entries: TableRosterEntry[];
  /** Tokens matching more than one member: unbound until the DM binds one. */
  ambiguousTokenIds: string[];
  /** Token-kind elements with no exact identity match (or no DM provenance). */
  unmatchedTokenIds: string[];
  /** Some member predates PR02 and needs `ensureSceneMemberIds`. */
  needsSceneMemberIds: boolean;
}

interface AdoptedIdentity {
  encounterId: string;
  entityId: string;
  entity: Record<string, unknown> | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** PR01 adoption identity `<encounterId>:<entityId>` plus the retained source entity. */
function adoptedIdentity(
  snapshot: TableWorkspaceSnapshotV1,
  actorId: string,
  sceneId?: string
): AdoptedIdentity | null {
  for (const run of snapshot.encounters) {
    if (sceneId !== undefined && run.sceneId !== sceneId) continue;
    const encounterId = run.sourceEncounterId;
    if (!encounterId || !actorId.startsWith(`${encounterId}:`)) continue;
    const entityId = actorId.slice(encounterId.length + 1);
    const source = snapshot.sources.find(
      value => value.sourceKey === `encounter:${encounterId}`
    );
    let entity: Record<string, unknown> | null = null;
    if (source) {
      try {
        const parsed = record(JSON.parse(source.rawJson) as unknown);
        const entities = Array.isArray(parsed?.entities) ? parsed.entities : [];
        entity =
          entities.map(record).find(value => value?.id === entityId) ?? null;
      } catch {
        entity = null;
      }
    }
    return { encounterId, entityId, entity };
  }
  return null;
}

function adoptedPcIdentity(
  snapshot: TableWorkspaceSnapshotV1,
  actor: TableActorRecordV1,
  sceneId?: string
): AdoptedIdentity | null {
  if (actor.actorKind !== 'dm-managed') return null;
  const adopted = adoptedIdentity(snapshot, actor.actorId, sceneId);
  return adopted?.entity?.type === 'player' ? adopted : null;
}

function referenceLegacyId(actor: TableActorRecordV1): string | null {
  const reference = actor.playerReference;
  return reference ? (reference.legacyPlayerId ?? reference.playerId) : null;
}

function exactlyVerified(
  players: readonly TableCampaignPlayer[] | undefined,
  legacyPlayerId: string
): boolean {
  if (!players) return false;
  const verification = verifyPlayerIdentity(players, legacyPlayerId);
  return (
    verification.status === 'verified' &&
    verification.legacyPlayerId === legacyPlayerId
  );
}

function memberControl(
  member: TableSceneMemberV1,
  actor: TableActorRecordV1 | undefined,
  adoptedPc: AdoptedIdentity | null,
  verifiedLegacyPlayerId: string | null,
  players: readonly TableCampaignPlayer[] | undefined
): TableRosterControlStatus {
  if (member.control?.kind === 'dm') return { kind: 'dm' };
  if (
    !players &&
    (member.control?.kind === 'player' ||
      actor?.actorKind === 'player-reference' ||
      adoptedPc)
  ) {
    return { kind: 'unavailable', reason: 'verification-unavailable' };
  }
  if (member.control?.kind === 'player') {
    return exactlyVerified(players, member.control.legacyPlayerId)
      ? { kind: 'player', legacyPlayerId: member.control.legacyPlayerId }
      : { kind: 'unavailable', reason: 'control-unavailable' };
  }
  if (actor?.actorKind === 'player-reference') {
    return verifiedLegacyPlayerId
      ? { kind: 'player', legacyPlayerId: verifiedLegacyPlayerId }
      : { kind: 'unavailable', reason: 'control-unavailable' };
  }
  if (adoptedPc && !verifiedLegacyPlayerId) {
    return { kind: 'unavailable', reason: 'identity-unresolved' };
  }
  return { kind: 'dm' };
}

function effectiveControl(
  status: TableRosterControlStatus
): TableMemberControlV1 {
  return status.kind === 'player'
    ? { kind: 'player', legacyPlayerId: status.legacyPlayerId }
    : { kind: 'dm' };
}

function categoryOf(
  actor: TableActorRecordV1 | undefined,
  adopted: AdoptedIdentity | null
): TableActorProfileV1['category'] {
  if (actor?.profile) return actor.profile.category;
  if (actor?.actorKind === 'player-reference') return 'pc';
  const type = adopted?.entity?.type;
  if (type === 'player') return 'pc';
  if (type === 'monster') return 'monster';
  return 'npc';
}

function nameOf(
  actor: TableActorRecordV1 | undefined,
  legacyPlayerId: string | null,
  players: readonly TableCampaignPlayer[] | undefined
): string {
  if (actor?.liveStats) return actor.liveStats.name;
  const cached = actor?.cachedPlayerData?.name;
  if (typeof cached === 'string' && cached.length > 0) return cached;
  const player = players?.find(entry => entry.playerId === legacyPlayerId);
  return player?.name ?? legacyPlayerId ?? actor?.actorId ?? 'Unknown';
}

/**
 * Canvas tokens known to the DM. Live elements decide existence and current
 * fields; provenance (`ownerId`) only ever comes from the DM-readable
 * authority checkpoint, because the live DM store strips it.
 */
function knownTokens(
  scene: TableSceneRecordV1,
  canvasElements: readonly Record<string, unknown>[] | undefined
): Record<string, unknown>[] {
  const state = record(scene.canvasCheckpoint?.state);
  const checkpoint = (Array.isArray(state?.elements) ? state.elements : [])
    .map(record)
    .filter((value): value is Record<string, unknown> => value !== null);
  const provenance = new Map(
    checkpoint.map(element => [element.id, element.ownerId] as const)
  );
  const source = canvasElements ?? checkpoint;
  return source.map(element => {
    const ownerId = provenance.get(element.id);
    const copy = { ...element };
    delete copy.ownerId;
    return ownerId === undefined ? copy : { ...copy, ownerId };
  });
}

export function deriveSceneRoster(options: {
  snapshot: TableWorkspaceSnapshotV1;
  sceneId: string;
  players?: readonly TableCampaignPlayer[];
  canvasElements?: readonly Record<string, unknown>[];
  dmPrincipals?: readonly string[];
}): TableSceneRoster {
  const { snapshot, sceneId, players } = options;
  const scene = snapshot.scenes.find(value => value.sceneId === sceneId);
  if (!scene) {
    return {
      entries: [],
      ambiguousTokenIds: [],
      unmatchedTokenIds: [],
      needsSceneMemberIds: false,
    };
  }
  const actors = new Map(
    snapshot.actors.map(actor => [actor.actorId, actor] as const)
  );
  const entries = scene.members.map(member => {
    const actor = actors.get(member.actorId);
    const adopted = actor
      ? adoptedIdentity(snapshot, actor.actorId, sceneId)
      : null;
    const adoptedPc = actor
      ? adoptedPcIdentity(snapshot, actor, sceneId)
      : null;
    let verifiedLegacyPlayerId: string | null = null;
    if (actor?.actorKind === 'player-reference') {
      const legacy = referenceLegacyId(actor);
      verifiedLegacyPlayerId =
        legacy && exactlyVerified(players, legacy) ? legacy : null;
    } else if (adoptedPc && players) {
      const claim = adoptedPc.entity?.playerCharacterId;
      const verification =
        typeof claim === 'string'
          ? verifyPlayerIdentity(players, claim)
          : ({ status: 'missing' } as const);
      verifiedLegacyPlayerId =
        verification.status === 'verified' ? verification.legacyPlayerId : null;
    }
    const control = memberControl(
      member,
      actor,
      adoptedPc,
      verifiedLegacyPlayerId,
      players
    );
    const entry: TableRosterEntry = {
      sceneMemberId: member.sceneMemberId ?? null,
      actorId: member.actorId,
      sourceEntityId: adopted?.entityId ?? null,
      name: nameOf(actor, verifiedLegacyPlayerId, players),
      category: categoryOf(actor, adopted),
      avatarUrl: actor?.profile?.avatarUrl ?? null,
      tokenCells: actor?.profile?.tokenCells ?? 1,
      walkFeet: actor?.profile?.walkFeet ?? null,
      adoptedPc: adoptedPc !== null,
      playerIdentity:
        actor?.actorKind === 'player-reference' || adoptedPc !== null,
      statsEditable: actor?.actorKind === 'dm-managed' && adoptedPc === null,
      liveStats: actor?.liveStats ?? null,
      control,
      verifiedLegacyPlayerId,
      identityLegacyPlayerId:
        member.control?.kind === 'player'
          ? member.control.legacyPlayerId
          : actor?.actorKind === 'player-reference'
            ? referenceLegacyId(actor)
            : verifiedLegacyPlayerId,
      boundTokenIds: [...member.tokenIds],
      aliasTokenIds: [],
      mismatchedTokenIds: [],
      removed: member.removedAt !== undefined,
    };
    return { entry, member, adopted };
  });

  const tokens = knownTokens(scene, options.canvasElements);
  const tokensById = new Map(tokens.map(token => [token.id, token] as const));
  const bound = new Set(scene.members.flatMap(member => member.tokenIds));
  const dm = new Set(options.dmPrincipals ?? []);
  const active = entries.filter(item => !item.entry.removed);
  const ambiguousTokenIds: string[] = [];
  const unmatchedTokenIds: string[] = [];
  for (const token of tokens) {
    const id = token.id;
    if (typeof id !== 'string' || bound.has(id)) continue;
    if (typeof token.tokenKind !== 'string') continue;
    let candidates: typeof active = [];
    if (typeof token.sceneMemberId === 'string') {
      candidates = active.filter(
        item => item.member.sceneMemberId === token.sceneMemberId
      );
    } else if (
      token.tokenKind === PLAYER_TOKEN_KIND &&
      typeof token.characterId === 'string'
    ) {
      candidates = active.filter(
        item => item.entry.identityLegacyPlayerId === token.characterId
      );
    } else if (
      token.tokenKind === COMBATANT_TOKEN_KIND &&
      typeof token.entityId === 'string' &&
      typeof token.ownerId === 'string' &&
      dm.has(token.ownerId)
    ) {
      candidates = active.filter(
        item => item.adopted?.entityId === token.entityId
      );
    }
    if (candidates.length === 1) candidates[0]!.entry.aliasTokenIds.push(id);
    else if (candidates.length > 1) ambiguousTokenIds.push(id);
    else unmatchedTokenIds.push(id);
  }
  for (const { entry } of entries) {
    const control = effectiveControl(entry.control);
    entry.mismatchedTokenIds = entry.boundTokenIds.filter(tokenId => {
      const token = tokensById.get(tokenId);
      return token !== undefined && !tokenMatchesControl(token, control);
    });
  }
  return {
    entries: entries.map(item => item.entry),
    ambiguousTokenIds,
    unmatchedTokenIds,
    needsSceneMemberIds: scene.members.some(
      member => member.sceneMemberId === undefined
    ),
  };
}

// ─── Typed commands ─────────────────────────────────────────────────────

export type TableRosterCommandV1 =
  | {
      type: 'roster.ensureSceneMemberIds';
      sceneId: string;
      assignments: Array<{ actorId: string; sceneMemberId: string }>;
    }
  | {
      type: 'roster.addPartyMember';
      sceneId: string;
      campaignId: string;
      legacyPlayerId: string;
      characterId: string;
      name: string;
      actorId: string;
      sceneMemberId: string;
      at: string;
    }
  | {
      type: 'roster.addCreatureInstance' | 'roster.addManualParticipant';
      sceneId: string;
      actorId: string;
      sceneMemberId: string;
      liveStats: TableActorLiveStatsV1;
      profile: TableActorProfileV1;
      at: string;
    }
  | {
      type: 'roster.bindToken' | 'roster.unbindToken';
      sceneId: string;
      sceneMemberId: string;
      tokenId: string;
      at: string;
    }
  | {
      type: 'roster.updateActorStats';
      actorId: string;
      liveStats: TableActorLiveStatsV1;
      at: string;
    }
  | {
      type: 'roster.reassignControl';
      sceneId: string;
      sceneMemberId: string;
      control: { kind: 'player'; legacyPlayerId: string } | { kind: 'dm' };
      at: string;
    }
  | {
      type: 'roster.removeMember';
      sceneId: string;
      sceneMemberId: string;
      at: string;
    };

export type TableRosterRejection = Extract<
  TableCommitResult,
  { status: 'rejected' }
>;

export type TableRosterPlan =
  | { status: 'planned'; mutation: TableWorkspaceMutation }
  | { status: 'unchanged' }
  | TableRosterRejection;

export type TableRosterResult =
  | TableCommitResult
  | { status: 'unchanged'; revision: number };

const ROSTER_TYPES = new Set([
  'roster.ensureSceneMemberIds',
  'roster.addPartyMember',
  'roster.addCreatureInstance',
  'roster.addManualParticipant',
  'roster.bindToken',
  'roster.unbindToken',
  'roster.updateActorStats',
  'roster.reassignControl',
  'roster.removeMember',
]);

function validateRosterCommand(command: unknown): boolean {
  const value = record(command);
  if (!value || !ROSTER_TYPES.has(String(value.type))) return false;
  try {
    canonicalJson(value);
  } catch {
    return false;
  }
  const ids = Object.entries(value).filter(
    ([key]) =>
      key.endsWith('Id') || key === 'legacyPlayerId' || key === 'characterId'
  );
  return ids.every(([, id]) => typeof id === 'string' && id.length > 0);
}

function rejected(
  reason: TableRosterRejection['reason'],
  detail: string
): TableRosterRejection {
  return { status: 'rejected', reason, detail };
}

function putScene(
  scene: TableSceneRecordV1,
  members: TableSceneMemberV1[],
  at?: string
): TableRosterPlan {
  return {
    status: 'planned',
    mutation: {
      scenes: {
        put: [
          {
            ...structuredClone(scene),
            members,
            updatedAt: at ?? scene.updatedAt,
          },
        ],
      },
    },
  };
}

function verifiedControl(
  players: readonly TableCampaignPlayer[] | undefined,
  legacyPlayerId: string,
  characterId?: string
): TableMemberControlV1 | null {
  if (!players) return null;
  const matches = players.filter(player => player.playerId === legacyPlayerId);
  if (matches.length !== 1) return null;
  if (characterId !== undefined && matches[0]!.characterId !== characterId)
    return null;
  return {
    kind: 'player',
    legacyPlayerId,
    characterId: matches[0]!.characterId,
  };
}

function withoutRemoval(
  member: TableSceneMemberV1,
  control?: TableMemberControlV1
): TableSceneMemberV1 {
  const next = structuredClone(member);
  delete next.removedAt;
  if (control) next.control = control;
  return next;
}

/**
 * Plans one roster command against the snapshot whose revision equals the
 * command's expected revision. The repository's CAS turns any concurrent
 * change into a conflict, so the plan never applies on newer state.
 */
export function planRosterCommand(
  snapshot: TableWorkspaceSnapshotV1,
  command: TableRosterCommandV1,
  players?: readonly TableCampaignPlayer[]
): TableRosterPlan {
  if (command.type === 'roster.updateActorStats') {
    const actor = snapshot.actors.find(
      value => value.actorId === command.actorId
    );
    if (!actor) return rejected('invalid-reference', 'actor-missing');
    if (
      actor.actorKind !== 'dm-managed' ||
      adoptedPcIdentity(snapshot, actor) !== null
    ) {
      return rejected('invalid-command', 'read-only');
    }
    if (canonicalJson(actor.liveStats) === canonicalJson(command.liveStats))
      return { status: 'unchanged' };
    return {
      status: 'planned',
      mutation: {
        actors: {
          put: [
            {
              ...structuredClone(actor),
              liveStats: structuredClone(command.liveStats),
              updatedAt: command.at,
            },
          ],
        },
      },
    };
  }

  const scene = snapshot.scenes.find(
    value => value.sceneId === command.sceneId
  );
  if (!scene) return rejected('invalid-reference', 'scene-missing');
  const members = structuredClone(scene.members);
  const memberIndex =
    'sceneMemberId' in command
      ? members.findIndex(
          member => member.sceneMemberId === command.sceneMemberId
        )
      : -1;

  switch (command.type) {
    case 'roster.ensureSceneMemberIds': {
      const assignments = new Map(
        command.assignments.map(
          entry => [entry.actorId, entry.sceneMemberId] as const
        )
      );
      let changed = false;
      for (const member of members) {
        if (member.sceneMemberId !== undefined) continue;
        const assigned = assignments.get(member.actorId);
        if (!assigned) return rejected('invalid-command', 'assignment-missing');
        member.sceneMemberId = assigned;
        changed = true;
      }
      return changed ? putScene(scene, members) : { status: 'unchanged' };
    }
    case 'roster.addPartyMember': {
      const control = verifiedControl(
        players,
        command.legacyPlayerId,
        command.characterId
      );
      if (!control) return rejected('invalid-command', 'control-unavailable');
      const adoptedPcs = members.filter(member => {
        const actor = snapshot.actors.find(
          value => value.actorId === member.actorId
        );
        const adopted = actor
          ? adoptedPcIdentity(snapshot, actor, scene.sceneId)
          : null;
        const claim = adopted?.entity?.playerCharacterId;
        if (!players || typeof claim !== 'string') return false;
        const verification = verifyPlayerIdentity(players, claim);
        return (
          verification.status === 'verified' &&
          verification.legacyPlayerId === command.legacyPlayerId
        );
      });
      if (adoptedPcs.length > 1)
        return rejected('invalid-command', 'identity-ambiguous');
      const reference = snapshot.actors.find(
        actor =>
          actor.actorKind === 'player-reference' &&
          referenceLegacyId(actor) === command.legacyPlayerId
      );
      const linked =
        adoptedPcs[0] ??
        (reference
          ? members.find(member => member.actorId === reference.actorId)
          : undefined);
      if (linked) {
        const index = members.indexOf(linked);
        const linksAdopted = linked === adoptedPcs[0];
        const alreadyLinked =
          linked.removedAt === undefined &&
          (!linksAdopted || linked.control?.kind === 'player');
        if (alreadyLinked) return { status: 'unchanged' };
        members[index] = withoutRemoval(
          linked,
          linksAdopted || !linked.control ? control : undefined
        );
        return putScene(scene, members, command.at);
      }
      members.push({
        actorId: reference?.actorId ?? command.actorId,
        tokenIds: [],
        sceneMemberId: command.sceneMemberId,
        control,
      });
      if (reference) return putScene(scene, members, command.at);
      const actor: TableActorRecordV1 = {
        schemaVersion: 1,
        workspaceKey: scene.workspaceKey,
        actorId: command.actorId,
        actorKind: 'player-reference',
        liveStats: null,
        playerReference: {
          campaignId: command.campaignId,
          playerId: command.legacyPlayerId,
          legacyPlayerId: command.legacyPlayerId,
          ...(command.characterId === command.legacyPlayerId
            ? {}
            : { characterId: command.characterId }),
        },
        cachedPlayerData: { name: command.name } as JsonObject,
        playerConditionOverlay: {
          suppressedSourceConditionIds: [],
          dmConditions: [],
        },
        createdAt: command.at,
        updatedAt: command.at,
      };
      const plan = putScene(scene, members, command.at);
      if (plan.status === 'planned') plan.mutation.actors = { put: [actor] };
      return plan;
    }
    case 'roster.addCreatureInstance':
    case 'roster.addManualParticipant': {
      if (snapshot.actors.some(actor => actor.actorId === command.actorId))
        return rejected('invalid-command', 'actor-exists');
      members.push({
        actorId: command.actorId,
        tokenIds: [],
        sceneMemberId: command.sceneMemberId,
      });
      const plan = putScene(scene, members, command.at);
      if (plan.status === 'planned') {
        plan.mutation.actors = {
          put: [
            {
              schemaVersion: 1,
              workspaceKey: scene.workspaceKey,
              actorId: command.actorId,
              actorKind: 'dm-managed',
              liveStats: structuredClone(command.liveStats),
              playerReference: null,
              cachedPlayerData: null,
              playerConditionOverlay: null,
              profile: structuredClone(command.profile),
              createdAt: command.at,
              updatedAt: command.at,
            },
          ],
        };
      }
      return plan;
    }
    case 'roster.bindToken':
    case 'roster.unbindToken': {
      const member = members[memberIndex];
      if (!member || member.removedAt !== undefined)
        return rejected('invalid-reference', 'member-missing');
      const has = member.tokenIds.includes(command.tokenId);
      if (command.type === 'roster.bindToken') {
        if (has) return { status: 'unchanged' };
        for (const other of members) {
          other.tokenIds = other.tokenIds.filter(id => id !== command.tokenId);
        }
        member.tokenIds.push(command.tokenId);
      } else {
        if (!has) return { status: 'unchanged' };
        member.tokenIds = member.tokenIds.filter(id => id !== command.tokenId);
      }
      return putScene(scene, members, command.at);
    }
    case 'roster.reassignControl': {
      const member = members[memberIndex];
      if (!member || member.removedAt !== undefined)
        return rejected('invalid-reference', 'member-missing');
      const actor = snapshot.actors.find(
        value => value.actorId === member.actorId
      );
      // Creatures and manual PCs have no player identity: DM-only (R8/R9).
      if (
        command.control.kind === 'player' &&
        actor?.actorKind !== 'player-reference' &&
        !(actor && adoptedPcIdentity(snapshot, actor, scene.sceneId))
      )
        return rejected('invalid-command', 'dm-only');
      const control =
        command.control.kind === 'dm'
          ? ({ kind: 'dm' } as const)
          : verifiedControl(players, command.control.legacyPlayerId);
      if (!control) return rejected('invalid-command', 'control-unavailable');
      if (canonicalJson(member.control ?? null) === canonicalJson(control))
        return { status: 'unchanged' };
      member.control = control;
      return putScene(scene, members, command.at);
    }
    case 'roster.removeMember': {
      const member = members[memberIndex];
      if (!member) return rejected('invalid-reference', 'member-missing');
      if (member.removedAt !== undefined) return { status: 'unchanged' };
      member.removedAt = command.at;
      member.tokenIds = [];
      return putScene(scene, members, command.at);
    }
  }
}

/**
 * The one typed roster command path: planning on the expected snapshot,
 * then a single CAS'd IndexedDB transaction through `mutateWorkspace`.
 * Success is reported only after the transaction completed. A stale or
 * retried command is never re-planned on newer state: the transaction
 * answers with the recorded replay, a digest mismatch, or a conflict.
 */
export async function runRosterCommand(
  repository: TableRepository,
  options: {
    expectedRevision: number;
    operationId: string;
    command: TableRosterCommandV1;
    players?: readonly TableCampaignPlayer[];
  }
): Promise<TableRosterResult> {
  const { command, expectedRevision, operationId } = options;
  if (!validateRosterCommand(command)) {
    return rejected('invalid-command', 'malformed');
  }
  const current = repository.getCurrent();
  if (current?.status === 'read-only') {
    return { status: 'rejected', reason: 'unknown-schema' };
  }
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const actualRevision = snapshot?.campaign?.revision ?? 0;
  if (!snapshot || actualRevision !== expectedRevision) {
    return repository.mutateWorkspace(
      expectedRevision,
      operationId,
      {},
      { digestSource: command }
    );
  }
  const plan = planRosterCommand(snapshot, command, options.players);
  if (plan.status === 'rejected') return plan;
  if (plan.status === 'unchanged') {
    return { status: 'unchanged', revision: actualRevision };
  }
  return repository.mutateWorkspace(
    expectedRevision,
    operationId,
    plan.mutation,
    { digestSource: command }
  );
}

/** Allocates command identities before any transaction (never at render). */
export function newRosterIds(
  randomUUID: () => string = () => crypto.randomUUID()
): { actorId: string; sceneMemberId: string } {
  return { actorId: `actor-${randomUUID()}`, sceneMemberId: randomUUID() };
}
