'use client';

import React, { useState } from 'react';
import {
  Minus,
  Plus,
  Shield,
  Trash2,
  RotateCcw,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EncounterEntity } from '@/types/encounter';
import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { MonsterStatBlockPanel } from './MonsterStatBlockPanel';

interface EntityCardExpandedProps {
  entity: EncounterEntity;
  onUpdate: (updates: Partial<EncounterEntity>) => void;
  onRemove: () => void;
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onAddCondition: (condition: { name: string; description?: string }) => void;
  onRemoveCondition: (conditionId: string) => void;
  onUseAbility: (abilityId: string) => void;
  onRestoreAbility: (abilityId: string) => void;
  onUseLegendaryAction: (actionId: string) => void;
  onResetLegendaryActions: () => void;
  onSetConcentration: (spellName: string | null) => void;
  onUseLairAction?: (actionId: string) => void;
}

const COMMON_CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
];

export function EntityCardExpanded({
  entity,
  onUpdate,
  onRemove,
  onDamage,
  onHeal,
  onAddCondition,
  onRemoveCondition,
  onUseAbility,
  onRestoreAbility,
  onUseLegendaryAction,
  onResetLegendaryActions,
  onSetConcentration,
  onUseLairAction,
}: EntityCardExpandedProps) {
  const [hpInput, setHpInput] = useState('');
  const [showStatBlock, setShowStatBlock] = useState(false);
  const [editingMaxHp, setEditingMaxHp] = useState(false);
  const [maxHpInput, setMaxHpInput] = useState('');

  const isPlayer = entity.type === 'player';

  const handleDamage = () => {
    const amount = parseInt(hpInput);
    if (!isNaN(amount) && amount > 0) {
      onDamage(amount);
      setHpInput('');
    }
  };

  const handleHeal = () => {
    const amount = parseInt(hpInput);
    if (!isNaN(amount) && amount > 0) {
      onHeal(amount);
      setHpInput('');
    }
  };

  const handleAddCondition = (name: string) => {
    onAddCondition({ name });
  };

  const isLair = entity.type === 'lair';

  return (
    <div className="border-divider space-y-4 border-t px-3 pt-3 pb-3">
      {/* HP Controls (not for lair) */}
      {!isLair && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <HPBar
                current={entity.currentHp}
                max={entity.maxHp}
                temp={entity.tempHp}
                size="lg"
              />
            </div>
            {/* Editable max HP for non-players */}
            {!isPlayer &&
              (editingMaxHp ? (
                <input
                  type="number"
                  value={maxHpInput}
                  onChange={e => setMaxHpInput(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(maxHpInput);
                    if (!isNaN(val) && val > 0) {
                      onUpdate({
                        maxHp: val,
                        currentHp: Math.min(entity.currentHp, val),
                      });
                    }
                    setEditingMaxHp(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = parseInt(maxHpInput);
                      if (!isNaN(val) && val > 0) {
                        onUpdate({
                          maxHp: val,
                          currentHp: Math.min(entity.currentHp, val),
                        });
                      }
                      setEditingMaxHp(false);
                    }
                    if (e.key === 'Escape') setEditingMaxHp(false);
                  }}
                  className="bg-surface-secondary text-heading w-14 rounded px-1 py-0.5 text-center text-xs font-medium"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setMaxHpInput(entity.maxHp.toString());
                    setEditingMaxHp(true);
                  }}
                  className="text-faint hover:text-body text-xs transition-colors"
                  title="Click to edit max HP"
                >
                  max {entity.maxHp}
                </button>
              ))}
          </div>

          {/* Damage/Heal controls — not for players (synced from player sheet) */}
          {!isPlayer && (
            <div className="flex items-center gap-2">
              <Input
                value={hpInput}
                onChange={e => setHpInput(e.target.value)}
                placeholder="Amount"
                type="number"
                className="w-24"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleDamage();
                }}
              />
              <Button
                variant="danger"
                size="sm"
                onClick={handleDamage}
                leftIcon={<Minus size={14} />}
              >
                Dmg
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleHeal}
                leftIcon={<Plus size={14} />}
              >
                Heal
              </Button>
              <div className="text-muted ml-auto flex items-center gap-1 text-sm">
                <Shield size={14} />
                <input
                  type="number"
                  value={entity.armorClass}
                  onChange={e =>
                    onUpdate({
                      armorClass: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-surface-secondary text-heading w-12 rounded px-1 py-0.5 text-center text-sm font-medium"
                />
              </div>
            </div>
          )}

          {/* Player: read-only AC display */}
          {isPlayer && (
            <div className="text-muted flex items-center gap-1 text-sm">
              <Shield size={14} />
              <span className="text-heading font-medium">
                AC {entity.armorClass}
              </span>
              <span className="text-faint ml-1 text-xs">
                (synced from player)
              </span>
            </div>
          )}

          {entity.tempHp > 0 && (
            <div className="text-accent-blue-text text-xs">
              Temp HP: {entity.tempHp}
            </div>
          )}
        </div>
      )}

      {/* Monster Stat Block Toggle */}
      {entity.monsterStatBlock && (
        <div>
          <button
            onClick={() => setShowStatBlock(!showStatBlock)}
            className="text-accent-red-text hover:text-heading flex items-center gap-1 text-xs font-medium transition-colors"
          >
            <BookOpen size={12} />
            {showStatBlock ? 'Hide' : 'Show'} Stat Block
            {showStatBlock ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </button>
          {showStatBlock && (
            <div className="mt-2">
              <MonsterStatBlockPanel
                statBlock={entity.monsterStatBlock}
                onUpdate={updates =>
                  onUpdate({
                    monsterStatBlock: {
                      ...entity.monsterStatBlock!,
                      ...updates,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Trackable Abilities */}
      {entity.abilities && entity.abilities.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
            Abilities
          </h4>
          {entity.abilities.map(ability => (
            <div
              key={ability.id}
              className="bg-surface-secondary flex items-center justify-between rounded px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <span className="text-body text-sm font-medium">
                  {ability.name}
                </span>
                {ability.usageType === 'recharge' && ability.rechargeOn && (
                  <span className="text-muted ml-1 text-xs">
                    (Recharge {ability.rechargeOn}-6)
                  </span>
                )}
                {ability.maxUses !== undefined && (
                  <span className="text-muted ml-1 text-xs">
                    ({ability.usedUses}/{ability.maxUses} used)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {ability.usedUses > 0 ? (
                  <>
                    <span className="text-accent-red-text text-xs font-medium">
                      Used
                    </span>
                    <button
                      onClick={() => onRestoreAbility(ability.id)}
                      className="text-muted hover:text-accent-emerald-text rounded p-0.5"
                      title="Restore"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onUseAbility(ability.id)}
                    className="bg-accent-amber-bg text-accent-amber-text rounded px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                  >
                    Use
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legendary Actions */}
      {entity.legendaryActions && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
              Legendary Actions
            </h4>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({
                  length: entity.legendaryActions.maxActions,
                }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i <
                      entity.legendaryActions!.maxActions -
                        entity.legendaryActions!.usedActions
                        ? 'bg-accent-amber-bg-strong'
                        : 'bg-surface-secondary'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={onResetLegendaryActions}
                className="text-muted hover:text-body rounded p-0.5"
                title="Reset"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
          {entity.legendaryActions.actions.map(action => {
            const remaining =
              entity.legendaryActions!.maxActions -
              entity.legendaryActions!.usedActions;
            const canUse = remaining >= action.cost;
            return (
              <div
                key={action.id}
                className="bg-surface-secondary flex items-center justify-between rounded px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-body text-sm font-medium">
                    {action.name}
                  </span>
                  <span className="text-muted ml-1 text-xs">
                    ({action.cost} action{action.cost > 1 ? 's' : ''})
                  </span>
                </div>
                <button
                  onClick={() => onUseLegendaryAction(action.id)}
                  disabled={!canUse}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    canUse
                      ? 'bg-accent-amber-bg text-accent-amber-text hover:opacity-80'
                      : 'bg-surface-secondary text-faint cursor-not-allowed'
                  }`}
                >
                  Use
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lair Actions */}
      {isLair && entity.lairActions && (
        <div className="space-y-1">
          <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
            Lair Actions (1/round)
          </h4>
          {entity.lairActions.map(la => (
            <div
              key={la.id}
              className="bg-surface-secondary flex items-center justify-between rounded px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <span className="text-body text-sm font-medium">{la.name}</span>
                <p
                  className="text-muted line-clamp-2 text-xs"
                  dangerouslySetInnerHTML={{ __html: la.description }}
                />
              </div>
              <button
                onClick={() => onUseLairAction?.(la.id)}
                disabled={la.usedThisRound}
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  la.usedThisRound
                    ? 'bg-surface-secondary text-faint cursor-not-allowed'
                    : 'bg-accent-amber-bg text-accent-amber-text hover:opacity-80'
                }`}
              >
                {la.usedThisRound ? 'Used' : 'Use'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Concentration */}
      {!isLair && (
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent-orange-text shrink-0" />
          <span className="text-body text-xs">Concentration:</span>
          {isPlayer ? (
            <span className="text-body text-xs">
              {entity.concentrationSpell ? (
                <span className="text-accent-orange-text font-medium">
                  {entity.concentrationSpell}
                </span>
              ) : (
                <span className="text-faint">None</span>
              )}
              <span className="text-faint ml-1">(synced)</span>
            </span>
          ) : (
            <>
              <input
                type="text"
                value={entity.concentrationSpell ?? ''}
                onChange={e => onSetConcentration(e.target.value || null)}
                placeholder="None"
                className="bg-surface-secondary text-body placeholder:text-faint flex-1 rounded px-2 py-0.5 text-xs"
              />
              {entity.concentrationSpell && (
                <button
                  onClick={() => onSetConcentration(null)}
                  className="text-muted hover:text-accent-red-text text-xs"
                >
                  Drop
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Conditions quick-add */}
      <div className="space-y-1">
        <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
          Conditions
        </h4>
        <div className="flex flex-wrap gap-1">
          {COMMON_CONDITIONS.map(cond => {
            const isActive = entity.conditions.some(c => c.name === cond);
            return (
              <button
                key={cond}
                onClick={() => {
                  if (isActive) {
                    const existing = entity.conditions.find(
                      c => c.name === cond
                    );
                    if (existing) onRemoveCondition(existing.id);
                  } else {
                    handleAddCondition(cond);
                  }
                }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-red-bg text-accent-red-text'
                    : 'bg-surface-secondary text-muted hover:text-body'
                }`}
              >
                {cond}
              </button>
            );
          })}
        </div>
      </div>

      {/* Remove entity */}
      <div className="border-divider flex justify-end border-t pt-2">
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 size={14} />}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
