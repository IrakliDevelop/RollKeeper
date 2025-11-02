'use client';

import { calculateCharacterArmorClass } from '@/utils/calculations';
import { Button, Input } from '@/components/ui/forms';
import { CharacterState } from '@/types/character';

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
  onUpdateShieldBonus,
}: ArmorClassManagerProps) {
  return (
    <div className="mb-6">
      <div className="rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-red-100 p-6">
        <div className="mb-6 text-center">
          <h3 className="mb-3 flex items-center justify-center gap-2 text-xl font-bold text-red-800">
            🛡️ ARMOR CLASS
          </h3>
          <div className="mb-2 text-5xl font-bold text-red-900">
            {calculateCharacterArmorClass(character)}
          </div>
          <div className="text-base font-medium text-red-700">Total AC</div>
        </div>

        {/* AC Components - Row Layout */}
        <div className="mb-6 space-y-4">
          {/* Base AC Row */}
          <div className="rounded-lg border-2 border-red-300 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold text-red-800 w-32">Base AC</div>
              <div className="flex-1 text-sm text-red-600">
                From armor & dexterity
              </div>
              <Input
                type="number"
                value={character.armorClass.toString()}
                onChange={e =>
                  onUpdateArmorClass(parseInt(e.target.value) || 10)
                }
                className="h-12 w-20 border-2 border-red-300 bg-red-50 text-center text-2xl font-bold text-red-900 focus:border-red-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                min="0"
                max="30"
              />
            </div>
          </div>

          {/* Temporary AC Row */}
          <div className="rounded-lg border-2 border-orange-300 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold text-orange-800 w-32">
                Temporary AC
              </div>
              <div className="flex-1 text-sm text-orange-600">
                From spells & effects
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-orange-700">+</span>
                  <Input
                    type="number"
                    value={character.tempArmorClass.toString()}
                    onChange={e =>
                      onUpdateTempArmorClass(parseInt(e.target.value) || 0)
                    }
                    className="h-12 w-20 border-2 border-orange-300 bg-orange-50 text-center text-2xl font-bold text-orange-900 focus:border-orange-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    min="0"
                    max="20"
                  />
                </div>
                {character.tempArmorClass > 0 && (
                  <Button
                    onClick={onResetTempArmorClass}
                    variant="ghost"
                    size="xs"
                    className="border border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-800"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Shield Row */}
          <div className="rounded-lg border-2 border-blue-300 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-lg font-bold text-blue-800 w-32">Shield</div>
              <div className="flex-1 text-sm text-blue-600">
                {character.isWearingShield
                  ? `+${character.shieldBonus} AC bonus`
                  : 'Click to equip'}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={onToggleShield}
                  variant="ghost"
                  size="md"
                  className={`h-12 w-12 rounded-lg text-2xl transition-all duration-200 ${
                    character.isWearingShield
                      ? 'scale-105 transform border-2 border-blue-700 bg-blue-600 text-white shadow-lg hover:bg-blue-700'
                      : 'border-2 border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                  title={`${character.isWearingShield ? 'Unequip' : 'Equip'} shield`}
                >
                  🛡️
                </Button>

                {character.isWearingShield && (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-blue-700">+</span>
                    <Input
                      type="number"
                      value={character.shieldBonus.toString()}
                      onChange={e =>
                        onUpdateShieldBonus(parseInt(e.target.value) || 2)
                      }
                      className="h-10 w-16 border-2 border-blue-300 bg-blue-50 text-center text-lg font-bold text-blue-900 focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          <div className="inline-flex items-center gap-3 rounded-lg border-2 border-red-300 bg-white px-6 py-3 text-lg font-medium text-red-800 shadow-sm">
            <span className="text-xl font-bold">{character.armorClass}</span>
            <span className="text-lg text-red-600">+</span>
            <span className="text-xl font-bold">
              {character.tempArmorClass}
            </span>
            {character.isWearingShield && (
              <>
                <span className="text-lg text-red-600">+</span>
                <span className="text-xl font-bold">
                  {character.shieldBonus}
                </span>
              </>
            )}
            <span className="text-lg text-red-600">=</span>
            <span className="text-2xl font-bold text-red-900">
              {calculateCharacterArmorClass(character)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
