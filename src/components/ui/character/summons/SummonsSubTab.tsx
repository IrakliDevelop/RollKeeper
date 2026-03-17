'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Wand2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SavedCreature } from '@/types/summon';
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

const EMPTY_SAVED_CREATURES: SavedCreature[] = [];

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

  const summons = character.summons || [];
  const savedCreatures = character.savedCreatures ?? EMPTY_SAVED_CREATURES;

  const [showSaved, setShowSaved] = useState(false);
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

  return (
    <div className="space-y-3">
      {summons.length === 0 && (
        <div className="border-divider bg-surface-raised rounded-lg border p-8 text-center">
          <Sparkles className="text-muted mx-auto mb-3 h-10 w-10" />
          <h3 className="text-heading mb-1 text-sm font-semibold">
            No Active Summons
          </h3>
          <p className="text-muted text-xs">
            Cast a summoning spell (like Find Familiar or Summon Beast) from the
            Spells tab to summon a creature here.
          </p>
        </div>
      )}

      {familiars.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Familiars
          </h4>
          {familiars.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}

      {concentrationSummons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Concentration Summons
          </h4>
          {concentrationSummons.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}

      {otherSummons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Other Summons
          </h4>
          {otherSummons.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}

      {/* Saved Creatures Section */}
      <div className="border-divider border-t pt-3">
        <button
          onClick={() => setShowSaved(!showSaved)}
          className="text-heading hover:text-accent-purple-text flex w-full items-center justify-between text-sm font-medium transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Wand2 size={14} />
            Saved Creatures
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
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCreature(null);
                setCreatorOpen(true);
              }}
              leftIcon={<Plus size={14} />}
              fullWidth
            >
              Create Custom Creature
            </Button>

            {savedCreatures.length === 0 ? (
              <p className="text-faint py-2 text-center text-xs">
                No saved creatures. Create one to reuse across summons.
              </p>
            ) : (
              savedCreatures.map(creature => (
                <div
                  key={creature.id}
                  className="border-divider bg-surface-raised group rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-heading text-sm font-semibold">
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
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingCreature(creature);
                          setCreatorOpen(true);
                        }}
                        className="text-muted hover:text-body rounded p-1 transition-colors"
                        title="Edit"
                      >
                        <Wand2 size={14} />
                      </button>
                      <button
                        onClick={() => removeSavedCreature(creature.id)}
                        className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCreature
                ? `Edit: ${editingCreature.name}`
                : 'Create Custom Creature'}
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
