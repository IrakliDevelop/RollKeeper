import type { EncounterEntity } from '@/types/encounter';

/**
 * What players see instead of this entity's real name: the DM-set alias,
 * falling back to a generic "Enemy" label while hidden, else the real name.
 * Same expression `HeaderControls`/`CreaturePlayersRow` render inline.
 */
export function playersSeeLabel(entity: EncounterEntity): string {
  return (
    entity.playerAlias?.trim() || (entity.isHidden ? 'Enemy' : entity.name)
  );
}

/** Appended note when the DM has opted this entity into exact HP sharing. */
export function playersSeeSuffix(entity: EncounterEntity): string {
  return entity.hpVisibleToPlayers === true ? ' · exact HP' : '';
}
