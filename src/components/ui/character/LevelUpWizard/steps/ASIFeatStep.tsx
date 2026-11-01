'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Plus, Minus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/forms/radio-group';
import { useFeatsData } from '@/hooks/useFeatsData';
import { parseAdditionalSpells } from '@/utils/additionalSpellsParser';
import GrantedSpellPicker from '@/components/ui/character/ExtendedFeatures/GrantedSpellPicker';
import type { CharacterAbilities, Spell } from '@/types/character';
import type { ProcessedSpell } from '@/types/spells';
import type { ASIChoice } from '../LevelUpWizard.types';
import type { ProcessedFeat } from '@/utils/featDataLoader';

interface ASIFeatStepProps {
  abilities: CharacterAbilities;
  asiChoice: ASIChoice | undefined;
  onChoiceChange: (choice: ASIChoice | undefined) => void;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
  newTotalLevel: number;
}

const ABILITY_NAMES: {
  key: keyof CharacterAbilities;
  label: string;
  name: string;
}[] = [
  { key: 'strength', label: 'STR', name: 'Strength' },
  { key: 'dexterity', label: 'DEX', name: 'Dexterity' },
  { key: 'constitution', label: 'CON', name: 'Constitution' },
  { key: 'intelligence', label: 'INT', name: 'Intelligence' },
  { key: 'wisdom', label: 'WIS', name: 'Wisdom' },
  { key: 'charisma', label: 'CHA', name: 'Charisma' },
];

