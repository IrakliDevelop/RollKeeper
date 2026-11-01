'use client';

import React, {
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
  useEffect,
} from 'react';
import { Plus, X, Search, Info, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/forms/select';
import { useCharacterStore } from '@/store/characterStore';
import { useSensesData } from '@/hooks/useSensesData';
import type { CharacterSense } from '@/types/character';

const EMPTY_SENSES: CharacterSense[] = [];

const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder',
] as const;

const CONDITION_TYPES = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
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
] as const;

function TagSelector({
  label,
  items,
  options,
  editing,
  onAdd,
  onRemove,
  allowCustom = false,
}: {
  label: string;
  items: string[];
  options: readonly string[];
  editing: boolean;
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  allowCustom?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');
  const addRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfterRemoval = useRef<string | 'add' | null>(null);

  useEffect(() => {
    if (!editing) setIsAdding(false);
  }, [editing]);

  useLayoutEffect(() => {
    const target = focusAfterRemoval.current;
    if (!target) return;
    (target === 'add' ? addRef.current : removeRefs.current[target])?.focus();
    focusAfterRemoval.current = null;
  }, [items]);

  const handleRemove = (item: string) => {
    const index = items.indexOf(item);
    focusAfterRemoval.current = items[index + 1] ?? items[index - 1] ?? 'add';
    onRemove(item);
  };

  const filteredOptions = options.filter(
    opt =>
      !items.includes(opt) && opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (item: string) => {
    onAdd(item);
    setSearch('');
  };

  const handleCustomAdd = () => {
    const trimmed = search.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setSearch('');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-body flex items-center gap-1.5 text-sm font-semibold">
          {label}
        </h4>
        {editing && (
          <Button
            ref={addRef}
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={isAdding ? <ChevronUp size={14} /> : <Plus size={14} />}
            aria-label={`${isAdding ? 'Done' : 'Add'} ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
            onClick={() => {
              setIsAdding(!isAdding);
              setSearch('');
            }}
          >
            {isAdding ? 'Done' : 'Add'}
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 pointer-coarse:gap-x-3 pointer-coarse:gap-y-6">
          {items.map(item => (
            <Badge key={item} variant="neutral" size="sm">
              {item}
              {editing && (
                <button
                  ref={element => {
                    removeRefs.current[item] = element;
                  }}
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="hover:bg-surface-hover relative ml-1 inline-flex size-4 items-center justify-center rounded-sm transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11"
                  aria-label={`Remove ${item}`}
                >
                  <X size={10} />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {items.length === 0 && !isAdding && (
        <p className="text-muted mb-2 text-xs italic">None</p>
      )}

      {editing && isAdding && (
        <div className="space-y-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            aria-label={`Search ${label.toLowerCase()}`}
            leftIcon={<Search size={14} />}
            size="sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && allowCustom && search.trim()) {
                handleCustomAdd();
              }
            }}
          />
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
            {filteredOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleAdd(opt)}
                className="text-body bg-surface hover:bg-surface-raised hover:border-divider rounded-sm border border-transparent px-2 py-1 text-xs transition-colors pointer-coarse:min-h-11"
              >
                {opt}
              </button>
            ))}
            {allowCustom &&
              search.trim() &&
              !options.includes(search.trim()) &&
              !items.includes(search.trim()) && (
                <button
                  onClick={handleCustomAdd}
                  className="border-divider text-body bg-surface rounded-sm border px-2 py-1 text-xs pointer-coarse:min-h-11"
                >
                  + &quot;{search.trim()}&quot;
                </button>
              )}
            {filteredOptions.length === 0 && !allowCustom && (
              <p className="text-muted p-2 text-xs">
                {items.length === options.length
                  ? 'All options added'
                  : 'No matches'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SensesSection({ editing }: { editing: boolean }) {
  const character = useCharacterStore(s => s.character);
  const addSense = useCharacterStore(s => s.addSense);
  const removeSense = useCharacterStore(s => s.removeSense);
  const { senses: senseOptions, loading } = useSensesData();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedSense, setSelectedSense] = useState('');
  const [customSenseName, setCustomSenseName] = useState('');
  const [senseRange, setSenseRange] = useState<number | undefined>(60);
  const [senseSource, setSenseSource] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfterRemoval = useRef<string | 'add' | null>(null);

  useEffect(() => {
    if (!editing) setIsAdding(false);
  }, [editing]);

  const characterSenses = character.senses ?? EMPTY_SENSES;
  useLayoutEffect(() => {
    const target = focusAfterRemoval.current;
    if (!target) return;
    (target === 'add' ? addRef.current : removeRefs.current[target])?.focus();
    focusAfterRemoval.current = null;
  }, [characterSenses]);

  const handleRemove = (id: string) => {
    const index = characterSenses.findIndex(sense => sense.id === id);
    focusAfterRemoval.current =
      characterSenses[index + 1]?.id ?? characterSenses[index - 1]?.id ?? 'add';
    removeSense(id);
  };
  const uniqueSenseNames = [...new Set(senseOptions.map(s => s.name))];

  const resolvedSenseName =
    selectedSense === '__custom' ? customSenseName.trim() : selectedSense;

  const handleAddSense = useCallback(() => {
    if (!resolvedSenseName || !senseRange || senseRange <= 0) return;

    addSense({
      name: resolvedSenseName,
      range: senseRange,
      source: senseSource || undefined,
    });

    setSelectedSense('');
    setCustomSenseName('');
    setSenseRange(60);
    setSenseSource('');
    setIsAdding(false);
  }, [resolvedSenseName, senseRange, senseSource, addSense]);

  const getDescription = useCallback(
    (name: string): string | undefined => {
      const found = senseOptions.find(
        s => s.name.toLowerCase() === name.toLowerCase()
      );
      return found?.description;
    },
    [senseOptions]
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-body flex items-center gap-1.5 text-sm font-semibold">
          Senses
        </h4>
        {editing && (
          <Button
            ref={addRef}
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={isAdding ? <ChevronUp size={14} /> : <Plus size={14} />}
            aria-label={isAdding ? 'Done senses' : 'Add senses'}
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? 'Done' : 'Add'}
          </Button>
        )}
      </div>

      {characterSenses.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {characterSenses.map(sense => (
            <div key={sense.id} className="border-divider border-b px-1 py-2">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-heading text-sm font-medium">
                    {sense.name}
                  </span>
                  <Badge variant="neutral" size="sm">
                    {sense.range} ft.
                  </Badge>
                  {sense.source && (
                    <span className="text-muted text-xs">{sense.source}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {getDescription(sense.name) && (
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === sense.id ? null : sense.id)
                      }
                      className="text-muted hover:text-body rounded p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                      aria-label={`Show ${sense.name} description`}
                      aria-expanded={expandedId === sense.id}
                    >
                      <Info size={14} />
                    </button>
                  )}
                  {editing && (
                    <button
                      ref={element => {
                        removeRefs.current[sense.id] = element;
                      }}
                      type="button"
                      onClick={() => handleRemove(sense.id)}
                      className="text-muted hover:text-body rounded p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                      aria-label={`Remove ${sense.name}`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              {expandedId === sense.id && getDescription(sense.name) && (
                <p className="text-muted border-divider mt-2 border-t pt-2 text-xs leading-relaxed">
                  {getDescription(sense.name)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {characterSenses.length === 0 && !isAdding && (
        <p className="text-muted mb-2 text-xs italic">None</p>
      )}

      {editing && isAdding && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              {loading ? (
                <Input
                  label="Sense type"
                  placeholder="Loading…"
                  disabled
                  size="sm"
                />
              ) : selectedSense === '__custom' ? (
                <div>
                  <Input
                    label="Custom sense name"
                    value={customSenseName}
                    onChange={e => setCustomSenseName(e.target.value)}
                    placeholder="e.g., See Invisibility"
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSense('');
                      setCustomSenseName('');
                    }}
                    className="text-body mt-1 text-xs hover:underline pointer-coarse:min-h-11"
                  >
                    ← Back to list
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-heading mb-1.5 block text-sm font-medium">
                    Sense type
                  </label>
                  <Select
                    value={selectedSense || undefined}
                    onValueChange={setSelectedSense}
                  >
                    <SelectTrigger size="sm" aria-label="Sense type">
                      <SelectValue placeholder="Select a sense…" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSenseNames.map(name => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <NumberInput
                label="Range (ft.)"
                value={senseRange}
                onChange={setSenseRange}
                allowEmpty
                placeholder="60"
                size="sm"
                min={0}
              />
            </div>
          </div>
          <div>
            <Input
              label="Source (optional)"
              value={senseSource}
              onChange={e => setSenseSource(e.target.value)}
              placeholder="e.g., Racial, Class Feature, Spell"
              size="sm"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddSense}
            disabled={!resolvedSenseName || !senseRange || senseRange <= 0}
          >
            Add sense
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DefensesAndSenses({
  editing = true,
}: {
  editing?: boolean;
}) {
  const character = useCharacterStore(s => s.character);
  const addDamageImmunity = useCharacterStore(s => s.addDamageImmunity);
  const removeDamageImmunity = useCharacterStore(s => s.removeDamageImmunity);
  const addDamageResistance = useCharacterStore(s => s.addDamageResistance);
  const removeDamageResistance = useCharacterStore(
    s => s.removeDamageResistance
  );
  const addConditionImmunity = useCharacterStore(s => s.addConditionImmunity);
  const removeConditionImmunity = useCharacterStore(
    s => s.removeConditionImmunity
  );

  const damageImmunities = character.damageImmunities || [];
  const damageResistances = character.damageResistances || [];
  const conditionImmunities = character.conditionImmunities || [];
  const senses = character.senses || [];
  const totalCount =
    damageImmunities.length +
    damageResistances.length +
    conditionImmunities.length +
    senses.length;

  return (
    <Section
      heading="Defenses and senses"
      level={3}
      collapsible="combat-defenses-senses"
      contentClassName="space-y-6"
      trailing={
        totalCount > 0 ? (
          <Badge variant="neutral" size="sm">
            {totalCount}
          </Badge>
        ) : null
      }
    >
      <TagSelector
        label="Damage resistances"
        items={damageResistances}
        options={DAMAGE_TYPES}
        editing={editing}
        onAdd={addDamageResistance}
        onRemove={removeDamageResistance}
        allowCustom
      />
      <TagSelector
        label="Damage immunities"
        items={damageImmunities}
        options={DAMAGE_TYPES}
        editing={editing}
        onAdd={addDamageImmunity}
        onRemove={removeDamageImmunity}
        allowCustom
      />
      <TagSelector
        label="Condition immunities"
        items={conditionImmunities}
        options={CONDITION_TYPES}
        editing={editing}
        onAdd={addConditionImmunity}
        onRemove={removeConditionImmunity}
        allowCustom
      />
      <SensesSection editing={editing} />
    </Section>
  );
}
