'use client';

import React, { useRef, useState } from 'react';
import { Shield, Plus, X } from 'lucide-react';
import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { effectiveAc } from '@/utils/calculations';
import { getHpNumberColor } from '@/utils/hpColor';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type { DetailSectionProps } from './DetailHeader';
import { DamageControls } from './DamageControls';
import { DeathSaves } from './DeathSaves';
import { ConcentrationReaction } from './ConcentrationReaction';
import { canSpendHitDie, showDeathSaves, spendHitDie } from './hitDie';

export function DetailVitals({
  entity,
  actions,
  capabilities,
}: DetailSectionProps) {
  const [editingMax, setEditingMax] = useState(false);
  const [maxInput, setMaxInput] = useState('');
  const cancelMax = useRef(false);
  const maxHpButtonRef = useRef<HTMLButtonElement>(null);

  if (entity.type === 'lair') return null;

  if (capabilities?.hpUnknown) {
    return (
      <div className="border-divider space-y-3 border-t p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-muted text-3xl font-bold">—</span>
          <span className="text-ember-text text-xs font-medium">
            Waiting for player data
          </span>
        </div>
        <ConcentrationReaction
          entity={entity}
          actions={actions}
          capabilities={capabilities}
        />
      </div>
    );
  }

  const isPlayer = entity.type === 'player';
  const isNonPlayerNonSummon = !isPlayer && !entity.summonId;
  // Legacy: players are synced read-only. Scene runs: per-capability.
  const readOnlyMax = capabilities ? !capabilities.maxHp : isPlayer;
  const readOnlyTemp = capabilities ? !capabilities.tempHp : isPlayer;
  const readOnlyAc = capabilities ? !capabilities.armorClass : isPlayer;
  const showDamage = capabilities ? capabilities.hp : isNonPlayerNonSummon;

  const commitMaxHp = (raw: string) => {
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) {
      actions.onSetMaxHp(entity.id, val);
    }
    setEditingMax(false);
  };

  return (
    <div className="border-divider space-y-3 border-t p-4">
      {/* HP display row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-1">
          <span
            className={`font-display text-3xl font-bold tabular-nums ${getHpNumberColor(entity.currentHp, entity.maxHp)}`}
          >
            {entity.currentHp}
          </span>
          <span className="text-muted text-sm font-medium">/</span>
          {readOnlyMax ? (
            <span className="text-muted text-sm tabular-nums">
              {entity.maxHp}
            </span>
          ) : editingMax ? (
            <input
              type="text"
              inputMode="numeric"
              aria-label="Max HP"
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              data-in-place-dirty=""
              onBlur={() => {
                if (!cancelMax.current) commitMaxHp(maxInput);
                cancelMax.current = false;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') commitMaxHp(maxInput);
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelMax.current = true;
                  setEditingMax(false);
                }
              }}
              className="bg-surface border-divider text-heading w-14 rounded-sm border px-1 py-1 text-center text-base font-medium pointer-coarse:min-h-11"
              autoFocus
            />
          ) : (
            <Button
              ref={maxHpButtonRef}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setMaxInput(entity.maxHp.toString());
                setEditingMax(true);
              }}
              aria-label={`${entity.maxHp}, edit ${entity.name} max HP`}
              className="tabular-nums pointer-coarse:min-h-11"
            >
              {entity.maxHp}
            </Button>
          )}

          {/* Temp HP pill */}
          {entity.tempHp > 0 &&
            (readOnlyTemp ? (
              <span className="text-muted ml-1 text-xs">
                +{entity.tempHp} temp HP{capabilities ? '' : ' · synced'}
              </span>
            ) : (
              <span className="text-frost-text ml-1 inline-flex items-center gap-1 text-xs font-medium">
                +{entity.tempHp} temp HP
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    actions.onUpdate(entity.id, { tempHp: 0 });
                    maxHpButtonRef.current?.focus();
                  }}
                  className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  aria-label={`Clear ${entity.name} temp HP`}
                >
                  <X size={11} aria-hidden />
                </Button>
              </span>
            ))}
        </div>

        {/* AC */}
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-muted shrink-0" />
          {readOnlyAc ? (
            <div className="text-right">
              <span className="text-heading font-bold tabular-nums">
                {entity.armorClass}
              </span>
              <p className="text-muted text-xs">
                {capabilities ? 'read-only' : 'synced'}
              </p>
            </div>
          ) : capabilities ? (
            <NumberField
              value={entity.armorClass}
              onChange={v =>
                actions.onUpdate(entity.id, { armorClass: v ?? 0 })
              }
              min={0}
              className="bg-surface border-divider text-heading w-12 rounded-sm border px-1 py-1 text-center text-base font-bold pointer-coarse:min-h-11"
              aria-label="Armor class"
              title="Armor class"
            />
          ) : (
            <div className="flex items-center gap-1">
              <NumberField
                value={entity.armorClass}
                onChange={v =>
                  actions.onUpdate(entity.id, { armorClass: v ?? 0 })
                }
                min={0}
                className="bg-surface border-divider text-heading w-12 rounded-sm border px-1 py-1 text-center text-base font-bold pointer-coarse:min-h-11"
                aria-label="Armor class"
                title="Base armor class"
              />
              <span className="text-muted text-xs">+</span>
              <NumberField
                value={entity.tempAc}
                onChange={v =>
                  actions.onUpdate(entity.id, {
                    tempAc: v && v > 0 ? v : undefined,
                  })
                }
                min={0}
                allowEmpty
                className="bg-surface border-divider text-heading w-10 rounded-sm border px-1 py-1 text-center text-base font-medium pointer-coarse:min-h-11"
                aria-label="Temporary AC bonus"
                title="Temporary AC bonus"
              />
              {(entity.tempAc ?? 0) > 0 && (
                <span className="text-heading text-xs font-semibold">
                  <span className="sr-only">Effective AC </span>={' '}
                  {effectiveAc(entity.armorClass, entity.tempAc)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HP bar */}
      <HPBar
        current={entity.currentHp}
        max={entity.maxHp}
        temp={entity.tempHp}
        size="md"
        showLabel={false}
        className="w-full"
      />

      {/* Damage/heal/temp controls */}
      {showDamage && (
        <DamageControls
          entityId={entity.id}
          onDamage={actions.onDamage}
          onHeal={actions.onHeal}
          onAddTempHp={actions.onAddTempHp}
        />
      )}

      <ConcentrationReaction
        entity={entity}
        actions={actions}
        capabilities={capabilities}
      />

      {/* Death saves (players read-only, NPCs interactive) */}
      {showDeathSaves(entity) && (!capabilities || isPlayer) && (
        <DeathSaves entity={entity} actions={actions} />
      )}

      {/* Spend hit die */}
      {!capabilities && canSpendHitDie(entity) && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => spendHitDie(entity, actions)}
        >
          <Plus size={11} aria-hidden />
          Spend hit die ({entity.hitDice?.dieType})
        </Button>
      )}
    </div>
  );
}
