'use client';

import React, { useState, useLayoutEffect, useRef } from 'react';
import { Minus, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Summon } from '@/types/summon';
import type { EncounterCondition } from '@/types/encounter';
import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import { Badge } from '@/components/ui/layout/badge';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';

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

interface SummonCardProps {
  summon: Summon;
  onDamage: (summonId: string, amount: number) => void;
  onHeal: (summonId: string, amount: number) => void;
  onAddTempHp: (summonId: string, amount: number) => void;
  onAddCondition: (summonId: string, condition: EncounterCondition) => void;
  onRemoveCondition: (summonId: string, conditionId: string) => void;
  onDismiss: (summonId: string) => void;
}

export function SummonCard({
  summon,
  onDamage,
  onHeal,
  onAddTempHp,
  onAddCondition,
  onRemoveCondition,
  onDismiss,
}: SummonCardProps) {
  const [hpInput, setHpInput] = useState<number | undefined>();
  const conditionRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const addConditionRef = useRef<HTMLButtonElement>(null);
  const focusAfterConditionRemoval = useRef<string | 'add' | null>(null);
  const [showStatBlock, setShowStatBlock] = useState(false);
  const [showConditions, setShowConditions] = useState(false);

  const { entity } = summon;
  const isDead = entity.currentHp <= 0;

  useLayoutEffect(() => {
    const target = focusAfterConditionRemoval.current;
    if (!target) return;
    const button =
      target === 'add'
        ? addConditionRef.current
        : conditionRefs.current[target]?.querySelector('button');
    button?.focus();
    focusAfterConditionRemoval.current = null;
  }, [entity.conditions]);

  const handleRemoveCondition = (id: string) => {
    const index = entity.conditions.findIndex(condition => condition.id === id);
    focusAfterConditionRemoval.current =
      entity.conditions[index + 1]?.id ??
      entity.conditions[index - 1]?.id ??
      'add';
    onRemoveCondition(summon.id, id);
  };

  const handleDamage = () => {
    const amount = hpInput;
    if (amount !== undefined && amount > 0) {
      onDamage(summon.id, amount);
      setHpInput(undefined);
    }
  };

  const handleHeal = () => {
    const amount = hpInput;
    if (amount !== undefined && amount > 0) {
      onHeal(summon.id, amount);
      setHpInput(undefined);
    }
  };

  const handleAddTempHp = () => {
    const amount = hpInput;
    if (amount !== undefined && amount > 0) {
      onAddTempHp(summon.id, amount);
      setHpInput(undefined);
    }
  };

  const handleAddCondition = (name: string) => {
    const condition: EncounterCondition = {
      id: `${name.toLowerCase()}-${Date.now()}`,
      name,
    };
    onAddCondition(summon.id, condition);
    setShowConditions(false);
  };

  const typeLabel =
    summon.type === 'familiar'
      ? 'Familiar'
      : summon.type === 'wild-shape'
        ? 'Wild Shape'
        : 'Summon';

  return (
    <div
      className={`border-divider bg-surface-raised rounded-md border ${isDead ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-heading min-w-0 text-sm font-semibold break-words">
            {summon.customName || entity.name}
          </h3>
          <Badge variant="neutral">{typeLabel}</Badge>
          {summon.requiresConcentration && (
            <ConditionChip name="Concentration" kind="concentration" />
          )}
          {isDead && <Badge variant="danger">Dead</Badge>}
        </div>
        <Button
          variant="ghost"
          onClick={() => onDismiss(summon.id)}
          className="h-7 w-7 p-0"
          aria-label="Dismiss summon"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* HP Bar */}
      <div className="px-3 pb-2">
        <HPBar
          current={entity.currentHp}
          max={entity.maxHp}
          temp={entity.tempHp}
          size="md"
        />
      </div>

      {/* Quick Stats */}
      <div className="border-divider flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
        <span className="text-body">
          <span className="text-muted">AC</span> {entity.armorClass}
        </span>
        {summon.castAtLevel && (
          <span className="text-body">
            <span className="text-muted">Cast at level</span>{' '}
            {summon.castAtLevel}
          </span>
        )}
        {summon.duration && (
          <span className="text-muted">{summon.duration}</span>
        )}
        <span className="text-muted">{summon.sourceSpellName}</span>
      </div>

      {/* Conditions */}
      {entity.conditions.length > 0 && (
        <div className="border-divider flex flex-wrap gap-1 border-t px-3 py-2">
          {entity.conditions.map(c => (
            <span
              key={c.id}
              ref={element => {
                conditionRefs.current[c.id] = element;
              }}
            >
              <ConditionChip
                name={c.name}
                onRemove={() => handleRemoveCondition(c.id)}
              />
            </span>
          ))}
        </div>
      )}

      {/* HP Controls */}
      <div className="border-divider flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
        <NumberInput
          aria-label="HP amount"
          value={hpInput}
          onChange={setHpInput}
          allowEmpty
          placeholder="HP"
          className="h-7 text-xs"
          wrapperClassName="w-16 shrink-0"
          min={0}
          onKeyDown={e => {
            if (e.key === 'Enter') handleDamage();
          }}
        />
        <Button
          variant="danger"
          onClick={handleDamage}
          className="h-7 px-2 text-xs"
          disabled={!hpInput || hpInput <= 0}
        >
          <Minus className="mr-0.5 h-3 w-3" />
          Damage
        </Button>
        <Button
          variant="success"
          onClick={handleHeal}
          className="h-7 px-2 text-xs"
          disabled={!hpInput || hpInput <= 0}
        >
          <Plus className="mr-0.5 h-3 w-3" />
          Heal
        </Button>
        <Button
          variant="outline"
          onClick={handleAddTempHp}
          className="h-7 px-2 text-xs"
          disabled={!hpInput || hpInput <= 0}
          aria-label="Add temp HP"
        >
          Temp HP
        </Button>
      </div>

      {/* Action buttons */}
      <div className="border-divider flex items-center gap-1 border-t px-3 py-2">
        <Button
          variant="ghost"
          ref={addConditionRef}
          onClick={() => setShowConditions(!showConditions)}
          className="h-7 px-2 text-xs"
        >
          Add condition
        </Button>
        {entity.monsterStatBlock && (
          <Button
            variant="ghost"
            onClick={() => setShowStatBlock(!showStatBlock)}
            className="h-7 px-2 text-xs"
          >
            {showStatBlock ? (
              <ChevronUp className="mr-1 h-3 w-3" />
            ) : (
              <ChevronDown className="mr-1 h-3 w-3" />
            )}
            Stat block
          </Button>
        )}
      </div>

      {/* Condition picker */}
      {showConditions && (
        <div className="border-divider border-t px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {COMMON_CONDITIONS.filter(
              c => !entity.conditions.some(ec => ec.name === c)
            ).map(c => (
              <button
                key={c}
                onClick={() => handleAddCondition(c)}
                className="bg-surface text-body hover:bg-surface-hover border-divider rounded-sm border px-2 py-0.5 text-xs transition-colors pointer-coarse:min-h-11"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stat Block */}
      {showStatBlock && entity.monsterStatBlock && (
        <div className="border-divider border-t px-3 py-2">
          <MonsterStatBlockPanel statBlock={entity.monsterStatBlock} />
        </div>
      )}
    </div>
  );
}
