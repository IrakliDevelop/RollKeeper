'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import type {
  TemporaryBuff,
  BuffEffect,
  BuffTargetStat,
  BuffMode,
  AbilityName,
} from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Autocomplete } from '@/components/ui/forms/Autocomplete';

// ============================================================
// CONSTANTS
// ============================================================

const TARGET_STAT_OPTIONS: { value: BuffTargetStat; label: string }[] = [
  { value: 'ac', label: 'Armor Class' },
  { value: 'maxHp', label: 'Max HP' },
  { value: 'tempHp', label: 'Temp HP' },
  { value: 'speed', label: 'Speed' },
  { value: 'savingThrow', label: 'Saving Throw' },
  { value: 'attackBonus', label: 'Attack Bonus' },
  { value: 'damageResistance', label: 'Damage Resistance' },
  { value: 'damageImmunity', label: 'Damage Immunity' },
  { value: 'conditionImmunity', label: 'Condition Immunity' },
];

const MODE_OPTIONS: Record<
  BuffTargetStat,
  { value: BuffMode; label: string }[]
> = {
  ac: [
    { value: 'add', label: 'Bonus (+/-)' },
    { value: 'set', label: 'Set To' },
    { value: 'floor', label: 'Minimum' },
  ],
  maxHp: [{ value: 'add', label: 'Bonus (+/-)' }],
  tempHp: [{ value: 'grant', label: 'Grant' }],
  speed: [{ value: 'add', label: 'Bonus (+/-)' }],
  savingThrow: [{ value: 'add', label: 'Bonus (+/-)' }],
  attackBonus: [{ value: 'add', label: 'Bonus (+/-)' }],
  damageResistance: [{ value: 'grant', label: 'Grant' }],
  damageImmunity: [{ value: 'grant', label: 'Grant' }],
  conditionImmunity: [{ value: 'grant', label: 'Grant' }],
};

const DAMAGE_TYPE_OPTIONS = [
  { value: 'acid', label: 'Acid' },
  { value: 'bludgeoning', label: 'Bludgeoning' },
  { value: 'cold', label: 'Cold' },
  { value: 'fire', label: 'Fire' },
  { value: 'force', label: 'Force' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'necrotic', label: 'Necrotic' },
  { value: 'piercing', label: 'Piercing' },
  { value: 'poison', label: 'Poison' },
  { value: 'psychic', label: 'Psychic' },
  { value: 'radiant', label: 'Radiant' },
  { value: 'slashing', label: 'Slashing' },
  { value: 'thunder', label: 'Thunder' },
];

const CONDITION_TYPE_OPTIONS = [
  { value: 'Blinded', label: 'Blinded' },
  { value: 'Charmed', label: 'Charmed' },
  { value: 'Deafened', label: 'Deafened' },
  { value: 'Exhaustion', label: 'Exhaustion' },
  { value: 'Frightened', label: 'Frightened' },
  { value: 'Grappled', label: 'Grappled' },
  { value: 'Incapacitated', label: 'Incapacitated' },
  { value: 'Invisible', label: 'Invisible' },
  { value: 'Paralyzed', label: 'Paralyzed' },
  { value: 'Petrified', label: 'Petrified' },
  { value: 'Poisoned', label: 'Poisoned' },
  { value: 'Prone', label: 'Prone' },
  { value: 'Restrained', label: 'Restrained' },
  { value: 'Stunned', label: 'Stunned' },
  { value: 'Unconscious', label: 'Unconscious' },
];

const ABILITY_OPTIONS: { value: AbilityName; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'dexterity', label: 'Dexterity' },
  { value: 'constitution', label: 'Constitution' },
  { value: 'intelligence', label: 'Intelligence' },
  { value: 'wisdom', label: 'Wisdom' },
  { value: 'charisma', label: 'Charisma' },
];

interface PresetBuff {
  name: string;
  source: string;
  effects: Omit<BuffEffect, 'id'>[];
}

