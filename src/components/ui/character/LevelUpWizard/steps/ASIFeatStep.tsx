'use client';

import { useState, useCallback } from 'react';
import { Plus, Minus, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui/forms/input';
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
  onChoiceChange: (choice: ASIChoice) => void;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
}

const ABILITY_NAMES: { key: keyof CharacterAbilities; label: string }[] = [
  { key: 'strength', label: 'STR' },
  { key: 'dexterity', label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'WIS' },
  { key: 'charisma', label: 'CHA' },
];

function ASIPanel({
  abilities,
  asiChoice,
  onChoiceChange,
}: {
  abilities: CharacterAbilities;
  asiChoice: ASIChoice | undefined;
  onChoiceChange: (choice: ASIChoice) => void;
}) {
  const increases = asiChoice?.type === 'asi' ? asiChoice.increases : [];
  const totalPoints = increases.reduce((sum, inc) => sum + inc.amount, 0);
  const remaining = 2 - totalPoints;

  const handleIncrement = (ability: string) => {
    if (remaining <= 0) return;
    const current = abilities[ability as keyof CharacterAbilities];
    const currentIncrease =
      increases.find(i => i.ability === ability)?.amount || 0;
    if (current + currentIncrease >= 20) return;
    if (currentIncrease >= 2) return;

    const updated = increases.filter(i => i.ability !== ability);
    updated.push({ ability, amount: currentIncrease + 1 });
    onChoiceChange({ type: 'asi', increases: updated });
  };

  const handleDecrement = (ability: string) => {
    const currentIncrease =
      increases.find(i => i.ability === ability)?.amount || 0;
    if (currentIncrease <= 0) return;

    const updated = increases.filter(i => i.ability !== ability);
    if (currentIncrease > 1) {
      updated.push({ ability, amount: currentIncrease - 1 });
    }
    onChoiceChange({ type: 'asi', increases: updated });
  };

  return (
    <div className="space-y-3">
      <p className="text-muted text-center text-xs">
        Distribute 2 points (+2 to one, or +1 to two). Max 20 per ability.
      </p>
      <p className="text-accent-blue-text text-center text-sm font-semibold">
        {remaining} point{remaining !== 1 ? 's' : ''} remaining
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ABILITY_NAMES.map(({ key, label }) => {
          const base = abilities[key];
          const inc = increases.find(i => i.ability === key)?.amount || 0;
          const newVal = base + inc;
          const atMax = newVal >= 20;

          return (
            <div
              key={key}
              className={cn(
                'border-divider bg-surface-raised flex items-center justify-between rounded-lg border px-3 py-2',
                inc > 0 && 'border-accent-blue-border bg-accent-blue-bg'
              )}
            >
              <div>
                <span className="text-heading text-xs font-bold">{label}</span>
                <span className="text-muted ml-1 text-xs">
                  {base}
                  {inc > 0 && (
                    <span className="text-accent-blue-text"> → {newVal}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDecrement(key)}
                  disabled={inc === 0}
                  className="text-muted hover:text-heading disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => handleIncrement(key)}
                  disabled={remaining <= 0 || atMax || inc >= 2}
                  className="text-muted hover:text-heading disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatPanel({
  asiChoice,
  onChoiceChange,
  allSpells,
  spellsLoading,
}: {
  asiChoice: ASIChoice | undefined;
  onChoiceChange: (choice: ASIChoice) => void;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
}) {
  const { feats, loading: featsLoading } = useFeatsData();
  const [search, setSearch] = useState('');
  const [spellPickerFeat, setSpellPickerFeat] = useState<ProcessedFeat | null>(
    null
  );

  const selectedFeat = asiChoice?.type === 'feat' ? asiChoice.feat : null;

  const filtered = search.trim()
    ? feats.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : feats;

  const handleSelectFeat = useCallback(
    (feat: ProcessedFeat) => {
      if (feat.grantsSpells && feat.additionalSpells) {
        setSpellPickerFeat(feat);
      } else {
        onChoiceChange({ type: 'feat', feat, grantedSpells: [] });
      }
    },
    [onChoiceChange]
  );

  const handleSpellsConfirmed = useCallback(
    (spells: Spell[]) => {
      if (spellPickerFeat) {
        onChoiceChange({
          type: 'feat',
          feat: spellPickerFeat,
          grantedSpells: spells,
        });
        setSpellPickerFeat(null);
      }
    },
    [spellPickerFeat, onChoiceChange]
  );

  if (featsLoading) {
    return (
      <p className="text-muted py-4 text-center text-sm">Loading feats...</p>
    );
  }

  const parsedSpells = spellPickerFeat?.additionalSpells
    ? parseAdditionalSpells(spellPickerFeat.additionalSpells)
    : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="text-muted absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search feats..."
          className="pl-8"
        />
      </div>

      <div className="max-h-60 space-y-1 overflow-y-auto">
        {filtered.slice(0, 50).map(feat => {
          const isSelected = selectedFeat?.id === feat.id;
          return (
            <button
              key={feat.id}
              onClick={() => handleSelectFeat(feat)}
              className={cn(
                'flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-all',
                isSelected
                  ? 'border-accent-purple-border bg-accent-purple-bg'
                  : 'border-divider bg-surface-raised hover:bg-surface-secondary'
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-accent-purple-text' : 'text-heading'
                )}
              >
                {feat.name}
              </span>
              {feat.prerequisites.length > 0 && (
                <span className="text-faint text-xs">
                  Requires: {feat.prerequisites.join(', ')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {spellPickerFeat && parsedSpells && (
        <GrantedSpellPicker
          isOpen={true}
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
}: ASIFeatStepProps) {
  const [mode, setMode] = useState<'asi' | 'feat'>(asiChoice?.type || 'asi');

  const handleModeChange = (newMode: 'asi' | 'feat') => {
    setMode(newMode);
    if (newMode === 'asi' && asiChoice?.type !== 'asi') {
      onChoiceChange({ type: 'asi', increases: [] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">
          Ability Score Improvement
        </h3>
        <p className="text-muted mt-1 text-sm">
          Increase your ability scores or take a feat.
        </p>
      </div>

      <div className="border-divider flex overflow-hidden rounded-lg border">
        <button
          onClick={() => handleModeChange('asi')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            mode === 'asi'
              ? 'bg-accent-blue-bg text-accent-blue-text'
              : 'bg-surface-raised text-muted hover:text-heading'
          )}
        >
          Ability Scores
        </button>
        <button
          onClick={() => handleModeChange('feat')}
          className={cn(
            'border-divider flex-1 border-l px-4 py-2 text-sm font-medium transition-colors',
            mode === 'feat'
              ? 'bg-accent-purple-bg text-accent-purple-text'
              : 'bg-surface-raised text-muted hover:text-heading'
          )}
        >
          Take a Feat
        </button>
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
        />
      )}
    </div>
  );
}
