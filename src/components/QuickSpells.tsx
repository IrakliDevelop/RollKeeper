'use client';

import React, { useState } from "react";
import { Shield, Sparkles, Dice6, Zap, Wand2 } from "lucide-react";
import { useCharacterStore } from "@/store/characterStore";
import { Spell } from "@/types/character";
import { calculateSpellAttackBonus, calculateSpellSaveDC, getCharacterSpellcastingAbility, rollDamage } from "@/utils/calculations";
import { SpellCastModal } from "@/components/ui/SpellCastModal";

interface QuickSpellsProps {
  showAttackRoll: (weaponName: string, roll: number, bonus: number, isCrit: boolean, damage?: string, damageType?: string) => void;
  showSavingThrow: (spellName: string, saveDC: number, saveType?: string, damage?: string, damageType?: string) => void;
  showDamageRoll: (weaponName: string, damageRoll: string, damageType?: string, versatile?: boolean) => void;
}

export function QuickSpells({ showAttackRoll: showAttackToast, showSavingThrow: showSaveToast, showDamageRoll }: QuickSpellsProps) {
  const { 
    character, 
    updateSpellSlot, 
    startConcentration, 
    stopConcentration 
  } = useCharacterStore();
  
  // Modal state
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null);
  
  // Get all available spells for quick access (cantrips + prepared spells)
  const quickAccessSpells = character.spells.filter(spell => 
    spell.level === 0 || // All cantrips
    spell.isPrepared || // Prepared spells
    spell.isAlwaysPrepared // Always prepared spells
  );

  // Filter spells that have actions (attack, save, or damage)
  const actionSpells = quickAccessSpells.filter(spell => 
    spell.actionType === 'attack' || 
    spell.actionType === 'save' || 
    spell.damage // Include any spell with damage dice
  );

  // Get spellcasting ability and modifiers
  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const spellSaveDC = calculateSpellSaveDC(character);

  const rollSpellAttack = (spell: Spell) => {
    if (spellAttackBonus === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }
    
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

  const showSavingThrow = (spell: Spell) => {
    if (spellSaveDC === null) {
      alert('Cannot cast spells - no spellcasting ability detected');
      return;
    }
    
    showSaveToast(
      spell.name,
      spellSaveDC,
      spell.savingThrow,
      spell.damage,
      spell.damageType
    );
  };

  const rollSpellDamage = (spell: Spell) => {
    if (!spell.damage) {
      alert('This spell does not have damage dice specified');
      return;
    }
    
    const damageResult = rollDamage(spell.damage);
    showDamageRoll(
      spell.name,
      damageResult,
      spell.damageType
    );
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
      updateSpellSlot(spellLevel as keyof typeof character.spellSlots, 
        character.spellSlots[spellLevel as keyof typeof character.spellSlots].used + 1);
    }

    // Close modal
    setCastModalOpen(false);
    setSelectedSpell(null);
    
    // Show a toast or notification that the spell was cast
    // You could add a toast system here if desired
  };

  if (actionSpells.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="text-4xl mb-2">🔮</div>
        <p className="font-medium">No action spells ready</p>
        <p className="text-sm mt-1">
          Add spells with attack rolls, saving throws, or damage dice to see them here.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-purple-700 mb-3">
        <Sparkles size={16} />
        <span className="font-medium">
          Spell Attack: +{spellAttackBonus ?? 0} | Save DC: {spellSaveDC ?? 8}
        </span>
        {spellcastingAbility && (
          <span className="text-xs bg-purple-100 px-2 py-1 rounded">
            {spellcastingAbility.charAt(0).toUpperCase() + spellcastingAbility.slice(1)}
          </span>
        )}
      </div>
      
      {actionSpells.map((spell) => (
        <div
          key={spell.id}
          className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-3 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                spell.level === 0 ? 'bg-yellow-400' : 'bg-purple-400'
              }`}></div>
              <span className="font-semibold text-purple-900">{spell.name}</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-purple-600 mb-2">
            <span>{spell.castingTime}</span>
            <span>•</span>
            <span>{spell.range}</span>
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
              className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg shadow-md hover:from-purple-700 hover:to-violet-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
              Cast
            </button>

            {spell.actionType === 'attack' && (
              <button
                onClick={() => rollSpellAttack(spell)}
                className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg shadow-md hover:from-slate-700 hover:to-slate-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Dice6 size={16} className="group-hover:rotate-12 transition-transform" />
                Attack Roll
              </button>
            )}
            
            {spell.actionType === 'save' && (
              <button
                onClick={() => showSavingThrow(spell)}
                className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Shield size={16} className="group-hover:scale-110 transition-transform" />
                {spell.savingThrow ? `${spell.savingThrow} Save` : 'Saving Throw'}
              </button>
            )}
            
            {spell.damage && (
              <button
                onClick={() => rollSpellDamage(spell)}
                className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow-md hover:from-amber-600 hover:to-orange-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                title="Roll spell damage"
              >
                <Zap size={16} className="group-hover:animate-pulse" />
                Damage
              </button>
            )}
            
            {spell.damage && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <span className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm font-medium">
                  {spell.damage} {spell.damageType && `${spell.damageType}`}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
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