const PRESET_BUFFS: PresetBuff[] = [
  {
    name: 'Shield',
    source: 'Spell',
    effects: [
      {
        targetStat: 'ac',
        mode: 'add',
        value: 5,
        description: '+5 AC until start of next turn',
      },
    ],
  },
  {
    name: 'Haste',
    source: 'Spell',
    effects: [
      { targetStat: 'ac', mode: 'add', value: 2, description: '+2 AC' },
      {
        targetStat: 'speed',
        mode: 'add',
        value: 0,
        description: 'Speed doubled (enter your bonus)',
      },
    ],
  },
  {
    name: 'Aid',
    source: 'Spell',
    effects: [
      {
        targetStat: 'maxHp',
        mode: 'add',
        value: 5,
        description: '+5 max HP (2nd level)',
      },
    ],
  },
  {
    name: 'Shield of Faith',
    source: 'Spell',
    effects: [
      { targetStat: 'ac', mode: 'add', value: 2, description: '+2 AC' },
    ],
  },
  {
    name: 'Mage Armor',
    source: 'Spell',
    effects: [
      {
        targetStat: 'ac',
        mode: 'set',
        value: 13,
        description: 'AC = 13 + DEX mod (enter total)',
      },
    ],
  },
  {
    name: 'Barkskin',
    source: 'Spell',
    effects: [
      {
        targetStat: 'ac',
        mode: 'floor',
        value: 16,
        description: "AC can't be less than 16",
      },
    ],
  },
  {
    name: 'Bless',
    source: 'Spell',
    effects: [
      {
        targetStat: 'attackBonus',
        mode: 'add',
        value: 2,
        description: '+1d4 (avg 2.5) to attack rolls',
      },
      {
        targetStat: 'savingThrow',
        mode: 'add',
        value: 2,
        description: '+1d4 (avg 2.5) to saving throws',
      },
    ],
  },
  {
    name: 'Bladesong',
    source: 'Class Feature',
    effects: [
      {
        targetStat: 'ac',
        mode: 'add',
        value: 0,
        description: '+ INT modifier to AC (enter your bonus)',
      },
      {
        targetStat: 'speed',
        mode: 'add',
        value: 10,
        description: '+10 ft speed',
      },
    ],
  },
  {
    name: 'Rage',
    source: 'Class Feature',
    effects: [
      {
        targetStat: 'damageResistance',
        mode: 'grant',
        value: 0,
        targetDamageType: 'bludgeoning',
        description: 'Resistance to bludgeoning',
      },
      {
        targetStat: 'damageResistance',
        mode: 'grant',
        value: 0,
        targetDamageType: 'piercing',
        description: 'Resistance to piercing',
      },
      {
        targetStat: 'damageResistance',
        mode: 'grant',
        value: 0,
        targetDamageType: 'slashing',
        description: 'Resistance to slashing',
      },
    ],
  },
  {
    name: 'Protection from Poison',
    source: 'Spell',
    effects: [
      {
        targetStat: 'damageResistance',
        mode: 'grant',
        value: 0,
        targetDamageType: 'poison',
        description: 'Resistance to poison damage',
      },
      {
        targetStat: 'conditionImmunity',
        mode: 'grant',
        value: 0,
        targetCondition: 'Poisoned',
        description: 'Immune to poisoned condition',
      },
    ],
  },
  {
    name: 'Protection from Energy',
    source: 'Spell',
    effects: [
      {
        targetStat: 'damageResistance',
        mode: 'grant',
        value: 0,
        targetDamageType: 'fire',
        description: 'Resistance to chosen energy type (change as needed)',
      },
    ],
  },
  {
    name: "Heroes' Feast",
    source: 'Spell',
    effects: [
      {
        targetStat: 'conditionImmunity',
        mode: 'grant',
        value: 0,
        targetCondition: 'Frightened',
        description: 'Immune to frightened',
      },
      {
        targetStat: 'conditionImmunity',
        mode: 'grant',
        value: 0,
        targetCondition: 'Poisoned',
        description: 'Immune to poisoned',
      },
      {
        targetStat: 'damageImmunity',
        mode: 'grant',
        value: 0,
        targetDamageType: 'poison',
        description: 'Immune to poison damage',
      },
    ],
  },
];

// ============================================================
// EFFECT SUMMARY HELPERS
// ============================================================

