'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, Plus, BookOpen, Wand2, Trash2 } from 'lucide-react';
import type { Spell } from '@/types/character';
import type { Summon, SavedCreature } from '@/types/summon';
import type { ProcessedMonster } from '@/types/bestiary';
import { searchMonsters } from '@/utils/apiClient';
import {
  getSummonType,
  isSpiritSummonSpell,
  getSpiritScaling,
  createFamiliarFromMonster,
  createSummonFromMonster,
  createSpiritSummon,
  createFamiliarFromSavedCreature,
  createSummonFromSavedCreature,
} from '@/utils/summonConverter';
import { useCharacterStore } from '@/store/characterStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog-new';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { HPBar } from '@/components/shared/combat/HPBar';
import { CreatureCreatorForm } from './CreatureCreatorForm';

type PickerTab = 'bestiary' | 'saved';

const EMPTY_SAVED_CREATURES: SavedCreature[] = [];

interface SummonCreaturePickerModalProps {
  open: boolean;
  onClose: () => void;
  spell: Spell;
  castAtLevel: number;
  onSummonCreated: (summon: Summon) => void;
  spellAttackBonus?: number | null;
  spellcastingAbilityMod?: number | null;
}

export function SummonCreaturePickerModal({
  open,
  onClose,
  spell,
  castAtLevel,
  onSummonCreated,
  spellAttackBonus,
  spellcastingAbilityMod,
}: SummonCreaturePickerModalProps) {
  const summonType = getSummonType(spell);
  const isSpirit = isSpiritSummonSpell(spell.name);
  const spiritScaling = getSpiritScaling(spell.name);

  const savedCreatures = useCharacterStore(
    state => state.character.savedCreatures ?? EMPTY_SAVED_CREATURES
  );
  const addSavedCreature = useCharacterStore(state => state.addSavedCreature);
  const updateSavedCreature = useCharacterStore(
    state => state.updateSavedCreature
  );
  const removeSavedCreature = useCharacterStore(
    state => state.removeSavedCreature
  );

  const [activeTab, setActiveTab] = useState<PickerTab>('bestiary');
  const [searchQuery, setSearchQuery] = useState('');
  const [monsterResults, setMonsterResults] = useState<ProcessedMonster[]>([]);
  const [selectedMonster, setSelectedMonster] =
    useState<ProcessedMonster | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Saved creatures state
  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [editingCreature, setEditingCreature] = useState<SavedCreature | null>(
    null
  );
  const [selectedSavedCreature, setSelectedSavedCreature] =
    useState<SavedCreature | null>(null);
  const [savedCustomName, setSavedCustomName] = useState('');

  const spiritPreview =
    isSpirit && spiritScaling
      ? {
          ac: spiritScaling.baseAC + castAtLevel,
          hp:
            spiritScaling.baseHP +
            spiritScaling.hpPerLevel * (castAtLevel - spiritScaling.baseLevel),
          name: spiritScaling.spiritName,
          subtypes: spiritScaling.subtypes,
        }
      : null;

  const doSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setMonsterResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const result = await searchMonsters(
          query,
          {
            ...(summonType === 'familiar'
              ? { types: ['beast'], crRange: { min: 0, max: 0 } }
              : {}),
          },
          20
        );
        setMonsterResults(result.monsters);
      } catch {
        setMonsterResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [summonType]
  );

  useEffect(() => {
    const timeout = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, doSearch]);

  useEffect(() => {
    if (open) {
      setActiveTab(isSpirit ? 'bestiary' : 'bestiary');
      setSearchQuery('');
      setMonsterResults([]);
      setSelectedMonster(null);
      setSelectedSubtype(null);
      setCustomName('');
      setShowCreatorForm(false);
      setEditingCreature(null);
      setSelectedSavedCreature(null);
      setSavedCustomName('');
    }
  }, [open, isSpirit]);

  const handleConfirmSpirit = async () => {
    if (!spiritScaling || isCreating) return;
    setIsCreating(true);
    try {
      const summon = await createSpiritSummon(
        spell.name,
        castAtLevel,
        selectedSubtype ?? undefined,
        spell.id,
        spellAttackBonus,
        spellcastingAbilityMod,
        spell.source
      );
      if (summon) {
        if (customName) {
          summon.customName = customName;
          summon.entity.name = customName;
        }
        onSummonCreated(summon);
        onClose();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmMonster = () => {
    if (!selectedMonster) return;

    let summon: Summon;
    if (summonType === 'familiar') {
      summon = createFamiliarFromMonster(
        selectedMonster,
        spell.id,
        customName || undefined
      );
    } else {
      summon = createSummonFromMonster(
        selectedMonster,
        spell.name,
        spell.id,
        castAtLevel,
        spell.concentration ?? false,
        spell.duration || '1 hour',
        customName || undefined
      );
    }
    onSummonCreated(summon);
    onClose();
  };

  const handleConfirmSavedCreature = () => {
    if (!selectedSavedCreature) return;

    let summon: Summon;
    if (summonType === 'familiar') {
      summon = createFamiliarFromSavedCreature(
        selectedSavedCreature,
        spell.id,
        savedCustomName || undefined
      );
    } else {
      summon = createSummonFromSavedCreature(
        selectedSavedCreature,
        spell.name,
        spell.id,
        castAtLevel,
        spell.concentration ?? false,
        spell.duration || '1 hour',
        savedCustomName || undefined
      );
    }
    onSummonCreated(summon);
    onClose();
  };

  const handleSaveCreature = (creature: SavedCreature) => {
    if (editingCreature) {
      updateSavedCreature(creature.id, creature);
    } else {
      addSavedCreature(creature);
    }
    setShowCreatorForm(false);
    setEditingCreature(null);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {showCreatorForm
              ? editingCreature
                ? `Edit: ${editingCreature.name}`
                : 'Create Custom Creature'
              : summonType === 'familiar'
                ? 'Choose Your Familiar'
                : `Summon Creature — ${spell.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[340px]">
          {/* Creator form mode */}
          {showCreatorForm ? (
            <CreatureCreatorForm
              initialCreature={editingCreature ?? undefined}
              onSave={handleSaveCreature}
              onCancel={() => {
                setShowCreatorForm(false);
                setEditingCreature(null);
              }}
            />
          ) : (
            <>
              {/* Tab switcher — only for non-spirit summons */}
              {!isSpirit && (
                <div className="border-divider mb-3 flex gap-1 border-b pb-2">
                  <button
                    onClick={() => {
                      setActiveTab('bestiary');
                      setSelectedSavedCreature(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === 'bestiary'
                        ? 'bg-accent-purple-bg text-accent-purple-text'
                        : 'text-muted hover:text-body hover:bg-surface-secondary'
                    }`}
                  >
                    <BookOpen size={14} />
                    Bestiary
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('saved');
                      setSelectedMonster(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === 'saved'
                        ? 'bg-accent-purple-bg text-accent-purple-text'
                        : 'text-muted hover:text-body hover:bg-surface-secondary'
                    }`}
                  >
                    <Wand2 size={14} />
                    My Creatures
                    {savedCreatures.length > 0 && (
                      <Badge variant="neutral">{savedCreatures.length}</Badge>
                    )}
                  </button>
                </div>
              )}

              {/* Spirit summon flow (unchanged) */}
              {isSpirit && spiritPreview ? (
                <SpiritSummonPanel
                  spiritPreview={spiritPreview}
                  castAtLevel={castAtLevel}
                  selectedSubtype={selectedSubtype}
                  onSelectSubtype={setSelectedSubtype}
                  customName={customName}
                  onCustomNameChange={setCustomName}
                  onConfirm={handleConfirmSpirit}
                  isCreating={isCreating}
                />
              ) : activeTab === 'bestiary' ? (
                <BestiarySearchPanel
                  summonType={summonType}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  monsterResults={monsterResults}
                  isSearching={isSearching}
                  selectedMonster={selectedMonster}
                  onSelectMonster={setSelectedMonster}
                  customName={customName}
                  onCustomNameChange={setCustomName}
                  onConfirm={handleConfirmMonster}
                />
              ) : (
                <SavedCreaturesPanel
                  savedCreatures={savedCreatures}
                  selectedCreature={selectedSavedCreature}
                  onSelectCreature={setSelectedSavedCreature}
                  customName={savedCustomName}
                  onCustomNameChange={setSavedCustomName}
                  onConfirm={handleConfirmSavedCreature}
                  onCreateNew={() => {
                    setEditingCreature(null);
                    setShowCreatorForm(true);
                  }}
                  onEdit={creature => {
                    setEditingCreature(creature);
                    setShowCreatorForm(true);
                  }}
                  onDelete={removeSavedCreature}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Sub-panels ---------- */

function SpiritSummonPanel({
  spiritPreview,
  castAtLevel,
  selectedSubtype,
  onSelectSubtype,
  customName,
  onCustomNameChange,
  onConfirm,
  isCreating,
}: {
  spiritPreview: { ac: number; hp: number; name: string; subtypes?: string[] };
  castAtLevel: number;
  selectedSubtype: string | null;
  onSelectSubtype: (s: string) => void;
  customName: string;
  onCustomNameChange: (n: string) => void;
  onConfirm: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="border-accent-purple-border-strong bg-surface-raised rounded-lg border-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-heading font-semibold">{spiritPreview.name}</h4>
          <Badge variant="info">Level {castAtLevel}</Badge>
        </div>
        <div className="flex gap-4 text-xs">
          <span>
            <span className="text-muted">AC</span>{' '}
            <span className="text-heading font-medium">{spiritPreview.ac}</span>
          </span>
          <span>
            <span className="text-muted">HP</span>{' '}
            <span className="text-heading font-medium">{spiritPreview.hp}</span>
          </span>
        </div>
        <HPBar
          current={spiritPreview.hp}
          max={spiritPreview.hp}
          size="sm"
          className="mt-2"
        />
      </div>

      {spiritPreview.subtypes && spiritPreview.subtypes.length > 0 && (
        <div>
          <label className="text-heading mb-1.5 block text-sm font-medium">
            Choose Form
          </label>
          <div className="flex flex-wrap gap-2">
            {spiritPreview.subtypes.map(st => (
              <button
                key={st}
                onClick={() => onSelectSubtype(st)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  selectedSubtype === st
                    ? 'border-accent-purple-border bg-accent-purple-bg text-accent-purple-text'
                    : 'border-divider bg-surface text-body hover:bg-surface-secondary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}

      <Input
        value={customName}
        onChange={e => onCustomNameChange(e.target.value)}
        placeholder={spiritPreview.name}
        label="Custom Name (optional)"
      />

      <Button
        variant="primary"
        onClick={onConfirm}
        leftIcon={<Plus size={16} />}
        fullWidth
        disabled={isCreating}
      >
        {isCreating
          ? 'Summoning...'
          : `Summon ${customName || spiritPreview.name}`}
      </Button>
    </div>
  );
}

function BestiarySearchPanel({
  summonType,
  searchQuery,
  onSearchChange,
  monsterResults,
  isSearching,
  selectedMonster,
  onSelectMonster,
  customName,
  onCustomNameChange,
  onConfirm,
}: {
  summonType: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  monsterResults: ProcessedMonster[];
  isSearching: boolean;
  selectedMonster: ProcessedMonster | null;
  onSelectMonster: (m: ProcessedMonster | null) => void;
  customName: string;
  onCustomNameChange: (n: string) => void;
  onConfirm: () => void;
}) {
  if (selectedMonster) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => onSelectMonster(null)}
          className="text-muted hover:text-body flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Back to search
        </button>

        <div className="border-accent-purple-border-strong bg-surface-raised rounded-lg border-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-heading font-semibold">
              {selectedMonster.name}
            </h4>
            <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
              CR {selectedMonster.cr}
            </span>
          </div>
          <p className="text-muted mb-3 text-xs">
            {selectedMonster.size.join('/')}{' '}
            {typeof selectedMonster.type === 'string'
              ? selectedMonster.type
              : selectedMonster.type.type}
            {selectedMonster.alignment ? `, ${selectedMonster.alignment}` : ''}
          </p>
          <div className="flex gap-4 text-xs">
            <span>
              <span className="font-medium">{selectedMonster.hpAverage}</span>{' '}
              HP
            </span>
            <span>
              AC <span className="font-medium">{selectedMonster.acValue}</span>
            </span>
            <span>{selectedMonster.speed}</span>
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1 text-center">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(
              ability => (
                <div key={ability}>
                  <span className="text-muted block text-[9px] font-medium uppercase">
                    {ability}
                  </span>
                  <span className="text-body text-xs">
                    {selectedMonster[ability]}
                  </span>
                </div>
              )
            )}
          </div>

          <p className="text-faint mt-2 text-[10px]">
            HP formula: {selectedMonster.hpFormula}
            {selectedMonster.traits &&
              selectedMonster.traits.length > 0 &&
              ` · ${selectedMonster.traits.length} trait(s)`}
            {selectedMonster.actions &&
              selectedMonster.actions.length > 0 &&
              ` · ${selectedMonster.actions.length} action(s)`}
          </p>
        </div>

        <Input
          value={customName}
          onChange={e => onCustomNameChange(e.target.value)}
          placeholder={selectedMonster.name}
          label="Custom Name (optional)"
        />

        <Button
          variant="primary"
          onClick={onConfirm}
          leftIcon={<Plus size={16} />}
          fullWidth
        >
          Summon {customName || selectedMonster.name}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Input
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={
          summonType === 'familiar'
            ? 'Search CR 0 beasts...'
            : 'Search creatures...'
        }
        leftIcon={<Search size={14} />}
        autoFocus
      />
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {isSearching && (
          <p className="text-muted py-8 text-center text-sm">Searching...</p>
        )}
        {!isSearching &&
          monsterResults.length === 0 &&
          searchQuery.length >= 2 && (
            <p className="text-muted py-8 text-center text-sm">
              No creatures found
            </p>
          )}
        {!isSearching &&
          monsterResults.length === 0 &&
          searchQuery.length < 2 && (
            <p className="text-muted py-8 text-center text-sm">
              {summonType === 'familiar'
                ? 'Type a name to search CR 0 beasts (e.g. "owl", "cat", "hawk")'
                : 'Type a creature name to search the bestiary'}
            </p>
          )}
        {monsterResults.map(m => {
          const typeStr = typeof m.type === 'string' ? m.type : m.type.type;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMonster(m)}
              className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-accent-purple-bg w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-heading font-semibold">{m.name}</span>
                <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
                  CR {m.cr}
                </span>
              </div>
              <div className="text-body mt-0.5 text-xs">
                <span className="font-medium">{m.hp}</span> HP{' · '}
                <span className="font-medium">AC {m.ac}</span>
                {' · '}
                {typeStr}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function SavedCreaturesPanel({
  savedCreatures,
  selectedCreature,
  onSelectCreature,
  customName,
  onCustomNameChange,
  onConfirm,
  onCreateNew,
  onEdit,
  onDelete,
}: {
  savedCreatures: SavedCreature[];
  selectedCreature: SavedCreature | null;
  onSelectCreature: (c: SavedCreature | null) => void;
  customName: string;
  onCustomNameChange: (n: string) => void;
  onConfirm: () => void;
  onCreateNew: () => void;
  onEdit: (c: SavedCreature) => void;
  onDelete: (id: string) => void;
}) {
  if (selectedCreature) {
    const mod = (score: number) => {
      const m = Math.floor((score - 10) / 2);
      return m >= 0 ? `+${m}` : String(m);
    };

    return (
      <div className="space-y-3">
        <button
          onClick={() => onSelectCreature(null)}
          className="text-muted hover:text-body flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Back to list
        </button>

        <div className="border-accent-purple-border-strong bg-surface-raised rounded-lg border-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-heading font-semibold">
              {selectedCreature.name}
            </h4>
            {selectedCreature.cr && (
              <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
                CR {selectedCreature.cr}
              </span>
            )}
          </div>
          <p className="text-muted mb-3 text-xs">
            {selectedCreature.size} {selectedCreature.type}
            {selectedCreature.alignment
              ? `, ${selectedCreature.alignment}`
              : ''}
          </p>
          <div className="flex gap-4 text-xs">
            <span>
              <span className="font-medium">{selectedCreature.hp}</span> HP
            </span>
            <span>
              AC <span className="font-medium">{selectedCreature.ac}</span>
            </span>
            <span>{selectedCreature.speed}</span>
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1 text-center">
            {(
              [
                ['STR', selectedCreature.str],
                ['DEX', selectedCreature.dex],
                ['CON', selectedCreature.con],
                ['INT', selectedCreature.int],
                ['WIS', selectedCreature.wis],
                ['CHA', selectedCreature.cha],
              ] as const
            ).map(([label, score]) => (
              <div key={label}>
                <span className="text-muted block text-[9px] font-medium uppercase">
                  {label}
                </span>
                <span className="text-body text-xs">
                  {score} ({mod(score)})
                </span>
              </div>
            ))}
          </div>

          <p className="text-faint mt-2 text-[10px]">
            {selectedCreature.hpFormula
              ? `HP formula: ${selectedCreature.hpFormula}`
              : ''}
            {selectedCreature.traits && selectedCreature.traits.length > 0
              ? ` · ${selectedCreature.traits.length} trait(s)`
              : ''}
            {selectedCreature.actions && selectedCreature.actions.length > 0
              ? ` · ${selectedCreature.actions.length} action(s)`
              : ''}
            {selectedCreature.reactions && selectedCreature.reactions.length > 0
              ? ` · ${selectedCreature.reactions.length} reaction(s)`
              : ''}
          </p>
        </div>

        <Input
          value={customName}
          onChange={e => onCustomNameChange(e.target.value)}
          placeholder={selectedCreature.name}
          label="Custom Name (optional)"
        />

        <Button
          variant="primary"
          onClick={onConfirm}
          leftIcon={<Plus size={16} />}
          fullWidth
        >
          Summon {customName || selectedCreature.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={onCreateNew}
        leftIcon={<Plus size={14} />}
        fullWidth
      >
        Create Custom Creature
      </Button>

      {savedCreatures.length === 0 ? (
        <div className="border-divider bg-surface-raised rounded-lg border p-6 text-center">
          <Wand2 className="text-muted mx-auto mb-2 h-8 w-8" />
          <p className="text-muted text-sm">No saved creatures yet</p>
          <p className="text-faint mt-1 text-xs">
            Create a custom creature to reuse it across summons
          </p>
        </div>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {savedCreatures.map(creature => (
            <div
              key={creature.id}
              className="border-divider bg-surface-raised hover:border-accent-purple-border group flex items-center gap-2 rounded-lg border transition-all"
            >
              <button
                onClick={() => onSelectCreature(creature)}
                className="hover:bg-accent-purple-bg flex-1 rounded-l-lg px-3 py-2.5 text-left text-sm transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-heading font-semibold">
                    {creature.name}
                  </span>
                  {creature.cr && (
                    <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
                      CR {creature.cr}
                    </span>
                  )}
                </div>
                <div className="text-body mt-0.5 text-xs">
                  <span className="font-medium">{creature.hp}</span> HP
                  {' · '}
                  <span className="font-medium">AC {creature.ac}</span>
                  {' · '}
                  {creature.size} {creature.type}
                </div>
              </button>
              <div className="flex gap-1 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onEdit(creature)}
                  className="text-muted hover:text-body rounded p-1 transition-colors"
                  title="Edit"
                >
                  <Wand2 size={14} />
                </button>
                <button
                  onClick={() => onDelete(creature.id)}
                  className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
