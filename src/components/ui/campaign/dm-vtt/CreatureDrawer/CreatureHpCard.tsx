'use client';

import React from 'react';
import { X } from 'lucide-react';

import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { DamageControls } from '@/components/ui/encounter/combat-screen/detail/DamageControls';

import { getHpNumberColor } from '@/utils/hpColor';

import { CreatureMaxHpField } from './CreatureMaxHpField';
import type { CreatureVitalsProps } from './CreatureDrawer.utils';

/** "Hit points" section: current/max HP, temp HP, HP bar, and damage/heal/temp controls. */
export function CreatureHpCard({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  return (
    <Section level={4} heading="Hit points" contentClassName="space-y-3">
      <div className="flex flex-wrap items-baseline gap-1">
        {/* Current, "/" and max stay alone in one element: e2e reads "13/13" exactly. */}
        <div className="flex items-baseline gap-1">
          <span
            className={`type-num-xl tabular-nums ${getHpNumberColor(entity.currentHp, entity.maxHp)}`}
          >
            {entity.currentHp}
          </span>
          <span className="type-ui text-muted">/</span>
          {editing ? (
            <CreatureMaxHpField
              maxHp={entity.maxHp}
              onCommit={v => actions.onSetMaxHp(entity.id, v)}
            />
          ) : (
            <span className="type-ui text-muted tabular-nums">
              {entity.maxHp}
            </span>
          )}
        </div>

        {entity.tempHp > 0 && (
          <span className="type-small text-frost-text ml-1 inline-flex items-center gap-1">
            +{entity.tempHp} temp
            <Button
              variant="ghost"
              size="xs"
              className="w-7 px-0"
              onClick={() => actions.onUpdate(entity.id, { tempHp: 0 })}
              aria-label="Clear temp HP"
            >
              <X size={14} aria-hidden />
            </Button>
          </span>
        )}
      </div>

      {entity.monsterStatBlock?.hpFormula && (
        <p className="type-small text-muted">
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
    </Section>
  );
}
