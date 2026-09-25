'use client';

import React from 'react';

import { LairActionsSection } from '@/components/ui/encounter/combat-screen/detail/DetailActions';
import { LegendarySection } from '@/components/ui/encounter/combat-screen/detail/LegendarySection';
import { DetailResources } from '@/components/ui/encounter/combat-screen/detail/NpcResourceList';
import { StatBlockTraits } from '@/components/ui/encounter/combat-screen/detail/StatBlockTraits';
import { statBlockEntryHandlers } from '@/components/ui/encounter/combat-screen/detail/statBlockEntryHandlers';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';
import type { MonsterSpellcasting, MonsterStatBlock } from '@/types/encounter';

import type { CreatureTabProps } from '../CreatureDrawer.utils';

function hasTraitContent(
  sb: MonsterStatBlock,
  spellcasting?: MonsterSpellcasting
): boolean {
  return (
    (sb.traits ?? []).length > 0 ||
    (sb.actions ?? []).length > 0 ||
    (sb.bonusActions ?? []).length > 0 ||
    (sb.reactions ?? []).length > 0 ||
    (sb.lairActions ?? []).length > 0 ||
    spellcasting != null
  );
}

/**
 * Actions tab: legendary/lair actions, class resources, and stat block
 * traits/actions. The legendary, lair, and resource cards carry no outer
 * heading — those sections render their own.
 */
export function ActionsTab({ entity, actions }: CreatureTabProps) {
  const sb = entity.monsterStatBlock;
  const { onUseEntry, onUseAbilityEntry, onRestoreAbilityEntry } =
    statBlockEntryHandlers(entity, actions);

  const hasLegendary = entity.legendaryActions != null;
  const hasLairActions = (entity.lairActions?.length ?? 0) > 0;
  const hasResources = (entity.resources?.length ?? 0) > 0;
  const hasTraits = sb != null && hasTraitContent(sb, entity.spellcasting);

  if (!hasLegendary && !hasLairActions && !hasResources && !hasTraits) {
    return <p className="text-muted text-sm">No actions.</p>;
  }

  return (
    <div className="space-y-3">
      {hasLegendary && (
        <div className={SECTION_CLASS}>
          <LegendarySection entity={entity} actions={actions} />
        </div>
      )}
      {hasLairActions && (
        <div className={SECTION_CLASS}>
          <LairActionsSection entity={entity} actions={actions} />
        </div>
      )}
      {hasResources && (
        <div className={SECTION_CLASS}>
          <DetailResources entity={entity} actions={actions} />
        </div>
      )}
      {hasTraits && sb && (
        <div className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>Actions &amp; Traits</h3>
          <StatBlockTraits
            statBlock={sb}
            spellcasting={entity.spellcasting}
            resources={entity.resources}
            inventory={entity.inventory}
            abilities={entity.abilities}
            onUseEntry={onUseEntry}
            onUseAbilityEntry={onUseAbilityEntry}
            onRestoreAbilityEntry={onRestoreAbilityEntry}
          />
        </div>
      )}
    </div>
  );
}
