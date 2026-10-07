import type { CombatLogEvent } from '@/types/combatLog';

/**
 * Plain-text rendering of one combat log event. Store-free so Table scene
 * history can reuse the exact legacy export wording without loading or
 * writing the combat log store.
 */
export function formatCombatLogEvent(event: CombatLogEvent): string {
  const prefix = `[R${event.round}]`;

  switch (event.type) {
    case 'damage':
      return `${prefix} ${event.sourceName} dealt ${event.amount} ${event.damageType} damage to ${event.targetName}${event.isCritical ? ' (CRITICAL!)' : ''}${event.weaponOrSpellName ? ` with ${event.weaponOrSpellName}` : ''}`;
    case 'healing':
      return `${prefix} ${event.sourceName} healed ${event.targetName} for ${event.actualHealing} HP${event.spellOrAbilityName ? ` using ${event.spellOrAbilityName}` : ''}`;
    case 'condition_applied':
      return `${prefix} ${event.targetName} gained ${event.conditionName}${event.sourceName ? ` from ${event.sourceName}` : ''}${event.duration ? ` (${event.duration})` : ''}`;
    case 'condition_removed':
      return `${prefix} ${event.conditionName} removed from ${event.targetName}`;
    case 'turn_start':
      return `${prefix} --- ${event.entityName}'s turn ---`;
    case 'turn_end':
      return `${prefix} ${event.entityName}'s turn ended`;
    case 'spell_cast':
      return `${prefix} ${event.casterName} cast ${event.spellName}${event.slotUsed ? ` (level ${event.slotUsed} slot)` : ''}${event.isConcentration ? ' [Concentration]' : ''}`;
    case 'ability_use':
      return `${prefix} ${event.userName} used ${event.abilityName}${event.legendaryActionCost ? ` (${event.legendaryActionCost} legendary action${event.legendaryActionCost > 1 ? 's' : ''})` : ''}`;
    case 'round_start':
      return `\n===== Round ${event.roundNumber} =====`;
    case 'round_end':
      return `===== End of Round ${event.roundNumber} =====\n`;
    case 'combat_start':
      return `\n*** COMBAT STARTED ***\nParticipants: ${event.participantNames.join(', ')}`;
    case 'combat_end':
      return `*** COMBAT ENDED ***${event.endReason ? ` (${event.endReason})` : ''}`;
    case 'unconscious':
      return `${prefix} ${event.entityName} fell unconscious!`;
    case 'death':
      return `${prefix} ${event.entityName} died!`;
    case 'revived':
      return `${prefix} ${event.entityName} was revived!`;
    case 'stabilized':
      return `${prefix} ${event.entityName} was stabilized`;
    case 'movement':
      return `${prefix} ${event.entityName} moved ${event.feet} ft (${event.cells} cells)`;
  }
}