function ASIPanel({
  abilities,
  asiChoice,
  onChoiceChange,
}: Pick<ASIFeatStepProps, 'abilities' | 'asiChoice' | 'onChoiceChange'>) {
  const increases = asiChoice?.type === 'asi' ? asiChoice.increases : [];
  const totalPoints = increases.reduce((sum, inc) => sum + inc.amount, 0);
  const remaining = 2 - totalPoints;

  const change = (ability: keyof CharacterAbilities, delta: number) => {
    const amount = increases.find(i => i.ability === ability)?.amount || 0;
    const nextAmount = amount + delta;
    if (
      nextAmount < 0 ||
      nextAmount > 2 ||
      abilities[ability] + nextAmount > 20 ||
      (delta > 0 && remaining <= 0)
    )
      return;
    const next = increases.filter(i => i.ability !== ability);
    if (nextAmount) next.push({ ability, amount: nextAmount });
    onChoiceChange({ type: 'asi', increases: next });
  };

  return (
    <div className="space-y-3">
      <p className="type-caption text-muted">
        Distribute 2 points (+2 to one, or +1 to two). Max 20 per ability.
      </p>
      <p className="type-ui text-heading">
        {remaining} point{remaining !== 1 ? 's' : ''} remaining
      </p>
      <ul className="divide-divider border-divider grid grid-cols-1 gap-x-6 border-t sm:grid-cols-2">
        {ABILITY_NAMES.map(({ key, label, name }) => {
          const base = abilities[key];
          const amount = increases.find(i => i.ability === key)?.amount || 0;
          return (
            <li
              key={key}
              className="border-divider flex min-w-0 items-center justify-between gap-2 border-b py-2"
            >
              <div className="min-w-0">
                <span className="type-ui text-heading font-semibold">
                  {label}
                </span>
                <span className="type-caption text-muted ml-2">
                  {base}
                  {amount > 0 && <> → {base + amount}</>}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Lower ${name}`}
                  disabled={amount === 0}
                  onClick={() => change(key, -1)}
                  className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  <Minus aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Raise ${name}`}
                  disabled={
                    remaining <= 0 || base + amount >= 20 || amount >= 2
                  }
                  onClick={() => change(key, 1)}
                  className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  <Plus aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeatPanel({
  asiChoice,
  onChoiceChange,
  allSpells,
  spellsLoading,
  newTotalLevel,
}: Omit<ASIFeatStepProps, 'abilities'>) {
  const { feats, loading: featsLoading } = useFeatsData();
  const [search, setSearch] = useState('');
  const [expandedFeatId, setExpandedFeatId] = useState<string | null>(null);
  const [spellPickerFeat, setSpellPickerFeat] = useState<ProcessedFeat | null>(
    null
  );
  const selectedFeat = asiChoice?.type === 'feat' ? asiChoice.feat : null;
  const deferredSearch = useDeferredValue(search);
  const eligible = useMemo(
    () =>
      feats.filter(
        f => !f.levelRequirement || f.levelRequirement <= newTotalLevel
      ),
    [feats, newTotalLevel]
  );
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return query
      ? eligible.filter(f => f.name.toLowerCase().includes(query))
      : eligible;
  }, [eligible, deferredSearch]);

  const handleSelectFeat = useCallback(
    (feat: ProcessedFeat) => {
      if (feat.grantsSpells && feat.additionalSpells) setSpellPickerFeat(feat);
      else onChoiceChange({ type: 'feat', feat, grantedSpells: [] });
    },
    [onChoiceChange]
  );

  const handleSpellsConfirmed = useCallback(
    (spells: Spell[]) => {
      if (!spellPickerFeat) return;
      onChoiceChange({
        type: 'feat',
        feat: spellPickerFeat,
        grantedSpells: spells,
      });
      setSpellPickerFeat(null);
    },
    [spellPickerFeat, onChoiceChange]
  );

  if (featsLoading)
    return (
      <p className="type-body text-muted py-4 text-center">Loading feats…</p>
    );
  const parsedSpells = spellPickerFeat?.additionalSpells
    ? parseAdditionalSpells(spellPickerFeat.additionalSpells)
    : null;

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="Search feats"
        aria-label="Search feats"
        leftIcon={<Search className="size-4" />}
      />
      <RadioGroup
        value={selectedFeat?.id ?? ''}
        onValueChange={value => {
          const feat = filtered.find(item => item.id === value);
          if (feat) handleSelectFeat(feat);
        }}
        aria-label="Feats"
        className="border-divider max-h-60 gap-0 overflow-y-auto border-t"
      >
        {filtered.map(feat => {
          const expanded = expandedFeatId === feat.id;
          return (
            <div key={feat.id} className="border-divider border-b">
              <div className="flex min-w-0 items-start gap-1">
                <RadioGroupItem
                  value={feat.id}
                  label={feat.name}
                  description={[
                    feat.source,
                    feat.prerequisites.length > 0
                      ? `Requires: ${feat.prerequisites.join(', ')}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  wrapperClassName="border-divider min-w-0 flex-1 px-2 py-2"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Show ${feat.name} details`}
                  aria-expanded={expanded}
                  onClick={() => setExpandedFeatId(expanded ? null : feat.id)}
                  className="shrink-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  {expanded ? (
                    <ChevronUp aria-hidden className="size-4" />
                  ) : (
                    <ChevronDown aria-hidden className="size-4" />
                  )}
                </Button>
              </div>
              {expanded && (
                <div className="type-caption text-body space-y-1 px-2 pb-3">
                  <div dangerouslySetInnerHTML={{ __html: feat.description }} />
                  {feat.abilityIncreases && <p>{feat.abilityIncreases}</p>}
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>
      {spellPickerFeat && parsedSpells && (
        <GrantedSpellPicker
          isOpen
          onClose={() => setSpellPickerFeat(null)}
          onConfirm={handleSpellsConfirmed}
          featName={spellPickerFeat.name}
          parsed={parsedSpells}
          allSpells={allSpells}
          spellsLoading={spellsLoading}
        />
      )}
    </div>
  );
}

export default function ASIFeatStep({
  abilities,
  asiChoice,
  onChoiceChange,
  allSpells,
  spellsLoading,
  newTotalLevel,
}: ASIFeatStepProps) {
  const [mode, setMode] = useState<'asi' | 'feat'>(asiChoice?.type || 'asi');
  const handleModeChange = (nextMode: 'asi' | 'feat') => {
    if (nextMode === mode) return;
    setMode(nextMode);
    onChoiceChange(undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-subheading text-heading">
          Ability Score Improvement
        </h3>
        <p className="type-body text-muted mt-1">
          Increase your ability scores or take a feat.
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Ability Score Improvement"
      >
        <Button
          type="button"
          variant="outline"
          selected={mode === 'asi'}
          aria-pressed={mode === 'asi'}
          onClick={() => handleModeChange('asi')}
        >
          Ability scores
        </Button>
        <Button
          type="button"
          variant="outline"
          selected={mode === 'feat'}
          aria-pressed={mode === 'feat'}
          onClick={() => handleModeChange('feat')}
        >
          Take a feat
        </Button>
      </div>
      {mode === 'asi' ? (
        <ASIPanel
          abilities={abilities}
          asiChoice={asiChoice}
          onChoiceChange={onChoiceChange}
        />
      ) : (
        <FeatPanel
          asiChoice={asiChoice}
          onChoiceChange={onChoiceChange}
          allSpells={allSpells}
          spellsLoading={spellsLoading}
          newTotalLevel={newTotalLevel}
        />
      )}
    </div>
  );
}