function getEffectLabel(effect: BuffEffect): string {
  // Special labels for resistance/immunity effects
  if (effect.targetStat === 'damageResistance' && effect.targetDamageType) {
    return `Resist ${effect.targetDamageType}`;
  }
  if (effect.targetStat === 'damageImmunity' && effect.targetDamageType) {
    return `Immune ${effect.targetDamageType}`;
  }
  if (effect.targetStat === 'conditionImmunity' && effect.targetCondition) {
    return `Immune ${effect.targetCondition}`;
  }

  const statLabels: Record<BuffTargetStat, string> = {
    ac: 'AC',
    maxHp: 'Max HP',
    tempHp: 'Temp HP',
    speed: 'Speed',
    savingThrow: 'Save',
    attackBonus: 'Atk',
    damageResistance: 'Resist',
    damageImmunity: 'Immune',
    conditionImmunity: 'Cond. Immune',
  };
  const stat = statLabels[effect.targetStat];

  switch (effect.mode) {
    case 'add':
      return `${stat} ${effect.value >= 0 ? '+' : ''}${effect.value}`;
    case 'set':
      return `${stat} = ${effect.value}`;
    case 'floor':
      return `${stat} min ${effect.value}`;
    case 'grant':
      return `${effect.value} ${stat}`;
    default:
      return `${stat} ${effect.value}`;
  }
}

function getEffectBadgeVariant(
  targetStat: BuffTargetStat
): 'info' | 'success' | 'warning' | 'danger' | 'neutral' {
  switch (targetStat) {
    case 'ac':
      return 'info';
    case 'maxHp':
      return 'success';
    case 'tempHp':
      return 'warning';
    case 'speed':
      return 'neutral';
    case 'savingThrow':
      return 'info';
    case 'attackBonus':
      return 'danger';
    case 'damageResistance':
      return 'warning';
    case 'damageImmunity':
      return 'danger';
    case 'conditionImmunity':
      return 'success';
    default:
      return 'neutral';
  }
}

// ============================================================
// BUFF CARD
// ============================================================

function BuffCard({
  buff,
  onToggle,
  onDelete,
}: {
  buff: TemporaryBuff;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`border-divider rounded-lg border-2 p-4 transition-all ${
        buff.isActive
          ? 'border-accent-emerald-border bg-surface-raised shadow-md'
          : 'bg-surface-secondary opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={buff.isActive}
          onCheckedChange={() => onToggle(buff.id)}
          size="sm"
          variant={buff.isActive ? 'success' : 'default'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-heading truncate font-semibold">
              {buff.name}
            </span>
            {buff.source && (
              <span className="text-muted text-xs">{buff.source}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {buff.effects.map(effect => (
              <Badge
                key={effect.id}
                variant={getEffectBadgeVariant(effect.targetStat)}
                size="sm"
              >
                {getEffectLabel(effect)}
              </Badge>
            ))}
          </div>
        </div>
        <Button
          onClick={() => onDelete(buff.id)}
          variant="ghost"
          size="sm"
          className="text-muted hover:text-accent-red-text shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ADD BUFF FORM
// ============================================================

interface EffectFormRow {
  tempId: string;
  targetStat: BuffTargetStat;
  mode: BuffMode;
  value: string;
  targetAbility: AbilityName | '';
  targetDamageType: string;
  targetCondition: string;
  description: string;
}

const GRANT_ONLY_STATS: BuffTargetStat[] = [
  'damageResistance',
  'damageImmunity',
  'conditionImmunity',
];

function createEmptyEffect(): EffectFormRow {
  return {
    tempId: `eff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetStat: 'ac',
    mode: 'add',
    value: '',
    targetAbility: '',
    targetDamageType: '',
    targetCondition: '',
    description: '',
  };
}

