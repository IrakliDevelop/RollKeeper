'use client';

import React, { useState } from 'react';
import { Shield, Sparkles, Dice6, Zap, Wand2 } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { Spell } from '@/types/character';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
  rollDamage,
} from '@/utils/calculations';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import DragDropList from '@/components/ui/layout/DragDropList';
import { RollSummary } from '@/types/dice';

interface QuickSpellsProps {
  showAttackRoll: (
    weaponName: string,
    roll: number,
    bonus: number,
    isCrit: boolean,
    damage?: string,
    damageType?: string
  ) => void;
  showSavingThrow: (
    spellName: string,
    saveDC: number,
    saveType?: string,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown> | void;
}

export function QuickSpells({
  showAttackRoll: showAttackToast,
  showSavingThrow: showSaveToast,
  showDamageRoll,
  animateRoll,
}: QuickSpellsProps) {
  const {
    character,
    updateSpellSlot,
    startConcentration,
    stopConcentration,
    reorderSpells,
  } = useCharacterStore();

  // Modal state
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);

  // Get all available spells for quick access (prepared cantrips + prepared spells)
  const quickAccessSpells = character.spells.filter(
    spell =>
      (spell.level === 0 && spell.isPrepared) || // Only prepared cantrips
      (spell.level > 0 && spell.isPrepared) || // Prepared spells
      spell.isAlwaysPrepared // Always prepared spells
  );

  // Show all prepared spells in quick access (not just action spells)
  const actionSpells = quickAccessSpells;

  // Get spellcasting ability and modifiers
  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const spellSaveDC = calculateSpellSaveDC(character);

  // Custom reorder handler for action spells
  const handleReorderActionSpells = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    // Get the spell IDs being reordered
    const sourceSpellId = actionSpells[sourceIndex].id;
    const destinationSpellId = actionSpells[destinationIndex].id;

