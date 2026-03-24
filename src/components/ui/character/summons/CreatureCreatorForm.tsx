'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import type { SavedCreature } from '@/types/summon';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { SelectField, SelectItem } from '@/components/ui/forms/select';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const CREATURE_TYPES = [
  'Aberration',
  'Beast',
  'Celestial',
  'Construct',
  'Dragon',
  'Elemental',
  'Fey',
  'Fiend',
  'Giant',
  'Humanoid',
  'Monstrosity',
  'Ooze',
  'Plant',
  'Undead',
];

interface NamedText {
  name: string;
  text: string;
}

interface CreatureCreatorFormProps {
  /** Pre-fill with an existing creature for editing */
  initialCreature?: SavedCreature;
  onSave: (creature: SavedCreature) => void;
  onCancel: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function CreatureCreatorForm({
  initialCreature,
  onSave,
  onCancel,
}: CreatureCreatorFormProps) {
  const isEditing = !!initialCreature;

  // Core
  const [name, setName] = useState(initialCreature?.name ?? '');
  const [size, setSize] = useState(initialCreature?.size ?? 'Tiny');
  const [creatureType, setCreatureType] = useState(
    initialCreature?.type ?? 'Beast'
  );
  const [alignment, setAlignment] = useState(
    initialCreature?.alignment ?? 'Unaligned'
  );
  const [ac, setAc] = useState(initialCreature?.ac ?? 10);
  const [hp, setHp] = useState(initialCreature?.hp ?? 1);
  const [hpFormula, setHpFormula] = useState(initialCreature?.hpFormula ?? '');
  const [speed, setSpeed] = useState(initialCreature?.speed ?? '30 ft.');

  // Ability scores
  const [str, setStr] = useState(initialCreature?.str ?? 10);
  const [dex, setDex] = useState(initialCreature?.dex ?? 10);
  const [con, setCon] = useState(initialCreature?.con ?? 10);
  const [int, setInt] = useState(initialCreature?.int ?? 10);
  const [wis, setWis] = useState(initialCreature?.wis ?? 10);
  const [cha, setCha] = useState(initialCreature?.cha ?? 10);

  // Optional details
  const [saves, setSaves] = useState(initialCreature?.saves ?? '');
  const [skills, setSkills] = useState(initialCreature?.skills ?? '');
  const [resistances, setResistances] = useState(
    initialCreature?.resistances ?? ''
  );
  const [immunities, setImmunities] = useState(
    initialCreature?.immunities ?? ''
  );
  const [vulnerabilities, setVulnerabilities] = useState(
    initialCreature?.vulnerabilities ?? ''
  );
  const [conditionImmunities, setConditionImmunities] = useState(
    initialCreature?.conditionImmunities?.join(', ') ?? ''
  );
  const [senses, setSenses] = useState(initialCreature?.senses ?? '');
  const [languages, setLanguages] = useState(initialCreature?.languages ?? '');
  const [cr, setCr] = useState(initialCreature?.cr ?? '0');

  // Abilities
  const [traits, setTraits] = useState<NamedText[]>(
    initialCreature?.traits ?? []
  );
  const [actions, setActions] = useState<NamedText[]>(
    initialCreature?.actions ?? []
  );
  const [reactions, setReactions] = useState<NamedText[]>(
    initialCreature?.reactions ?? []
  );
  const [bonusActions, setBonusActions] = useState<NamedText[]>(
    initialCreature?.bonusActions ?? []
  );
  const [lairActions, setLairActions] = useState<NamedText[]>(
    initialCreature?.lairActions ?? []
  );

  const handleSubmit = () => {
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const creature: SavedCreature = {
      id: initialCreature?.id ?? generateId(),
      name: name.trim(),
      size,
      type: creatureType,
      alignment,
      ac,
      hp,
      hpFormula: hpFormula || undefined,
      speed,
      str,
      dex,
      con,
      int,
      wis,
      cha,
      saves: saves || undefined,
      skills: skills || undefined,
      resistances: resistances || undefined,
      immunities: immunities || undefined,
      vulnerabilities: vulnerabilities || undefined,
      conditionImmunities: conditionImmunities
        ? conditionImmunities
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : undefined,
      senses: senses || undefined,
      languages: languages || undefined,
      cr: cr || undefined,
      passivePerception: 10 + Math.floor((wis - 10) / 2),
      traits: traits.length > 0 ? traits : undefined,
      actions: actions.length > 0 ? actions : undefined,
      reactions: reactions.length > 0 ? reactions : undefined,
      bonusActions: bonusActions.length > 0 ? bonusActions : undefined,
      lairActions: lairActions.length > 0 ? lairActions : undefined,
      createdAt: initialCreature?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(creature);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onCancel}
        className="text-muted hover:text-body flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {/* Name & Core Info */}
      <div className="space-y-3">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          label="Creature Name"
          placeholder="e.g. Shadow Sprite"
          required
          autoFocus
        />

        <div className="grid grid-cols-3 gap-2">
          <SelectField label="Size" value={size} onValueChange={setSize}>
            {SIZES.map(s => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectField>

          <SelectField
            label="Type"
            value={creatureType}
            onValueChange={setCreatureType}
          >
            {CREATURE_TYPES.map(t => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectField>

          <Input
            value={alignment}
            onChange={e => setAlignment(e.target.value)}
            label="Alignment"
            placeholder="Unaligned"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            value={ac}
            onChange={e => setAc(parseInt(e.target.value) || 0)}
            label="AC"
            min={0}
          />
          <Input
            type="number"
            value={hp}
            onChange={e => setHp(parseInt(e.target.value) || 1)}
            label="HP"
            min={1}
          />
          <Input
            value={hpFormula}
            onChange={e => setHpFormula(e.target.value)}
            label="HP Formula"
            placeholder="1d4+1"
          />
        </div>

        <Input
          value={speed}
          onChange={e => setSpeed(e.target.value)}
          label="Speed"
          placeholder="30 ft., fly 60 ft."
        />
      </div>

      {/* Ability Scores */}
      <div>
        <label className="text-heading mb-1.5 block text-sm font-medium">
          Ability Scores
        </label>
        <div className="grid grid-cols-6 gap-2">
          {(
            [
              ['STR', str, setStr],
              ['DEX', dex, setDex],
              ['CON', con, setCon],
              ['INT', int, setInt],
              ['WIS', wis, setWis],
              ['CHA', cha, setCha],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label} className="text-center">
              <span className="text-muted block text-[10px] font-medium uppercase">
                {label}
              </span>
              <input
                type="number"
                value={value}
                onChange={e =>
                  (setter as React.Dispatch<React.SetStateAction<number>>)(
                    parseInt(e.target.value) || 0
                  )
                }
                min={1}
                max={30}
                className="bg-surface border-divider text-heading w-full rounded border px-1 py-1 text-center text-sm"
              />
              <span className="text-muted text-[10px]">
                {value >= 10 ? '+' : ''}
                {Math.floor((value - 10) / 2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Details */}
      <div className="space-y-2">
        <label className="text-heading block text-sm font-medium">
          Details (optional)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={saves}
            onChange={e => setSaves(e.target.value)}
            label="Saving Throws"
            placeholder="Dex +4, Wis +2"
          />
          <Input
            value={skills}
            onChange={e => setSkills(e.target.value)}
            label="Skills"
            placeholder="Perception +4, Stealth +6"
          />
          <Input
            value={resistances}
            onChange={e => setResistances(e.target.value)}
            label="Resistances"
            placeholder="fire, cold"
          />
          <Input
            value={immunities}
            onChange={e => setImmunities(e.target.value)}
            label="Immunities"
            placeholder="poison"
          />
          <Input
            value={vulnerabilities}
            onChange={e => setVulnerabilities(e.target.value)}
            label="Vulnerabilities"
            placeholder="radiant"
          />
          <Input
            value={conditionImmunities}
            onChange={e => setConditionImmunities(e.target.value)}
            label="Condition Immunities"
            placeholder="poisoned, charmed"
          />
          <Input
            value={senses}
            onChange={e => setSenses(e.target.value)}
            label="Senses"
            placeholder="Darkvision 60 ft."
          />
          <Input
            value={languages}
            onChange={e => setLanguages(e.target.value)}
            label="Languages"
            placeholder="Common, Sylvan"
          />
        </div>
        <div className="w-24">
          <Input
            value={cr}
            onChange={e => setCr(e.target.value)}
            label="CR"
            placeholder="0"
          />
        </div>
      </div>

      {/* Traits, Actions, Reactions */}
      <AbilityListEditor label="Traits" items={traits} onChange={setTraits} />
      <AbilityListEditor
        label="Actions"
        items={actions}
        onChange={setActions}
      />
      <AbilityListEditor
        label="Bonus Actions"
        items={bonusActions}
        onChange={setBonusActions}
      />
      <AbilityListEditor
        label="Reactions"
        items={reactions}
        onChange={setReactions}
      />
      <AbilityListEditor
        label="Lair Actions"
        items={lairActions}
        onChange={setLairActions}
      />

      {/* Submit */}
      <Button
        variant="primary"
        onClick={handleSubmit}
        fullWidth
        disabled={!name.trim()}
      >
        {isEditing ? 'Save Changes' : 'Save Creature'}
      </Button>
    </div>
  );
}

/** Editable list of name+text entries (traits, actions, reactions) */
function AbilityListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: NamedText[];
  onChange: (items: NamedText[]) => void;
}) {
  const handleAdd = () => {
    onChange([...items, { name: '', text: '' }]);
  };

  const handleUpdate = (
    index: number,
    field: 'name' | 'text',
    value: string
  ) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-heading text-sm font-medium">{label}</label>
        <button
          onClick={handleAdd}
          className="text-accent-purple-text hover:text-accent-purple-text flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-faint text-xs">No {label.toLowerCase()} added</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="border-divider bg-surface-raised rounded-lg border p-2"
            >
              <div className="mb-1 flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={e => handleUpdate(index, 'name', e.target.value)}
                  placeholder={`${label.slice(0, -1)} name`}
                  className="flex-1"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="text-muted hover:text-accent-red-text p-1 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <CompactRichTextEditor
                content={item.text}
                onChange={value => handleUpdate(index, 'text', value)}
                placeholder="Description..."
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
