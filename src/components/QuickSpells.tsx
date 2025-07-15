'use client';

import { Shield, Sparkles, Dice6 } from "lucide-react";
import { useCharacterStore } from "@/store/characterStore";
import { Spell } from "@/types/character";
import { calculateSpellAttackBonus, calculateSpellSaveDC, getCharacterSpellcastingAbility } from "@/utils/calculations";

interface QuickSpellsProps {
  showAttackRoll: (weaponName: string, roll: number, bonus: number, isCrit: boolean, damage?: string, damageType?: string) => void;
  showSavingThrow: (spellName: string, saveDC: number, saveType?: string, damage?: string, damageType?: string) => void;
}

export function QuickSpells({ showAttackRoll: showAttackToast, showSavingThrow: showSaveToast }: QuickSpellsProps) {
  const { character } = useCharacterStore();
  
  // Get all available spells for quick access (cantrips + prepared spells)
  const quickAccessSpells = character.spells.filter(spell => 
    spell.level === 0 || // All cantrips
    spell.isPrepared || // Prepared spells
    spell.isAlwaysPrepared // Always prepared spells
  );

  // Filter spells that have actions (attack or save)
  const actionSpells = quickAccessSpells.filter(spell => 
    spell.actionType === 'attack' || spell.actionType === 'save'
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

  if (actionSpells.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="text-4xl mb-2">🔮</div>
        <p className="font-medium">No action spells ready</p>
        <p className="text-sm mt-1">
          Add spells with attack rolls or saving throws to see them here.
        </p>
      </div>
    );
  }

  return (
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
          
          <div className="flex gap-2">
            {spell.actionType === 'attack' && (
              <button
                onClick={() => rollSpellAttack(spell)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                <Dice6 size={14} />
                Attack Roll
              </button>
            )}
            
            {spell.actionType === 'save' && (
              <button
                onClick={() => showSavingThrow(spell)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Shield size={14} />
                {spell.savingThrow ? `${spell.savingThrow} Save` : 'Saving Throw'}
              </button>
            )}
            
            <div className="flex items-center gap-1 text-xs text-gray-600">
              {spell.damage && (
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {spell.damage} {spell.damageType && `${spell.damageType}`}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 