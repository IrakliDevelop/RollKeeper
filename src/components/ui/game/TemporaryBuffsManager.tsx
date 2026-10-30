'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, X, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
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
import { NumberInput } from '@/components/ui/forms/NumberInput';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Section } from '@/components/ui/layout/section';

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

// ============================================================
// BUFF CARD
// ============================================================

function BuffCard({
  buff,
  onToggle,
  onEdit,
  onDelete,
}: {
  buff: TemporaryBuff;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-buff-row={buff.id}
      role="listitem"
      className="border-divider flex min-w-0 flex-wrap items-start justify-between gap-3 border-b py-4 pointer-coarse:min-h-11"
    >
      <div className="min-w-0 flex-[1_1_12rem]">
        <Switch
          label={buff.name}
          checked={buff.isActive}
          onCheckedChange={() => onToggle(buff.id)}
          size="sm"
          labelClassName="break-words"
        />
        {buff.source && (
          <p className="type-small text-muted mt-1 break-words">
            {buff.source}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {buff.effects.map(effect => (
            <Badge
              key={effect.id}
              data-effect-kind={effect.targetStat}
              variant="neutral"
              size="sm"
              className={
                effect.targetStat === 'tempHp'
                  ? 'border-frost-border text-frost-text'
                  : undefined
              }
            >
              {getEffectLabel(effect)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          data-buff-action="edit"
          aria-label={`Edit ${buff.name}`}
          onClick={() => onEdit(buff.id)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={`Delete ${buff.name}`}
          onClick={() => onDelete(buff.id)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <Trash2 aria-hidden="true" className="size-4" />
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
const EMPTY_BUFFS: TemporaryBuff[] = [];

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

function buffToEffectRows(buff: TemporaryBuff): EffectFormRow[] {
  return buff.effects.map(e => ({
    tempId: e.id,
    targetStat: e.targetStat,
    mode: e.mode,
    value: e.value.toString(),
    targetAbility: (e.targetAbility as AbilityName) || '',
    targetDamageType: e.targetDamageType || '',
    targetCondition: e.targetCondition || '',
    description: e.description || '',
  }));
}

function BuffForm({
  onAdd,
  onUpdate,
  onCancel,
  initialBuff,
}: {
  onAdd?: (buff: Omit<TemporaryBuff, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate?: (id: string, updates: Partial<TemporaryBuff>) => void;
  onCancel: () => void;
  initialBuff?: TemporaryBuff;
}) {
  const isEditing = !!initialBuff;
  const [name, setName] = useState(initialBuff?.name ?? '');
  const [source, setSource] = useState(initialBuff?.source ?? '');
  const [effects, setEffects] = useState<EffectFormRow[]>(
    initialBuff ? buffToEffectRows(initialBuff) : [createEmptyEffect()]
  );
  const [showPresets, setShowPresets] = useState(!isEditing);

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

  const buildEffects = useCallback((): BuffEffect[] => {
    return effects.map(e => ({
      id: e.tempId.startsWith('be-')
        ? e.tempId
        : `be-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  }, [effects]);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    const buffEffects = buildEffects();

    if (isEditing && initialBuff && onUpdate) {
      onUpdate(initialBuff.id, {
        name: name.trim(),
        source: source.trim() || undefined,
        effects: buffEffects,
      });
    } else if (onAdd) {
      onAdd({
        name: name.trim(),
        source: source.trim() || undefined,
        effects: buffEffects,
        isActive: false,
      });
    }
  }, [
    isValid,
    isEditing,
    initialBuff,
    name,
    source,
    buildEffects,
    onAdd,
    onUpdate,
  ]);

  return (
    <div className="space-y-4">
      {/* Preset Templates */}
      {showPresets && (
        <div className="mb-4">
          <p className="type-ui text-muted mb-2">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_BUFFS.map(preset => (
              <Button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                variant="secondary"
                size="sm"
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Name & Source */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          label="Source (optional)"
          value={source}
          onChange={e => setSource(e.target.value)}
        />
      </div>

      {/* Effects */}
      <div className="space-y-2">
        <p className="type-ui text-body">Effects</p>
        {effects.map((effect, idx) => (
          <div key={effect.tempId} className="border-divider border-b py-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[150px] flex-1">
                <label className="type-ui text-muted mb-1 block">Stat</label>
                <Autocomplete
                  options={TARGET_STAT_OPTIONS}
                  value={effect.targetStat}
                  onChange={v => handleTargetChange(idx, v as BuffTargetStat)}
                  placeholder="Search stats..."
                />
              </div>

              {!GRANT_ONLY_STATS.includes(effect.targetStat) && (
                <div className="min-w-[110px] flex-1">
                  <label className="type-ui text-muted mb-1 block">Mode</label>
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
                  <label className="type-ui text-muted mb-1 block">
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
                  <label className="type-ui text-muted mb-1 block">
                    Damage type
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
                  <label className="type-ui text-muted mb-1 block">
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
                <div className="w-28">
                  <NumberInput
                    label="Value"
                    value={
                      effect.value === '' ? undefined : Number(effect.value)
                    }
                    onChange={value =>
                      handleValueChange(
                        idx,
                        value === undefined ? '' : String(value)
                      )
                    }
                    allowEmpty
                  />
                </div>
              )}

              {effects.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEffectRow(idx)}
                  aria-label="Remove"
                  className="text-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {effect.description && (
              <p className="type-small text-muted mt-1.5">
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
        >
          Add effect
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
          leftIcon={
            isEditing ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )
          }
        >
          {isEditing ? 'Save buff' : 'Add buff'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TemporaryBuffsManager() {
  const {
    character,
    addBuff,
    updateBuff,
    toggleBuff,
    deleteBuff,
    clearAllBuffs,
  } = useCharacterStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBuffId, setEditingBuffId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const pendingFocus = React.useRef<string | 'add' | null>(null);
  const buffs = character.temporaryBuffs ?? EMPTY_BUFFS;
  const activeCount = buffs.filter(buff => buff.isActive).length;
  const editingBuff = editingBuffId
    ? buffs.find(buff => buff.id === editingBuffId)
    : undefined;
  const formOpen = showAddForm || editingBuffId !== null;

  React.useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const row = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-buff-row]') ?? []
    ).find(element => element.dataset.buffRow === target);
    (
      row?.querySelector<HTMLElement>('[data-buff-action="edit"]') ??
      addButtonRef.current
    )?.focus({ preventScroll: true });
  }, [buffs]);

  const closeForm = () => {
    setShowAddForm(false);
    setEditingBuffId(null);
  };
  const handleDelete = (id: string) => {
    const index = buffs.findIndex(buff => buff.id === id);
    pendingFocus.current =
      buffs[index + 1]?.id ?? buffs[index - 1]?.id ?? 'add';
    deleteBuff(id);
  };
  const handleClear = () => {
    pendingFocus.current = 'add';
    clearAllBuffs();
  };
  const handleAdd = (
    buff: Omit<TemporaryBuff, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    addBuff(buff);
    closeForm();
  };
  const handleUpdate = (id: string, updates: Partial<TemporaryBuff>) => {
    updateBuff(id, updates);
    closeForm();
  };

  return (
    <Section
      heading={
        <Button
          variant="ghost"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed(value => !value)}
          className="type-subheading h-auto min-h-6 px-0 py-0 text-left pointer-coarse:min-h-11"
        >
          Temporary buffs
          {isCollapsed ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4" />
          )}
        </Button>
      }
      level={3}
      trailing={
        buffs.length > 0 ? (
          <Badge variant="neutral" size="sm">
            {activeCount}/{buffs.length}
          </Badge>
        ) : null
      }
    >
      {!isCollapsed && (
        <>
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {buffs.length > 0 && (
              <Button variant="danger" size="sm" onClick={handleClear}>
                Clear all
              </Button>
            )}
            <Button
              ref={addButtonRef}
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingBuffId(null);
                setShowAddForm(true);
              }}
            >
              Add buff
            </Button>
          </div>
          <div ref={listRef} role="list" className="divide-divider divide-y">
            {buffs.map(buff => (
              <BuffCard
                key={buff.id}
                buff={buff}
                onToggle={toggleBuff}
                onEdit={id => {
                  setShowAddForm(false);
                  setEditingBuffId(id);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {buffs.length === 0 && (
            <p className="type-body text-muted py-8 text-center">
              Add a buff from a spell, feature or item.
            </p>
          )}
        </>
      )}
      <Dialog
        open={formOpen}
        onOpenChange={open => {
          if (!open) closeForm();
        }}
      >
        <DialogContent size="lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingBuff ? 'Edit buff' : 'Add buff'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {formOpen && (
              <BuffForm
                key={editingBuff?.id ?? 'new'}
                initialBuff={editingBuff}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onCancel={closeForm}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
