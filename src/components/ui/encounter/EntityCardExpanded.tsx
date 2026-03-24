'use client';

import React, { useState } from 'react';
import {
  Minus,
  Plus,
  Shield,
  Trash2,
  RotateCcw,
  Brain,
  ClockAlert,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Eye,
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
  onAddCondition: (condition: {
    name: string;
    description?: string;
    source?: 'player-sync' | 'dm';
  }) => void;
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
  const [customEffectInput, setCustomEffectInput] = useState('');

  const isPlayer = entity.type === 'player';
  const isPlayerOwned = isPlayer || !!entity.summonOwnerId;

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
    onAddCondition({ name, source: 'dm' });
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
            {/* Editable max HP for non-players (summons are player-managed too) */}
            {!isPlayerOwned &&
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
                  className="bg-surface-raised text-heading w-14 rounded px-1 py-0.5 text-center text-xs font-medium shadow-sm"
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

          {/* Damage/Heal controls — not for players or summons (synced from player sheet) */}
          {!isPlayerOwned && (
            <div className="flex items-center gap-2">
              <Input
                value={hpInput}
                onChange={e => setHpInput(e.target.value)}
                placeholder="Amount"
                type="number"
                wrapperClassName="w-24"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleDamage();
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const val = parseInt(hpInput);
                    if (!isNaN(val) && val > 0)
                      setHpInput(String(Math.floor(val / 2)));
                  }}
                  className="bg-surface-raised text-muted hover:text-heading rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
                  title="Half (resistance)"
                >
                  ½×
                </button>
                <button
                  onClick={() => {
                    const val = parseInt(hpInput);
                    if (!isNaN(val) && val > 0) setHpInput(String(val * 2));
                  }}
                  className="bg-surface-raised text-muted hover:text-heading rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
                  title="Double (vulnerability)"
                >
                  2×
                </button>
              </div>
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
              <div className="text-muted ml-2 flex items-center gap-1 text-sm">
                <Shield size={14} />
                <input
                  type="number"
                  value={entity.armorClass}
                  onChange={e =>
                    onUpdate({
                      armorClass: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-surface-raised text-heading w-12 rounded px-1 py-0.5 text-center text-sm font-medium shadow-sm"
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

      {/* Player Defenses & Senses (synced from character sheet) */}
      {isPlayer && <PlayerDefensesSenses entity={entity} />}

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
          {entity.abilities.map(ability => {
            const max = ability.maxUses ?? 1;
            const used = ability.usedUses;
            const showPips = max > 1;

            return (
              <div
                key={ability.id}
                className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
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
                  {ability.usageType === 'per-day' && max > 0 && (
                    <span className="text-muted ml-1 text-xs">({max}/Day)</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {showPips ? (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: max }).map((_, i) => {
                        const isUsed = i < used;
                        return (
                          <button
                            key={i}
                            onClick={() =>
                              isUsed
                                ? onRestoreAbility(ability.id)
                                : onUseAbility(ability.id)
                            }
                            className={`h-4 w-4 rounded-full border-2 transition-colors ${
                              isUsed
                                ? 'border-accent-red-border bg-accent-red-bg'
                                : 'border-accent-emerald-border bg-accent-emerald-bg'
                            }`}
                            title={
                              isUsed
                                ? `Restore 1 use (${used}/${max} used)`
                                : `Use (${used}/${max} used)`
                            }
                          />
                        );
                      })}
                    </div>
                  ) : ability.usedUses > 0 ? (
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
            );
          })}
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
              <div className="flex gap-1">
                {Array.from({
                  length: entity.legendaryActions.maxActions,
                }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-full border-2 ${
                      i <
                      entity.legendaryActions!.maxActions -
                        entity.legendaryActions!.usedActions
                        ? 'border-accent-amber-border-strong bg-accent-amber-border-strong'
                        : 'border-divider bg-surface-raised'
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
                className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
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
                      : 'bg-surface-raised text-faint cursor-not-allowed'
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
              className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
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
                    ? 'bg-surface-raised text-faint cursor-not-allowed'
                    : 'bg-accent-emerald-bg text-accent-emerald-text hover:opacity-80'
                }`}
              >
                {la.usedThisRound ? 'Used' : 'Use'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Concentration & Reaction */}
      {!isLair && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-accent-orange-text shrink-0" />
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
                  className="bg-surface-raised text-body placeholder:text-faint flex-1 rounded px-2 py-0.5 text-xs shadow-sm"
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

          {/* Reaction toggle */}
          <div className="flex items-center gap-2">
            <ClockAlert size={14} className="text-accent-red-text shrink-0" />
            <span className="text-body text-xs">Reaction:</span>
            {isPlayer ? (
              <span className="text-body text-xs">
                {entity.hasUsedReaction ? (
                  <span className="text-accent-red-text font-medium">Used</span>
                ) : (
                  <span className="text-accent-emerald-text font-medium">
                    Available
                  </span>
                )}
                <span className="text-faint ml-1">(synced)</span>
              </span>
            ) : (
              <button
                onClick={() =>
                  onUpdate({ hasUsedReaction: !entity.hasUsedReaction })
                }
                className={`rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  entity.hasUsedReaction
                    ? 'border-accent-red-border-strong bg-accent-red-bg text-accent-red-text'
                    : 'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text'
                }`}
              >
                {entity.hasUsedReaction ? 'Used' : 'Available'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conditions quick-add */}
      <div className="space-y-2">
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
                    : 'bg-surface-raised text-muted hover:text-body shadow-sm'
                }`}
              >
                {cond}
              </button>
            );
          })}
        </div>

        {/* Custom effect input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={customEffectInput}
            onChange={e => setCustomEffectInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customEffectInput.trim()) {
                onAddCondition({
                  name: customEffectInput.trim(),
                  description: 'Custom effect',
                  source: 'dm',
                });
                setCustomEffectInput('');
              }
            }}
            placeholder="Custom effect (e.g. Bane, Hex)..."
            className="bg-surface-raised text-body placeholder:text-faint flex-1 rounded px-2 py-1 text-xs shadow-sm"
          />
          <button
            onClick={() => {
              if (customEffectInput.trim()) {
                onAddCondition({
                  name: customEffectInput.trim(),
                  description: 'Custom effect',
                  source: 'dm',
                });
                setCustomEffectInput('');
              }
            }}
            disabled={!customEffectInput.trim()}
            className="bg-accent-purple-bg text-accent-purple-text rounded px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add
          </button>
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

function PlayerDefensesSenses({ entity }: { entity: EncounterEntity }) {
  const resistances = entity.damageResistances ?? [];
  const immunities = entity.damageImmunities ?? [];
  const condImmunities = entity.conditionImmunities ?? [];
  const senses = entity.senses ?? [];

  if (
    resistances.length === 0 &&
    immunities.length === 0 &&
    condImmunities.length === 0 &&
    senses.length === 0
  )
    return null;

  return (
    <div className="space-y-2">
      {resistances.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted flex items-center gap-1 text-[10px] font-bold uppercase">
            <ShieldAlert size={10} />
            Resist
          </span>
          {resistances.map(r => (
            <span
              key={r}
              className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              {r}
            </span>
          ))}
        </div>
      )}
      {immunities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted flex items-center gap-1 text-[10px] font-bold uppercase">
            <ShieldCheck size={10} />
            Immune
          </span>
          {immunities.map(i => (
            <span
              key={i}
              className="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              {i}
            </span>
          ))}
        </div>
      )}
      {condImmunities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted flex items-center gap-1 text-[10px] font-bold uppercase">
            <ShieldOff size={10} />
            Cond. Immune
          </span>
          {condImmunities.map(c => (
            <span
              key={c}
              className="border-accent-purple-border bg-accent-purple-bg text-accent-purple-text rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {senses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted flex items-center gap-1 text-[10px] font-bold uppercase">
            <Eye size={10} />
            Senses
          </span>
          {senses.map(s => (
            <span
              key={`${s.name}-${s.range}`}
              className="border-accent-blue-border bg-accent-blue-bg text-accent-blue-text rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              {s.name} {s.range} ft.
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
