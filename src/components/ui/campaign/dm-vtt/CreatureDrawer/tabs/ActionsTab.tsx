'use client';

import React from 'react';

import { Section } from '@/components/ui/layout/section';
import { LairActionsSection } from '@/components/ui/encounter/combat-screen/detail/DetailActions';
import { LegendarySection } from '@/components/ui/encounter/combat-screen/detail/LegendarySection';
import { DetailResources } from '@/components/ui/encounter/combat-screen/detail/NpcResourceList';
import { StatBlockTraits } from '@/components/ui/encounter/combat-screen/detail/StatBlockTraits';
import { statBlockEntryHandlers } from '@/components/ui/encounter/combat-screen/detail/statBlockEntryHandlers';
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
 * traits/actions. The legendary, lair, and resource sections render their
 * own headings, so they carry no wrapper here.
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
    return <p className="type-body text-muted">No actions.</p>;
  }

  return (
    <div className="space-y-6">
      {hasLegendary && <LegendarySection entity={entity} actions={actions} />}
      {hasLairActions && (
        <LairActionsSection entity={entity} actions={actions} />
      )}
      {hasResources && <DetailResources entity={entity} actions={actions} />}
      {hasTraits && sb && (
        <Section level={4} heading="Actions & traits">
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
        </Section>
      )}
    </div>
  );
}
