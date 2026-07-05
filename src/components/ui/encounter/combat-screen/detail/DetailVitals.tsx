'use client';

import React, { useState } from 'react';
import { Shield, Plus, X } from 'lucide-react';
import { HPBar } from '@/components/shared/combat/HPBar';
import { rollHitDie } from '../spendHitDie';
import type { DetailSectionProps } from './DetailHeader';
import { DamageControls } from './DamageControls';
import { DeathSaves } from './DeathSaves';
import { ConcentrationReaction } from './ConcentrationReaction';

function hpColorClass(current: number, max: number): string {
  const pct = max > 0 ? (current / max) * 100 : 0;
  if (pct > 50) return 'text-accent-emerald-text';
  if (pct > 25) return 'text-accent-amber-text';
  return 'text-accent-red-text';
}

export function DetailVitals({ entity, actions }: DetailSectionProps) {
  const [editingMax, setEditingMax] = useState(false);
  const [maxInput, setMaxInput] = useState('');

  if (entity.type === 'lair') return null;

  const isPlayer = entity.type === 'player';
  const isNonPlayerNonSummon = !isPlayer && !entity.summonId;
  const showDeathSaves =
    (isPlayer || entity.type === 'npc') &&
    entity.currentHp <= 0 &&
    entity.deathSaves != null;
  const canSpendHitDie =
    entity.type === 'npc' &&
    entity.hitDice != null &&
    entity.hitDice.current > 0 &&
    entity.currentHp > 0 &&
    entity.currentHp < entity.maxHp;

  const commitMaxHp = (raw: string) => {
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) {
      actions.onSetMaxHp(entity.id, val);
    }
    setEditingMax(false);
  };

  return (
    <div className="bg-surface-secondary border-divider space-y-3 rounded-xl border p-4">
      {/* HP display row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-1">
          <span
            className={`font-display text-3xl font-bold tabular-nums ${hpColorClass(entity.currentHp, entity.maxHp)}`}
          >
            {entity.currentHp}
          </span>
          <span className="text-muted text-sm font-medium">/</span>
          {isPlayer ? (
            <span className="text-muted text-sm tabular-nums">
              {entity.maxHp}
            </span>
          ) : editingMax ? (
            <input
              type="number"
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              onBlur={() => commitMaxHp(maxInput)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitMaxHp(maxInput);
                if (e.key === 'Escape') setEditingMax(false);
              }}
              className="bg-surface-raised text-heading w-14 rounded px-1 py-0.5 text-center text-sm font-medium shadow-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setMaxInput(entity.maxHp.toString());
                setEditingMax(true);
              }}
              className="text-muted hover:text-body text-sm tabular-nums transition-colors"
              title="Edit max HP"
            >
              {entity.maxHp}
            </button>
          )}

          {/* Temp HP pill */}
          {entity.tempHp > 0 &&
            (isPlayer ? (
              <span className="text-faint ml-1 text-xs">
                (+{entity.tempHp} temp, synced)
              </span>
            ) : (
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
            ))}
        </div>

        {/* AC */}
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-muted shrink-0" />
          {isPlayer ? (
            <div className="text-right">
              <span className="text-heading font-bold tabular-nums">
                {entity.armorClass}
              </span>
              <p className="text-faint text-[10px]">synced</p>
            </div>
          ) : (
            <input
              type="number"
              value={entity.armorClass}
              onChange={e =>
                actions.onUpdate(entity.id, {
                  armorClass: parseInt(e.target.value, 10) || 0,
                })
              }
              className="bg-surface-raised text-heading w-12 rounded px-1 py-0.5 text-center text-sm font-bold shadow-sm"
              aria-label="Armor class"
            />
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
      {isNonPlayerNonSummon && (
        <DamageControls
          entityId={entity.id}
          onDamage={actions.onDamage}
          onHeal={actions.onHeal}
          onAddTempHp={actions.onAddTempHp}
        />
      )}

      <ConcentrationReaction entity={entity} actions={actions} />

      {/* Death saves (players read-only, NPCs interactive) */}
      {showDeathSaves && <DeathSaves entity={entity} actions={actions} />}

      {/* Spend hit die */}
      {canSpendHitDie && (
        <button
          onClick={() => {
            const result = rollHitDie(entity);
            if (result) {
              actions.onHeal(entity.id, result.healAmount);
              actions.onUpdate(entity.id, { hitDice: result.hitDice });
            }
          }}
          className="text-accent-purple-text bg-accent-purple-bg hover:bg-accent-purple-bg-strong flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <Plus size={11} aria-hidden />
          Spend Hit Die ({entity.hitDice?.dieType})
        </button>
      )}

      {/* Long rest */}
      <button
        onClick={() => actions.onLongRest(entity.id)}
        className="border-divider text-muted hover:text-body hover:bg-surface-raised w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
      >
        Long Rest
      </button>
    </div>
  );
}
