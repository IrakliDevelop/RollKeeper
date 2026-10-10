import { tokenAvatarUrl } from '@/components/ui/campaign/location-map/PlayerTokenTool';
import type { TableRosterEntry, TableSceneRoster } from '@/lib/table/roster';
import type {
  TableActorLiveStatsV1,
  TableActorProfileV1,
} from '@/lib/table/schema';
import type { EncounterEntity, TokenCellSize } from '@/types/encounter';

/**
 * Thin Table → roster-tray mapper (R5): the existing RosterTray/RosterRow
 * render scene members as EncounterEntity-shaped rows keyed by the stable
 * `sceneMemberId`. No encounter store is read or written.
 */

const ENTITY_TYPE: Record<
  TableActorProfileV1['category'],
  EncounterEntity['type']
> = { pc: 'player', npc: 'npc', monster: 'monster' };

export function rosterEntities(roster: TableSceneRoster): EncounterEntity[] {
  return roster.entries.flatMap(entry => {
    if (entry.removed || entry.sceneMemberId === null) return [];
    const stats = entry.liveStats;
    return [
      {
        id: entry.sceneMemberId,
        type: ENTITY_TYPE[entry.category],
        name: entry.name,
        initiative: null,
        initiativeModifier: 0,
        currentHp: stats?.currentHp ?? 0,
        maxHp: stats?.maxHp ?? 0,
        tempHp: stats?.tempHp ?? 0,
        armorClass: stats?.armorClass ?? 10,
        conditions: [],
        avatarUrl: entry.avatarUrl ?? undefined,
        tokenSize: entry.tokenCells as TokenCellSize,
      },
    ];
  });
}

/** sceneMemberId → bound or alias token ids present on the live canvas. */
export function placedIndex(
  roster: TableSceneRoster,
  liveIds: ReadonlySet<string>
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const entry of roster.entries) {
    if (entry.sceneMemberId === null) continue;
    const ids = [...entry.boundTokenIds, ...entry.aliasTokenIds].filter(id =>
      liveIds.has(id)
    );
    if (ids.length > 0) index.set(entry.sceneMemberId, ids);
  }
  return index;
}

export function controlLabel(entry: TableRosterEntry): string {
  if (entry.control.kind === 'player') return 'Player-controlled';
  if (entry.control.kind === 'dm') return 'DM-controlled';
  if (entry.control.reason === 'verification-unavailable')
    return "Can't check player";
  return entry.control.reason === 'identity-unresolved'
    ? 'Player not found'
    : 'Control unavailable';
}

export function describeEntry(
  entry: TableRosterEntry,
  liveIds: ReadonlySet<string>
): string {
  const placement = describePlacement(entry, liveIds);
  // PR07 P9: the DM's physical-mini indicator.
  return entry.representation === 'physical'
    ? `${placement} · Physical mini`
    : placement;
}

function describePlacement(
  entry: TableRosterEntry,
  liveIds: ReadonlySet<string>
): string {
  const label = controlLabel(entry);
  if (entry.mismatchedTokenIds.some(id => liveIds.has(id)))
    return `${label} · Repair needed`;
  if (entry.boundTokenIds.some(id => liveIds.has(id)))
    return `${label} · On map`;
  const aliases = entry.aliasTokenIds.filter(id => liveIds.has(id)).length;
  if (aliases > 0)
    return `${label} · ${aliases} unbound alias${aliases === 1 ? '' : 'es'}`;
  return `${label} · Not on map`;
}

function walkFeetFrom(speed: unknown): number | undefined {
  if (typeof speed !== 'string') return undefined;
  const match = /(\d+)\s*ft/u.exec(speed);
  return match ? Number(match[1]) : undefined;
}

/** Copies a bestiary or campaign-NPC entity into Table-local stats. */
export function creatureFromEntity(
  entity: Omit<EncounterEntity, 'id'>,
  sourceKind: 'bestiary' | 'campaign-npc'
): { liveStats: TableActorLiveStatsV1; profile: TableActorProfileV1 } {
  const avatarUrl = tokenAvatarUrl(entity.avatarUrl);
  const sourceId =
    sourceKind === 'bestiary' ? entity.monsterSourceId : entity.npcSourceId;
  const walkFeet = walkFeetFrom(entity.monsterStatBlock?.speed);
  return {
    liveStats: {
      name: entity.name,
      currentHp: entity.currentHp,
      maxHp: entity.maxHp,
      tempHp: entity.tempHp,
      armorClass: entity.armorClass,
      conditions: [],
    },
    profile: {
      category: entity.type === 'monster' ? 'monster' : 'npc',
      sourceKind,
      ...(sourceId ? { sourceId } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(entity.tokenSize ? { tokenCells: entity.tokenSize } : {}),
      ...(walkFeet !== undefined ? { walkFeet } : {}),
    },
  };
}

/** A manual PC is a DM-managed participant with no player principal. */
export function manualPcStats(form: {
  name: string;
  maxHp: number;
  armorClass: number;
}): { liveStats: TableActorLiveStatsV1; profile: TableActorProfileV1 } {
  return {
    liveStats: {
      name: form.name.trim(),
      currentHp: form.maxHp,
      maxHp: form.maxHp,
      tempHp: 0,
      armorClass: form.armorClass,
      conditions: [],
    },
    profile: { category: 'pc', sourceKind: 'manual' },
  };
}
