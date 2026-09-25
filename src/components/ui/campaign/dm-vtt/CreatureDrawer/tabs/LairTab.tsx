'use client';

import React from 'react';

import { LairActionsSection } from '@/components/ui/encounter/combat-screen/detail/DetailActions';
import { RegionalEffects } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';

import type { CreatureTabProps } from '../CreatureDrawer.utils';

/** Lair tab: lair actions plus regional effects, for `type: 'lair'` entities. */
export function LairTab({ entity, actions }: CreatureTabProps) {
  return (
    <div className="space-y-3">
      <LairActionsSection entity={entity} actions={actions} />
      <RegionalEffects effects={entity.regionalEffects ?? []} />
    </div>
  );
}
