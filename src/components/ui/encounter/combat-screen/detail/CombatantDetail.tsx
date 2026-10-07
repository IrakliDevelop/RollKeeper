'use client';

import React from 'react';
import type { EncounterEntity } from '@/types/encounter';
import type { CombatantDetailCapabilities, EntityActions } from '../types';
import { DetailHeader } from './DetailHeader';
import { DetailVitals } from './DetailVitals';
import { DetailAbilityScores } from './DetailAbilityScores';
import { DetailCombatInfo } from './DetailCombatInfo';
import { DetailActions } from './DetailActions';
import { DetailEffects } from './DetailEffects';

export interface CombatantDetailProps {
  entity: EncounterEntity;
  actions: EntityActions;
  onOpenSheet?: () => void;
  /** Table scene runs: restrict to supported controls (legacy when omitted). */
  capabilities?: CombatantDetailCapabilities;
}

export function RegionalEffects({ effects }: { effects: string[] }) {
  if (effects.length === 0) return null;
  return (
    <div className="border-divider space-y-1 border-t p-4">
      <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Regional Effects
      </h4>
      <ul className="space-y-1">
        {effects.map((effect, i) => (
          <li key={i} className="text-body text-xs">
            {effect}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CombatantDetail({
  entity,
  actions,
  onOpenSheet,
  capabilities,
}: CombatantDetailProps) {
  const isLair = entity.type === 'lair';

  if (capabilities) {
    // Scene runs: abilities, resources, legendary/lair, rests, inventory,
    // stat blocks and identity edits are hidden, never silent no-ops.
    return (
      <div className="flex flex-col">
        <DetailHeader
          entity={entity}
          actions={actions}
          capabilities={capabilities}
        />
        {capabilities.readOnlyNote && (
          <p className="text-accent-amber-text px-4 pb-2 text-xs font-medium">
            {capabilities.readOnlyNote}
          </p>
        )}
        <DetailVitals
          entity={entity}
          actions={actions}
          capabilities={capabilities}
        />
        <DetailEffects
          entity={entity}
          actions={actions}
          capabilities={capabilities}
        />
        <p className="text-faint border-divider border-t px-4 py-2 text-xs">
          Abilities, resources, rests, inventory and stat blocks are not
          available in scene runs.
        </p>
      </div>
    );
  }

  if (isLair) {
    return (
      <div className="flex flex-col">
        <DetailHeader
          entity={entity}
          actions={actions}
          onOpenSheet={onOpenSheet}
        />
        <DetailActions entity={entity} actions={actions} />
        {entity.regionalEffects && (
          <RegionalEffects effects={entity.regionalEffects} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <DetailHeader
        entity={entity}
        actions={actions}
        onOpenSheet={onOpenSheet}
      />
      <DetailVitals entity={entity} actions={actions} />
      <DetailAbilityScores entity={entity} actions={actions} />
      <DetailCombatInfo entity={entity} actions={actions} />
      <DetailActions entity={entity} actions={actions} />
      <DetailEffects entity={entity} actions={actions} />
    </div>
  );
}
