'use client';

import React from 'react';
import { X } from 'lucide-react';

import { HPBar } from '@/components/shared/combat/HPBar';
import { DamageControls } from '@/components/ui/encounter/combat-screen/detail/DamageControls';
import { hpColorClass } from '@/components/ui/encounter/combat-screen/detail/hitDie';
import {
  HEADING_CLASS,
  SECTION_CLASS,
} from '@/components/ui/campaign/player-vtt/SheetDrawer/sheetSectionStyles';

import { CreatureMaxHpField } from './CreatureMaxHpField';
import type { CreatureVitalsProps } from './CreatureDrawer.utils';

/** HP card: big current/max HP, temp-HP pill, HP bar, and damage/heal/temp controls. */
export function CreatureHpCard({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  return (
    <div className={`${SECTION_CLASS} space-y-3`}>
      <p className={HEADING_CLASS}>Hit Points</p>

      <div className="flex flex-wrap items-baseline gap-1">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${hpColorClass(entity.currentHp, entity.maxHp)}`}
        >
          {entity.currentHp}
        </span>
        <span className="text-muted text-sm font-medium">/</span>
        {editing ? (
          <CreatureMaxHpField
            maxHp={entity.maxHp}
            onCommit={v => actions.onSetMaxHp(entity.id, v)}
          />
        ) : (
          <span className="text-muted text-sm tabular-nums">
            {entity.maxHp}
          </span>
        )}

        {entity.tempHp > 0 && (
          <span className="bg-accent-blue-bg text-accent-blue-text ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
            +{entity.tempHp} temp
            <button
              onClick={() => actions.onUpdate(entity.id, { tempHp: 0 })}
              className="text-accent-blue-text hover:text-accent-red-text ml-0.5 transition-colors"
              aria-label="Clear temp HP"
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        )}
      </div>

      {entity.monsterStatBlock?.hpFormula && (
        <p className="text-faint -mt-2 text-[11px]">
          {entity.monsterStatBlock.hpFormula}
        </p>
      )}

      <HPBar
        current={entity.currentHp}
        max={entity.maxHp}
        temp={entity.tempHp}
        size="md"
        showLabel={false}
        className="w-full"
      />

      {!entity.summonId && (
        <DamageControls
          entityId={entity.id}
          onDamage={actions.onDamage}
          onHeal={actions.onHeal}
          onAddTempHp={actions.onAddTempHp}
        />
      )}
    </div>
  );
}
