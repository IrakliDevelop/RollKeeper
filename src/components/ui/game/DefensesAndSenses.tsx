'use client';

import React, { useState, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Eye,
  Plus,
  X,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/forms/select';
import { useCharacterStore } from '@/store/characterStore';
import { useSensesData } from '@/hooks/useSensesData';

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
  icon,
  items,
  options,
  colorClass,
  onAdd,
  onRemove,
  allowCustom = false,
}: {
  label: string;
  icon: React.ReactNode;
  items: string[];
  options: readonly string[];
  colorClass: string;
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  allowCustom?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');

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
          {icon}
          {label}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={isAdding ? <ChevronUp size={14} /> : <Plus size={14} />}
          onClick={() => {
            setIsAdding(!isAdding);
            setSearch('');
          }}
        >
          {isAdding ? 'Close' : 'Add'}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map(item => (
            <Badge
              key={item}
              variant="neutral"
              size="sm"
              className={colorClass}
            >
              {item}
              <button
                onClick={() => onRemove(item)}
                className="ml-1 inline-flex items-center rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                aria-label={`Remove ${item}`}
              >
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {items.length === 0 && !isAdding && (
        <p className="text-muted mb-2 text-xs italic">None</p>
      )}

      {isAdding && (
        <div className="bg-surface-secondary space-y-2 rounded-lg p-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
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
                className="text-body bg-surface hover:bg-surface-raised rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-(--border-divider)"
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
                  className="border-accent-blue-border text-accent-blue-text bg-accent-blue-bg rounded-md border px-2 py-1 text-xs"
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

function SensesSection() {
  const character = useCharacterStore(s => s.character);
  const addSense = useCharacterStore(s => s.addSense);
  const removeSense = useCharacterStore(s => s.removeSense);
  const { senses: senseOptions, loading } = useSensesData();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedSense, setSelectedSense] = useState('');
  const [customSenseName, setCustomSenseName] = useState('');
  const [senseRange, setSenseRange] = useState('60');
  const [senseSource, setSenseSource] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const characterSenses = character.senses || [];
  const uniqueSenseNames = [...new Set(senseOptions.map(s => s.name))];

  const resolvedSenseName =
    selectedSense === '__custom' ? customSenseName.trim() : selectedSense;

  const handleAddSense = useCallback(() => {
    if (!resolvedSenseName || !senseRange) return;
    const rangeNum = parseInt(senseRange, 10);
    if (isNaN(rangeNum) || rangeNum <= 0) return;

    addSense({
      name: resolvedSenseName,
      range: rangeNum,
      source: senseSource || undefined,
    });

    setSelectedSense('');
    setCustomSenseName('');
    setSenseRange('60');
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
          <Eye size={14} className="text-accent-blue-text" />
          Senses
        </h4>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={isAdding ? <ChevronUp size={14} /> : <Plus size={14} />}
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? 'Close' : 'Add'}
        </Button>
      </div>

      {characterSenses.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {characterSenses.map(sense => (
            <div
              key={sense.id}
              className="bg-surface-secondary rounded-lg px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-heading text-sm font-medium">
                    {sense.name}
                  </span>
                  <Badge variant="info" size="sm">
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
                      className="text-muted hover:text-body rounded p-1 transition-colors"
                      aria-label="Toggle description"
                    >
                      <Info size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => removeSense(sense.id)}
                    className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                    aria-label={`Remove ${sense.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {expandedId === sense.id && getDescription(sense.name) && (
                <p className="text-muted mt-2 border-t border-(--border-divider) pt-2 text-xs leading-relaxed">
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

      {isAdding && (
        <div className="bg-surface-secondary space-y-3 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              {loading ? (
                <Input
                  label="Sense Type"
                  placeholder="Loading..."
                  disabled
                  size="sm"
                />
              ) : selectedSense === '__custom' ? (
                <div>
                  <Input
                    label="Custom Sense Name"
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
                    className="text-accent-blue-text mt-1 text-xs hover:underline"
                  >
                    ← Back to list
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-heading mb-1.5 block text-sm font-medium">
                    Sense Type
                  </label>
                  <Select
                    value={selectedSense || undefined}
                    onValueChange={setSelectedSense}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select a sense..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSenseNames.map(name => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">
                Range (ft.)
              </label>
              <Input
                type="number"
                value={senseRange}
                onChange={e => setSenseRange(e.target.value)}
                placeholder="60"
                size="sm"
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">
              Source (optional)
            </label>
            <Input
              value={senseSource}
              onChange={e => setSenseSource(e.target.value)}
              placeholder="e.g., Racial, Class Feature, Spell"
              size="sm"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddSense}
            disabled={!resolvedSenseName || !senseRange}
          >
            Add Sense
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DefensesAndSenses() {
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

  const [isCollapsed, setIsCollapsed] = useState(false);

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
    <div className="border-divider bg-surface-raised rounded-lg border p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="border-divider text-heading flex items-center gap-2 text-lg font-bold">
          <ShieldCheck size={20} className="text-accent-emerald-text" />
          Defenses & Senses
          {totalCount > 0 && (
            <Badge variant="neutral" size="sm">
              {totalCount}
            </Badge>
          )}
        </h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted hover:text-body rounded p-1 transition-colors"
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <TagSelector
              label="Damage Resistances"
              icon={
                <ShieldAlert size={14} className="text-accent-amber-text" />
              }
              items={damageResistances}
              options={DAMAGE_TYPES}
              colorClass="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text"
              onAdd={addDamageResistance}
              onRemove={removeDamageResistance}
              allowCustom
            />
            <TagSelector
              label="Damage Immunities"
              icon={
                <ShieldCheck size={14} className="text-accent-emerald-text" />
              }
              items={damageImmunities}
              options={DAMAGE_TYPES}
              colorClass="border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text"
              onAdd={addDamageImmunity}
              onRemove={removeDamageImmunity}
              allowCustom
            />
            <TagSelector
              label="Condition Immunities"
              icon={<ShieldOff size={14} className="text-accent-purple-text" />}
              items={conditionImmunities}
              options={CONDITION_TYPES}
              colorClass="border-accent-purple-border bg-accent-purple-bg text-accent-purple-text"
              onAdd={addConditionImmunity}
              onRemove={removeConditionImmunity}
              allowCustom
            />
          </div>
          <div>
            <SensesSection />
          </div>
        </div>
      )}
    </div>
  );
}
