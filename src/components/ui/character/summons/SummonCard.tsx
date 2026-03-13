'use client';

import React, { useState } from 'react';
import {
  Minus,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Brain,
  X,
} from 'lucide-react';
import type { Summon } from '@/types/summon';
import type { EncounterCondition } from '@/types/encounter';
import { HPBar } from '@/components/shared/combat/HPBar';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
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
  const [hpInput, setHpInput] = useState('');
  const [showStatBlock, setShowStatBlock] = useState(false);
  const [showConditions, setShowConditions] = useState(false);

  const { entity } = summon;
  const isDead = entity.currentHp <= 0;

  const handleDamage = () => {
    const amount = parseInt(hpInput);
    if (!isNaN(amount) && amount > 0) {
      onDamage(summon.id, amount);
      setHpInput('');
    }
  };

  const handleHeal = () => {
    const amount = parseInt(hpInput);
    if (!isNaN(amount) && amount > 0) {
      onHeal(summon.id, amount);
      setHpInput('');
    }
  };

  const handleAddTempHp = () => {
    const amount = parseInt(hpInput);
    if (!isNaN(amount) && amount > 0) {
      onAddTempHp(summon.id, amount);
      setHpInput('');
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

  const typeBadgeVariant =
    summon.type === 'familiar'
      ? 'info'
      : summon.type === 'wild-shape'
        ? 'success'
        : 'warning';

  return (
    <div
      className={`border-divider bg-surface-raised rounded-lg border shadow-sm ${isDead ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <h3 className="text-heading text-sm font-semibold">
            {summon.customName || entity.name}
          </h3>
          <Badge variant={typeBadgeVariant}>{typeLabel}</Badge>
          {summon.requiresConcentration && (
            <span className="bg-accent-orange-bg text-accent-orange-text flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              <Brain className="h-3 w-3" />
              Conc.
            </span>
          )}
          {isDead && <Badge variant="danger">Dead</Badge>}
        </div>
        <Button
          variant="ghost"
          onClick={() => onDismiss(summon.id)}
          className="h-7 w-7 p-0"
          title="Dismiss summon"
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
      <div className="border-divider flex items-center gap-4 border-t px-3 py-2 text-xs">
        <span className="text-body">
          <span className="text-muted">AC</span> {entity.armorClass}
        </span>
        {summon.castAtLevel && (
          <span className="text-body">
            <span className="text-muted">Cast at</span> Lv{summon.castAtLevel}
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
              className="bg-accent-red-bg text-accent-red-text inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            >
              {c.name}
              <button
                onClick={() => onRemoveCondition(summon.id, c.id)}
                className="hover:text-accent-red-text/80"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* HP Controls */}
      <div className="border-divider flex items-center gap-1.5 border-t px-3 py-2">
        <Input
          type="number"
          value={hpInput}
          onChange={e => setHpInput(e.target.value)}
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
          disabled={!hpInput}
        >
          <Minus className="mr-0.5 h-3 w-3" />
          Dmg
        </Button>
        <Button
          variant="success"
          onClick={handleHeal}
          className="h-7 px-2 text-xs"
          disabled={!hpInput}
        >
          <Plus className="mr-0.5 h-3 w-3" />
          Heal
        </Button>
        <Button
          variant="outline"
          onClick={handleAddTempHp}
          className="h-7 px-2 text-xs"
          disabled={!hpInput}
          title="Add temp HP"
        >
          +THP
        </Button>
      </div>

      {/* Action buttons */}
      <div className="border-divider flex items-center gap-1 border-t px-3 py-2">
        <Button
          variant="ghost"
          onClick={() => setShowConditions(!showConditions)}
          className="h-7 px-2 text-xs"
        >
          + Condition
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
            Stats
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
                className="bg-surface-secondary text-body hover:bg-surface-elevated rounded px-2 py-0.5 text-xs transition-colors"
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
