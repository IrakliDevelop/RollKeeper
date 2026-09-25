'use client';

import React from 'react';

import { LairActionsSection } from '@/components/ui/encounter/combat-screen/detail/DetailActions';
import { RegionalEffects } from '@/components/ui/encounter/combat-screen/detail/CombatantDetail';
import { TokenSettings } from '@/components/ui/campaign/dm-vtt/StudioPanel/TokenSettings';

import type { CreatureTabProps } from '../CreatureDrawer.utils';
import type { StatBlockTabProps } from './StatBlockTab';

export interface LairTabProps extends CreatureTabProps {
  onTokenIdentityChange?: StatBlockTabProps['onTokenIdentityChange'];
}

/** Lair tab: lair actions, regional effects, and token appearance, for `type: 'lair'` entities. */
export function LairTab({
  entity,
  actions,
  onTokenIdentityChange,
}: LairTabProps) {
  return (
    <div className="space-y-3">
      <LairActionsSection entity={entity} actions={actions} />
      <RegionalEffects effects={entity.regionalEffects ?? []} />
      {onTokenIdentityChange && (
        <TokenSettings entity={entity} onChange={onTokenIdentityChange} />
      )}
    </div>
  );
}
