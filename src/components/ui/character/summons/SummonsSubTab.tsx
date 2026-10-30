'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { Plus, Wand2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SavedCreature, Summon } from '@/types/summon';
import { useCharacterStore } from '@/store/characterStore';
import { SummonCard } from './SummonCard';
import { CreatureCreatorForm } from './CreatureCreatorForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';

const EMPTY_SAVED_CREATURES: SavedCreature[] = [];
const EMPTY_SUMMONS: Summon[] = [];

export function SummonsSubTab() {
  const character = useCharacterStore(state => state.character);
  const damageSummon = useCharacterStore(state => state.damageSummon);
  const healSummon = useCharacterStore(state => state.healSummon);
  const addSummonTempHp = useCharacterStore(state => state.addSummonTempHp);
  const addSummonCondition = useCharacterStore(
    state => state.addSummonCondition
  );
  const removeSummonCondition = useCharacterStore(
    state => state.removeSummonCondition
  );
  const removeSummon = useCharacterStore(state => state.removeSummon);
  const addSavedCreature = useCharacterStore(state => state.addSavedCreature);
  const updateSavedCreature = useCharacterStore(
    state => state.updateSavedCreature
  );
  const removeSavedCreature = useCharacterStore(
    state => state.removeSavedCreature
  );

  const summons = character.summons || EMPTY_SUMMONS;
  const savedCreatures = character.savedCreatures ?? EMPTY_SAVED_CREATURES;

  const [showSaved, setShowSaved] = useState(false);
  const savedToggleRef = useRef<HTMLButtonElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const editRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const summonRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusAfterDismiss = useRef<string | 'saved' | null>(null);
  const focusAfterRemoval = useRef<string | 'create' | null>(null);

  useLayoutEffect(() => {
    const target = focusAfterRemoval.current;
    if (!target) return;
    (target === 'create'
      ? createRef.current
      : editRefs.current[target]
    )?.focus();
    focusAfterRemoval.current = null;
  }, [savedCreatures]);

  useLayoutEffect(() => {
    const target = focusAfterDismiss.current;
    if (!target) return;
    (target === 'saved'
      ? savedToggleRef.current
      : summonRefs.current[target]?.querySelector<HTMLButtonElement>(
          'button[aria-label^="Dismiss"]'
        )
    )?.focus();
    focusAfterDismiss.current = null;
  }, [summons]);

  const handleDismiss = (id: string) => {
    const index = summons.findIndex(summon => summon.id === id);
    focusAfterDismiss.current =
      summons[index + 1]?.id ?? summons[index - 1]?.id ?? 'saved';
    removeSummon(id);
  };

  const handleDeleteSaved = (id: string) => {
    const index = savedCreatures.findIndex(creature => creature.id === id);
    focusAfterRemoval.current =
      savedCreatures[index + 1]?.id ??
      savedCreatures[index - 1]?.id ??
      'create';
    removeSavedCreature(id);
  };
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingCreature, setEditingCreature] = useState<SavedCreature | null>(
    null
  );

  const handleSaveCreature = (creature: SavedCreature) => {
    if (editingCreature) {
      updateSavedCreature(creature.id, creature);
    } else {
      addSavedCreature(creature);
    }
    setCreatorOpen(false);
    setEditingCreature(null);
  };

  const familiars = summons.filter(s => s.type === 'familiar');
  const concentrationSummons = summons.filter(
    s => s.type === 'summon' && s.requiresConcentration
  );
  const otherSummons = summons.filter(
    s => s.type === 'summon' && !s.requiresConcentration
  );

  const renderSummon = (s: (typeof summons)[number]) => (
    <div
      key={s.id}
      ref={element => {
        summonRefs.current[s.id] = element;
      }}
    >
      <SummonCard
        summon={s}
        onDamage={damageSummon}
        onHeal={healSummon}
        onAddTempHp={addSummonTempHp}
        onAddCondition={addSummonCondition}
        onRemoveCondition={removeSummonCondition}
        onDismiss={handleDismiss}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {summons.length === 0 && (
        <div className="py-8 text-center">
          <h3 className="text-heading mb-1 text-sm font-semibold">
            No summons
          </h3>
          <p className="text-muted text-xs">
            Cast a summoning spell, such as Find Familiar, from the Spells tab.
          </p>
        </div>
      )}

      {familiars.length > 0 && (
        <Section heading="Familiars" level={3} contentClassName="space-y-2">
          {familiars.map(renderSummon)}
        </Section>
      )}

      {concentrationSummons.length > 0 && (
        <Section
          heading="Concentration summons"
          level={3}
          contentClassName="space-y-2"
        >
          {concentrationSummons.map(renderSummon)}
        </Section>
      )}

      {otherSummons.length > 0 && (
        <Section heading="Other summons" level={3} contentClassName="space-y-2">
          {otherSummons.map(renderSummon)}
        </Section>
      )}

      {/* Saved creatures Section */}
      <div className="border-divider border-t pt-3">
        <button
          ref={savedToggleRef}
          type="button"
          aria-expanded={showSaved}
          onClick={() => setShowSaved(!showSaved)}
          className="text-heading hover:text-body flex w-full items-center justify-between text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Wand2 size={14} />
            Saved creatures
            {savedCreatures.length > 0 && (
              <span className="text-muted text-xs">
                ({savedCreatures.length})
              </span>
            )}
          </span>
          {showSaved ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSaved && (
          <div className="mt-2 space-y-2">
            <Button
              ref={createRef}
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCreature(null);
                setCreatorOpen(true);
              }}
              leftIcon={<Plus size={14} />}
              fullWidth
            >
              Create creature
            </Button>

            {savedCreatures.length === 0 ? (
              <p className="text-faint py-2 text-center text-xs">
                No saved creatures. Create one to reuse across summons.
              </p>
            ) : (
              savedCreatures.map(creature => (
                <div
                  key={creature.id}
                  className="border-divider border-b px-1 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-heading text-sm font-semibold break-words">
                        {creature.name}
                      </span>
                      <div className="text-muted text-xs">
                        {creature.size} {creature.type}
                        {' · '}
                        <span className="font-medium">{creature.hp}</span> HP
                        {' · '}AC{' '}
                        <span className="font-medium">{creature.ac}</span>
                        {creature.cr ? ` · CR ${creature.cr}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        ref={element => {
                          editRefs.current[creature.id] = element;
                        }}
                        type="button"
                        aria-label={`Edit ${creature.name}`}
                        onClick={() => {
                          setEditingCreature(creature);
                          setCreatorOpen(true);
                        }}
                      >
                        <Wand2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        type="button"
                        aria-label={`Delete ${creature.name}`}
                        onClick={() => handleDeleteSaved(creature.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Creator Dialog */}
      <Dialog
        open={creatorOpen}
        onOpenChange={v => {
          if (!v) {
            setCreatorOpen(false);
            setEditingCreature(null);
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>
              {editingCreature
                ? `Edit ${editingCreature.name}`
                : 'Create creature'}
            </DialogTitle>
          </DialogHeader>
          <CreatureCreatorForm
            initialCreature={editingCreature ?? undefined}
            onSave={handleSaveCreature}
            onCancel={() => {
              setCreatorOpen(false);
              setEditingCreature(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
