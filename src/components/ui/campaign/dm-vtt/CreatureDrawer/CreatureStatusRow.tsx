'use client';

import React from 'react';
import { Plus } from 'lucide-react';

import { ConcentrationReaction } from '@/components/ui/encounter/combat-screen/detail/ConcentrationReaction';
import { DeathSaves } from '@/components/ui/encounter/combat-screen/detail/DeathSaves';
import {
  canSpendHitDie,
  showDeathSaves,
  spendHitDie,
} from '@/components/ui/encounter/combat-screen/detail/hitDie';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';

import type { CreatureVitalsProps } from './CreatureDrawer.utils';

/** Concentration/reaction, death saves (when applicable), and the Spend Hit Die control. */
export function CreatureStatusRow({ entity, actions }: CreatureVitalsProps) {
  return (
    <div className={`${SECTION_CLASS} space-y-2`}>
      <p className={HEADING_CLASS}>Status</p>
      <ConcentrationReaction entity={entity} actions={actions} />

      {showDeathSaves(entity) && (
        <DeathSaves entity={entity} actions={actions} />
      )}

      {canSpendHitDie(entity) && (
        <button
          onClick={() => spendHitDie(entity, actions)}
          className="text-accent-purple-text bg-accent-purple-bg hover:bg-accent-purple-bg-strong flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <Plus size={11} aria-hidden />
          Spend Hit Die ({entity.hitDice?.dieType})
        </button>
      )}
    </div>
  );
}