    // Find the indices in the main spells array
    const sourceGlobalIndex = character.spells.findIndex(
      spell => spell.id === sourceSpellId
    );
    const destinationGlobalIndex = character.spells.findIndex(
      spell => spell.id === destinationSpellId
    );

    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderSpells(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  const rollSpellAttack = async (spell: Spell) => {
    if (spellAttackBonus === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }

    // Animate d20 for spell attack and use actual result
    if (animateRoll) {
      try {
        const rollResult = await animateRoll('1d20');
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;

          showAttackToast(
            spell.name,
            roll,
            spellAttackBonus,
            isCrit,
            spell.damage,
            spell.damageType
          );
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;

    showAttackToast(
      spell.name,
      roll,
      spellAttackBonus,
      isCrit,
      spell.damage,
      spell.damageType
    );
  };

  const showSavingThrow = async (spell: Spell) => {
    if (spellSaveDC === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }

    // Animate damage dice if the spell has damage
    // if (spell.damage && animateRoll) {
    //   try {
    //     await animateRoll(`1`);
    //   } catch (error) {
    //     console.warn('Damage dice animation failed for saving throw:', error);
    //   }
    // }

    showSaveToast(
      spell.name,
      spellSaveDC,
      spell.savingThrow,
      spell.damage,
      spell.damageType
    );
  };

  const rollSpellDamage = async (spell: Spell) => {
    if (!spell.damage) {
      alert('This spell does not have damage dice specified');
      return;
    }

    // Animate damage dice and use actual result
    if (animateRoll) {
      try {
        const rollResult = await animateRoll(spell.damage);
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'finalTotal' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const damageResult = `${summary.finalTotal}`;

          showDamageRoll(spell.name, damageResult, spell.damageType);
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to calculated roll:',
          error
        );
      }
    }

    // Fallback to calculated damage if animation fails
    const damageResult = rollDamage(spell.damage);
    showDamageRoll(spell.name, damageResult, spell.damageType);
  };

  const openCastModal = (spell: Spell) => {
    setSelectedSpell(spell);
    setCastModalOpen(true);
  };

  const handleCastSpell = (spellLevel: number) => {
    if (!selectedSpell) return;

    // If it's a concentration spell, stop current concentration
    if (selectedSpell.concentration) {
      if (character.concentration.isConcentrating) {
        stopConcentration();
      }
      startConcentration(selectedSpell.name, selectedSpell.id, spellLevel);
    }

    // Use spell slot if it's not a cantrip
    if (selectedSpell.level > 0) {
      updateSpellSlot(
        spellLevel as keyof typeof character.spellSlots,
        character.spellSlots[spellLevel as keyof typeof character.spellSlots]
          .used + 1
      );
    }

    // Close modal
    setCastModalOpen(false);
    setSelectedSpell(null);

    // Show a toast or notification that the spell was cast
    // You could add a toast system here if desired
  };

  if (actionSpells.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500">
        <div className="mb-2 text-4xl">🔮</div>
        <p className="font-medium">No action spells ready</p>
        <p className="mt-1 text-sm">
          Add spells with attack rolls, saving throws, or damage dice to see
          them here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="mb-3 flex items-center gap-2 text-sm text-purple-700">
          <Sparkles size={16} />
          <span className="font-medium">
            Spell Attack: +{spellAttackBonus ?? 0} | Save DC: {spellSaveDC ?? 8}
          </span>
          {spellcastingAbility && (
            <span className="rounded bg-purple-100 px-2 py-1 text-xs">
              {spellcastingAbility.charAt(0).toUpperCase() +
                spellcastingAbility.slice(1)}
            </span>
          )}
        </div>

        <DragDropList
          items={actionSpells}
          onReorder={handleReorderActionSpells}
          keyExtractor={spell => spell.id}
          className="space-y-3"
          itemClassName="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-3 hover:shadow-md transition-all duration-200"
          showDragHandle={true}
          dragHandlePosition="left"
          renderItem={spell => (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      spell.level === 0 ? 'bg-yellow-400' : 'bg-purple-400'
                    }`}
                  ></div>
                  <span className="font-semibold text-purple-900">
                    {spell.name}
                  </span>
                  <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
                    {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                  </span>
                </div>
              </div>

              <div className="mb-2 flex items-center gap-2 text-xs text-purple-600">
                <span>{spell.castingTime}</span>
                <span>•</span>
                <span>{spell.range}</span>
                {spell.duration && (
                  <>
                    <span>•</span>
                    <span>{spell.duration}</span>
                  </>
                )}
                {spell.concentration && (
                  <>
                    <span>•</span>
                    <span className="text-orange-600">Concentration</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Cast Button - Always show for all spells */}
                <button
                  onClick={() => openCastModal(spell)}
                  className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:from-purple-700 hover:to-violet-700 hover:shadow-lg"
                >
                  <Wand2
                    size={16}
                    className="transition-transform group-hover:rotate-12"
                  />
                  Cast
                </button>

                {spell.actionType === 'attack' && (
                  <button
                    onClick={() => rollSpellAttack(spell)}
                    className="group flex transform items-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:scale-105 hover:from-slate-700 hover:to-slate-800 hover:shadow-lg"
                  >
                    <Dice6
                      size={16}
                      className="transition-transform group-hover:rotate-12"
                    />
                    Attack Roll
                  </button>
                )}

                {/* Show spell info for reference */}
                {(spell.actionType === 'save' || spell.damage) && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {spell.actionType === 'save' && spell.savingThrow && (
                      <span className="rounded-lg border border-blue-300 bg-gradient-to-r from-blue-100 to-blue-200 px-3 py-1.5 font-medium shadow-sm">
                        {spell.savingThrow} Save DC {spellSaveDC}
                      </span>
                    )}
                    {spell.damage && (
                      <span className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-100 to-amber-200 px-3 py-1.5 font-medium shadow-sm">
                        {spell.damage} {spell.damageType && `${spell.damageType}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        />
      </div>

      {/* Spell Cast Modal */}
      {selectedSpell && (
        <SpellCastModal
          isOpen={castModalOpen}
          onClose={() => {
            setCastModalOpen(false);
            setSelectedSpell(null);
          }}
          spell={selectedSpell}
          spellSlots={character.spellSlots}
          concentration={character.concentration}
          onCastSpell={handleCastSpell}
        />
      )}
    </>
  );
}