function AddBuffForm({
  onAdd,
  onCancel,
}: {
  onAdd: (buff: Omit<TemporaryBuff, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [effects, setEffects] = useState<EffectFormRow[]>([
    createEmptyEffect(),
  ]);
  const [showPresets, setShowPresets] = useState(true);

  const handleTargetChange = useCallback(
    (idx: number, newTarget: BuffTargetStat) => {
      setEffects(prev =>
        prev.map((e, i) => {
          if (i !== idx) return e;
          const modes = MODE_OPTIONS[newTarget];
          const isGrantOnly = GRANT_ONLY_STATS.includes(newTarget);
          return {
            ...e,
            targetStat: newTarget,
            mode: modes[0]?.value || 'add',
            value: isGrantOnly ? '0' : '',
            targetAbility: newTarget === 'savingThrow' ? 'strength' : '',
            targetDamageType:
              newTarget === 'damageResistance' || newTarget === 'damageImmunity'
                ? 'fire'
                : '',
            targetCondition:
              newTarget === 'conditionImmunity' ? 'Frightened' : '',
          };
        })
      );
    },
    []
  );

  const handleModeChange = useCallback((idx: number, newMode: BuffMode) => {
    setEffects(prev =>
      prev.map((e, i) => (i === idx ? { ...e, mode: newMode } : e))
    );
  }, []);

  const handleValueChange = useCallback((idx: number, val: string) => {
    setEffects(prev =>
      prev.map((e, i) => (i === idx ? { ...e, value: val } : e))
    );
  }, []);

  const handleAbilityChange = useCallback(
    (idx: number, ability: AbilityName) => {
      setEffects(prev =>
        prev.map((e, i) => (i === idx ? { ...e, targetAbility: ability } : e))
      );
    },
    []
  );

  const addEffectRow = useCallback(() => {
    setEffects(prev => [...prev, createEmptyEffect()]);
  }, []);

  const removeEffectRow = useCallback((idx: number) => {
    setEffects(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const applyPreset = useCallback((preset: PresetBuff) => {
    setName(preset.name);
    setSource(preset.source);
    setEffects(
      preset.effects.map(e => ({
        tempId: `eff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        targetStat: e.targetStat,
        mode: e.mode,
        value: e.value.toString(),
        targetAbility: '',
        targetDamageType: e.targetDamageType || '',
        targetCondition: e.targetCondition || '',
        description: e.description || '',
      }))
    );
    setShowPresets(false);
  }, []);

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (effects.length === 0) return false;
    return effects.every(e => {
      if (
        e.targetStat === 'damageResistance' ||
        e.targetStat === 'damageImmunity'
      ) {
        return !!e.targetDamageType;
      }
      if (e.targetStat === 'conditionImmunity') {
        return !!e.targetCondition;
      }
      return e.value !== '' && !isNaN(Number(e.value));
    });
  }, [name, effects]);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    const buffEffects: BuffEffect[] = effects.map(e => ({
      id: `be-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetStat: e.targetStat,
      mode: e.mode,
      value: Number(e.value),
      targetAbility:
        e.targetStat === 'savingThrow' && e.targetAbility
          ? (e.targetAbility as AbilityName)
          : undefined,
      targetDamageType:
        (e.targetStat === 'damageResistance' ||
          e.targetStat === 'damageImmunity') &&
        e.targetDamageType
          ? e.targetDamageType
          : undefined,
      targetCondition:
        e.targetStat === 'conditionImmunity' && e.targetCondition
          ? e.targetCondition
          : undefined,
      description: e.description || undefined,
    }));

    onAdd({
      name: name.trim(),
      source: source.trim() || undefined,
      effects: buffEffects,
      isActive: false,
    });
  }, [isValid, name, source, effects, onAdd]);

  return (
    <div className="border-accent-blue-border from-accent-blue-bg to-accent-blue-bg rounded-lg border-2 bg-linear-to-br p-4">
      <h5 className="text-accent-blue-text mb-3 font-bold">Add New Buff</h5>

      {/* Preset Templates */}
      {showPresets && (
        <div className="mb-4">
          <p className="text-muted mb-2 text-xs font-medium">
            Quick presets (click to auto-fill):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_BUFFS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="border-divider bg-surface-raised hover:border-accent-blue-border text-body rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:shadow-sm"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name & Source */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="Buff name *"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          placeholder="Source (optional)"
          value={source}
          onChange={e => setSource(e.target.value)}
        />
      </div>

      {/* Effects */}
      <div className="space-y-2">
        <p className="text-body text-xs font-medium">Effects:</p>
        {effects.map((effect, idx) => (
          <div
            key={effect.tempId}
            className="border-divider bg-surface-raised rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[150px] flex-1">
                <label className="text-muted mb-1 block text-xs">Stat</label>
                <Autocomplete
                  options={TARGET_STAT_OPTIONS}
                  value={effect.targetStat}
                  onChange={v => handleTargetChange(idx, v as BuffTargetStat)}
                  placeholder="Search stats..."
                />
              </div>

              {!GRANT_ONLY_STATS.includes(effect.targetStat) && (
                <div className="min-w-[110px] flex-1">
                  <label className="text-muted mb-1 block text-xs">Mode</label>
                  <SelectField
                    value={effect.mode}
                    onValueChange={v => handleModeChange(idx, v as BuffMode)}
                  >
                    {MODE_OPTIONS[effect.targetStat].map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>
              )}

              {effect.targetStat === 'savingThrow' && (
                <div className="min-w-[110px] flex-1">
                  <label className="text-muted mb-1 block text-xs">
                    Ability
                  </label>
                  <SelectField
                    value={effect.targetAbility || 'strength'}
                    onValueChange={v =>
                      handleAbilityChange(idx, v as AbilityName)
                    }
                  >
                    {ABILITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>
              )}

              {(effect.targetStat === 'damageResistance' ||
                effect.targetStat === 'damageImmunity') && (
                <div className="min-w-[130px] flex-1">
                  <label className="text-muted mb-1 block text-xs">
                    Damage Type
                  </label>
                  <Autocomplete
                    options={DAMAGE_TYPE_OPTIONS}
                    value={effect.targetDamageType}
                    onChange={v =>
                      setEffects(prev =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, targetDamageType: v } : e
                        )
                      )
                    }
                    placeholder="Search damage..."
                  />
                </div>
              )}

              {effect.targetStat === 'conditionImmunity' && (
                <div className="min-w-[130px] flex-1">
                  <label className="text-muted mb-1 block text-xs">
                    Condition
                  </label>
                  <Autocomplete
                    options={CONDITION_TYPE_OPTIONS}
                    value={effect.targetCondition}
                    onChange={v =>
                      setEffects(prev =>
                        prev.map((e, i) =>
                          i === idx ? { ...e, targetCondition: v } : e
                        )
                      )
                    }
                    placeholder="Search conditions..."
                  />
                </div>
              )}

              {!GRANT_ONLY_STATS.includes(effect.targetStat) && (
                <div className="w-20">
                  <label className="text-muted mb-1 block text-xs">Value</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={effect.value}
                    onChange={e => handleValueChange(idx, e.target.value)}
                  />
                </div>
              )}

              {effects.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEffectRow(idx)}
                  className="text-muted hover:text-accent-red-text"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {effect.description && (
              <p className="text-muted mt-1.5 text-xs italic">
                {effect.description}
              </p>
            )}
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addEffectRow}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          className="text-accent-blue-text"
        >
          Add Another Effect
        </Button>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!isValid}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Buff
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TemporaryBuffsManager() {
  const { character, addBuff, toggleBuff, deleteBuff, clearAllBuffs } =
    useCharacterStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const buffs = character.temporaryBuffs || [];
  const activeCount = buffs.filter(b => b.isActive).length;

  const handleAdd = useCallback(
    (buff: Omit<TemporaryBuff, 'id' | 'createdAt' | 'updatedAt'>) => {
      addBuff(buff);
      setShowAddForm(false);
    },
    [addBuff]
  );

  return (
    <div className="border-divider bg-surface rounded-lg border-2 shadow-sm">
      {/* Header */}
      <div className="border-divider from-surface-secondary to-surface-hover border-b-2 bg-linear-to-r p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2"
          >
            <Zap className="text-accent-blue-text h-5 w-5" />
            <h3 className="text-heading text-lg font-bold">Temporary Buffs</h3>
            {buffs.length > 0 && (
              <Badge variant={activeCount > 0 ? 'info' : 'neutral'} size="sm">
                {activeCount}/{buffs.length}
              </Badge>
            )}
            {isCollapsed ? (
              <ChevronDown className="text-muted h-4 w-4" />
            ) : (
              <ChevronUp className="text-muted h-4 w-4" />
            )}
          </button>
          <div className="flex items-center gap-2">
            {buffs.length > 0 && !isCollapsed && (
              <Button
                onClick={clearAllBuffs}
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                className="text-muted hover:text-accent-red-text"
              >
                Clear All
              </Button>
            )}
            {!isCollapsed && (
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant={showAddForm ? 'outline' : 'primary'}
                size="sm"
                leftIcon={
                  showAddForm ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )
                }
              >
                {showAddForm ? 'Cancel' : 'Add Buff'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {showAddForm && (
            <div className="mb-4">
              <AddBuffForm
                onAdd={handleAdd}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          <div className="space-y-3">
            {buffs.map(buff => (
              <BuffCard
                key={buff.id}
                buff={buff}
                onToggle={toggleBuff}
                onDelete={deleteBuff}
              />
            ))}
            {buffs.length === 0 && !showAddForm && (
              <div className="border-divider-strong bg-surface-secondary rounded-lg border-2 border-dashed py-8 text-center">
                <Sparkles className="text-faint mx-auto mb-3 h-10 w-10" />
                <p className="text-muted font-medium">No temporary buffs</p>
                <p className="text-muted mt-1 text-sm">
                  Add buffs from spells, class features, or magic items
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
