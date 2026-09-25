import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';

/** Shared props for the vitals section components (HP card, stat tiles, status row). */
export interface CreatureVitalsProps {
  entity: EncounterEntity;
  actions: EntityActions;
  editing: boolean;
}

/** Shared props for the creature drawer's tab content components. */
export type CreatureTabProps = CreatureVitalsProps;

export interface CreatureBadge {
  label: 'Monster' | 'NPC' | 'Summon' | 'Lair';
  tone: 'purple' | 'amber' | 'blue' | 'emerald';
}

/** Kind badge for the creature drawer header — summon beats type, lair beats NPC. */
export function creatureBadge(entity: EncounterEntity): CreatureBadge {
  if (entity.summonId) return { label: 'Summon', tone: 'blue' };
  if (entity.type === 'lair') return { label: 'Lair', tone: 'emerald' };
  if (entity.type === 'npc' || entity.npcSourceId)
    return { label: 'NPC', tone: 'amber' };
  return { label: 'Monster', tone: 'purple' };
}

/** Size · type · alignment line — same expression as `DetailHeader`. */
export function creatureMetaLine(entity: EncounterEntity): string | null {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;
  return [sb.size, sb.type, sb.alignment].filter(Boolean).join(' · ');
}

/**
 * The entity the top-center "Sheet · name" pill offers, or null: the
 * selected non-player combatant, only while the drawer is closed and no token
 * placement is pending (`PlacementBanner` sits in the same spot).
 */
export function sheetPillEntity({
  entities,
  selectedEntityId,
  drawerOpen,
  placementPending,
}: {
  entities: EncounterEntity[] | undefined;
  selectedEntityId: string | null;
  drawerOpen: boolean;
  placementPending: boolean;
}): EncounterEntity | null {
  if (drawerOpen || placementPending || !selectedEntityId) return null;
  const selected = entities?.find(e => e.id === selectedEntityId);
  return selected && selected.type !== 'player' ? selected : null;
}
