'use client';

import { calculateCharacterArmorClass } from "@/utils/calculations";
import { CharacterState } from "@/types/character";

interface ArmorClassManagerProps {
  character: CharacterState;
  onUpdateArmorClass: (ac: number) => void;
  onUpdateTempArmorClass: (tempAC: number) => void;
  onResetTempArmorClass: () => void;
  onToggleShield: () => void;
  onUpdateShieldBonus: (bonus: number) => void;
}

export default function ArmorClassManager({
  character,
  onUpdateArmorClass,
  onUpdateTempArmorClass,
  onResetTempArmorClass,
  onToggleShield,
  onUpdateShieldBonus
}: ArmorClassManagerProps) {
  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-red-800 mb-3 flex items-center justify-center gap-2">
            🛡️ ARMOR CLASS
          </h3>
          <div className="text-5xl font-bold text-red-900 mb-2">
            {calculateCharacterArmorClass(character)}
          </div>
          <div className="text-base text-red-700 font-medium">Total AC</div>
        </div>
        
        {/* AC Components - Row Layout */}
        <div className="space-y-4 mb-6">
          {/* Base AC Row */}
          <div className="bg-white rounded-lg border-2 border-red-300 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-lg font-bold text-red-800">Base AC</div>
                <div className="text-sm text-red-600">From armor & dexterity</div>
              </div>
              <input
                type="number"
                value={character.armorClass}
                onChange={(e) => onUpdateArmorClass(parseInt(e.target.value) || 10)}
                className="w-20 h-12 text-2xl font-bold text-center bg-red-50 border-2 border-red-300 rounded-lg text-red-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                min="0"
                max="30"
              />
            </div>
          </div>
          
          {/* Temporary AC Row */}
          <div className="bg-white rounded-lg border-2 border-orange-300 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-lg font-bold text-orange-800">Temporary AC</div>
                <div className="text-sm text-orange-600">From spells & effects</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-orange-700">+</span>
                  <input
                    type="number"
                    value={character.tempArmorClass}
                    onChange={(e) => onUpdateTempArmorClass(parseInt(e.target.value) || 0)}
                    className="w-20 h-12 text-2xl font-bold text-center bg-orange-50 border-2 border-orange-300 rounded-lg text-orange-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min="0"
                    max="20"
                  />
                </div>
                {character.tempArmorClass > 0 && (
                  <button
                    onClick={onResetTempArmorClass}
                    className="px-3 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 border border-orange-300 rounded-md transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Shield Row */}
          <div className="bg-white rounded-lg border-2 border-blue-300 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-lg font-bold text-blue-800">Shield</div>
                <div className="text-sm text-blue-600">
                  {character.isWearingShield ? `+${character.shieldBonus} AC bonus` : 'Click to equip'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleShield}
                  className={`w-12 h-12 rounded-lg text-2xl transition-all duration-200 flex items-center justify-center ${
                    character.isWearingShield
                      ? 'bg-blue-600 text-white shadow-lg transform scale-105 border-2 border-blue-700'
                      : 'bg-blue-50 border-2 border-blue-300 text-blue-600 hover:bg-blue-100'
                  }`}
                  title={`${character.isWearingShield ? 'Unequip' : 'Equip'} shield`}
                >
                  🛡️
                </button>
                
                {character.isWearingShield && (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-blue-700">+</span>
                    <input
                      type="number"
                      value={character.shieldBonus}
                      onChange={(e) => onUpdateShieldBonus(parseInt(e.target.value) || 2)}
                      className="w-16 h-10 text-lg font-bold text-center bg-blue-50 border-2 border-blue-300 rounded-lg text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="5"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* AC Formula Display */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-lg border-2 border-red-300 text-lg font-medium text-red-800 shadow-sm">
            <span className="text-xl font-bold">{character.armorClass}</span>
            <span className="text-red-600 text-lg">+</span>
            <span className="text-xl font-bold">{character.tempArmorClass}</span>
            {character.isWearingShield && (
              <>
                <span className="text-red-600 text-lg">+</span>
                <span className="text-xl font-bold">{character.shieldBonus}</span>
              </>
            )}
            <span className="text-red-600 text-lg">=</span>
            <span className="font-bold text-2xl text-red-900">{calculateCharacterArmorClass(character)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
