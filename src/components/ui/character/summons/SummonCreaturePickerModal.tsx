'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, Plus } from 'lucide-react';
import type { Spell } from '@/types/character';
import type { Summon } from '@/types/summon';
import type { ProcessedMonster } from '@/types/bestiary';
import { searchMonsters } from '@/utils/apiClient';
import {
  getSummonType,
  isSpiritSummonSpell,
  getSpiritScaling,
  createFamiliarFromMonster,
  createSummonFromMonster,
  createSpiritSummon,
} from '@/utils/summonConverter';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [monsterResults, setMonsterResults] = useState<ProcessedMonster[]>([]);
  const [selectedMonster, setSelectedMonster] =
    useState<ProcessedMonster | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
      setSearchQuery('');
      setMonsterResults([]);
      setSelectedMonster(null);
      setSelectedSubtype(null);
      setCustomName('');
    }
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {summonType === 'familiar'
              ? 'Choose Your Familiar'
              : `Summon Creature — ${spell.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[340px]">
          {/* Spirit summon: subtype selection + preview */}
          {isSpirit && spiritPreview ? (
            <div className="space-y-4">
              {/* Scaled stats preview */}
              <div className="border-accent-purple-border-strong bg-surface-raised rounded-lg border-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-heading font-semibold">
                    {spiritPreview.name}
                  </h4>
                  <Badge variant="info">Level {castAtLevel}</Badge>
                </div>
                <div className="flex gap-4 text-xs">
                  <span>
                    <span className="text-muted">AC</span>{' '}
                    <span className="text-heading font-medium">
                      {spiritPreview.ac}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted">HP</span>{' '}
                    <span className="text-heading font-medium">
                      {spiritPreview.hp}
                    </span>
                  </span>
                </div>
                <HPBar
                  current={spiritPreview.hp}
                  max={spiritPreview.hp}
                  size="sm"
                  className="mt-2"
                />
              </div>

              {/* Subtype selection */}
              {spiritPreview.subtypes && spiritPreview.subtypes.length > 0 && (
                <div>
                  <label className="text-heading mb-1.5 block text-sm font-medium">
                    Choose Form
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {spiritPreview.subtypes.map(st => (
                      <button
                        key={st}
                        onClick={() => setSelectedSubtype(st)}
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

              {/* Custom name */}
              <Input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder={spiritPreview.name}
                label="Custom Name (optional)"
              />

              <Button
                variant="primary"
                onClick={handleConfirmSpirit}
                leftIcon={<Plus size={16} />}
                fullWidth
                disabled={isCreating}
              >
                {isCreating
                  ? 'Summoning...'
                  : `Summon ${customName || spiritPreview.name}`}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedMonster ? (
                /* Selected monster customization step */
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedMonster(null)}
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
                      {selectedMonster.alignment
                        ? `, ${selectedMonster.alignment}`
                        : ''}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <span>
                        <span className="font-medium">
                          {selectedMonster.hpAverage}
                        </span>{' '}
                        HP
                      </span>
                      <span>
                        AC{' '}
                        <span className="font-medium">
                          {selectedMonster.acValue}
                        </span>
                      </span>
                      <span>{selectedMonster.speed}</span>
                    </div>

                    {/* Ability scores preview */}
                    <div className="mt-3 grid grid-cols-6 gap-1 text-center">
                      {(
                        ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
                      ).map(ability => (
                        <div key={ability}>
                          <span className="text-muted block text-[9px] font-medium uppercase">
                            {ability}
                          </span>
                          <span className="text-body text-xs">
                            {selectedMonster[ability]}
                          </span>
                        </div>
                      ))}
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
                    onChange={e => setCustomName(e.target.value)}
                    placeholder={selectedMonster.name}
                    label="Custom Name (optional)"
                  />

                  <Button
                    variant="primary"
                    onClick={handleConfirmMonster}
                    leftIcon={<Plus size={16} />}
                    fullWidth
                  >
                    Summon {customName || selectedMonster.name}
                  </Button>
                </div>
              ) : (
                /* Monster search */
                <>
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
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
                      <p className="text-muted py-8 text-center text-sm">
                        Searching...
                      </p>
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
                      const typeStr =
                        typeof m.type === 'string' ? m.type : m.type.type;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMonster(m)}
                          className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-accent-purple-bg w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-heading font-semibold">
                              {m.name}
                            </span>
                            <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
                              CR {m.cr}
                            </span>
                          </div>
                          <div className="text-body mt-0.5 text-xs">
                            <span className="font-medium">{m.hp}</span> HP
                            {' · '}
                            <span className="font-medium">AC {m.ac}</span>
                            {' · '}
                            {typeStr}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
