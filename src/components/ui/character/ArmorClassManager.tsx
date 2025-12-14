'use client';

import { calculateCharacterArmorClass } from '@/utils/calculations';
import { Button, Input } from '@/components/ui/forms';
import { CharacterState } from '@/types/character';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { Info } from 'lucide-react';
import { useState, useEffect } from 'react';

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
  // Local state for input values to allow empty strings during editing
  const [baseACInput, setBaseACInput] = useState(
    character.armorClass.toString()
  );
  const [tempACInput, setTempACInput] = useState(
    character.tempArmorClass.toString()
  );
  const [shieldBonusInput, setShieldBonusInput] = useState(
    character.shieldBonus.toString()
  );

  // Update local state when character data changes externally
  useEffect(() => {
    setBaseACInput(character.armorClass.toString());
  }, [character.armorClass]);

  useEffect(() => {
    setTempACInput(character.tempArmorClass.toString());
  }, [character.tempArmorClass]);

  useEffect(() => {
    setShieldBonusInput(character.shieldBonus.toString());
  }, [character.shieldBonus]);

  // Handlers for Base AC
  const handleBaseACChange = (value: string) => {
    setBaseACInput(value);
  };

  const handleBaseACBlur = () => {
    const numValue = parseInt(baseACInput) || 10;
    const clampedValue = Math.max(0, Math.min(30, numValue));
    setBaseACInput(clampedValue.toString());
    onUpdateArmorClass(clampedValue);
  };

  // Handlers for Temp AC
  const handleTempACChange = (value: string) => {
    setTempACInput(value);
  };

  const handleTempACBlur = () => {
    const numValue = parseInt(tempACInput) || 0;
    const clampedValue = Math.max(0, Math.min(20, numValue));
    setTempACInput(clampedValue.toString());
    onUpdateTempArmorClass(clampedValue);
  };

  // Handlers for Shield Bonus
  const handleShieldBonusChange = (value: string) => {
    setShieldBonusInput(value);
  };

  const handleShieldBonusBlur = () => {
    const numValue = parseInt(shieldBonusInput) || 2;
    const clampedValue = Math.max(0, Math.min(5, numValue));
    setShieldBonusInput(clampedValue.toString());
    onUpdateShieldBonus(clampedValue);
  };

  return (
    <TooltipProvider>
      <div className="mb-6">
        <div className="rounded-xl border-2 border-red-200 bg-linear-to-r from-red-50 to-red-100 p-6">
          <div className="mb-6 text-center">
            <h3 className="mb-3 flex items-center justify-center gap-2 text-xl font-bold text-red-800">
              🛡️ ARMOR CLASS
            </h3>
            <div className="mb-2 text-5xl font-bold text-red-900">
              {calculateCharacterArmorClass(character)}
            </div>
            <div className="text-base font-medium text-red-700">Total AC</div>
          </div>

          {/* AC Components - Row Layout with Better Alignment */}
          <div className="mb-6 space-y-4">
            {/* Base AC Row */}
            <div className="rounded-lg border-2 border-red-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <div className="text-lg font-bold text-red-800">Base AC</div>
                  <Tooltip content="From armor & dexterity modifier">
                    <button
                      type="button"
                      className="text-red-400 transition-colors hover:text-red-600"
                    >
                      <Info size={16} />
                    </button>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={baseACInput}
                  onChange={e => handleBaseACChange(e.target.value)}
                  onBlur={handleBaseACBlur}
                  className="h-12 w-20 [appearance:textfield] border-2 border-red-300 bg-red-50 text-center text-2xl font-bold text-red-900 focus:border-red-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min="0"
                  max="30"
                />
              </div>
            </div>

            {/* Temporary AC Row */}
            <div className="rounded-lg border-2 border-orange-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <div className="text-lg font-bold text-orange-800">
                    Temp AC
                  </div>
                  <Tooltip content="Bonuses from spells & temporary magical effects">
                    <button
                      type="button"
                      className="text-orange-400 transition-colors hover:text-orange-600"
                    >
                      <Info size={16} />
                    </button>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={tempACInput}
                  onChange={e => handleTempACChange(e.target.value)}
                  onBlur={handleTempACBlur}
                  className="h-12 w-20 [appearance:textfield] border-2 border-orange-300 bg-orange-50 text-center text-2xl font-bold text-orange-900 focus:border-orange-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min="0"
                  max="20"
                />
              </div>
              {character.tempArmorClass > 0 && (
                <div className="mt-2 flex justify-end pr-4">
                  <Button
                    onClick={onResetTempArmorClass}
                    variant="ghost"
                    size="xs"
                    className="border border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-800"
                  >
                    Reset
                  </Button>
                </div>
              )}
            </div>

            {/* Shield Row */}
            <div
              className={`rounded-lg border-2 bg-white p-4 shadow-sm transition-all duration-200 ${
                character.isWearingShield
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-blue-300 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onToggleShield}
                  className="flex min-w-[140px] items-center gap-1.5 transition-opacity hover:opacity-80"
                  title={`${character.isWearingShield ? 'Unequip' : 'Equip'} shield`}
                >
                  <div
                    className={`flex items-center gap-2 text-lg font-bold ${
                      character.isWearingShield
                        ? 'text-blue-700'
                        : 'text-blue-800'
                    }`}
                  >
                    <span>Shield +</span>
                    {character.isWearingShield && (
                      <span className="text-2xl">🛡️</span>
                    )}
                  </div>
                  <Tooltip content="Click to equip/unequip shield. Adjust bonus when equipped.">
                    <button
                      type="button"
                      onClick={e => e.stopPropagation()}
                      className="text-blue-400 transition-colors hover:text-blue-600"
                    >
                      <Info size={16} />
                    </button>
                  </Tooltip>
                </button>
                <Input
                  type="number"
                  value={shieldBonusInput}
                  onChange={e => handleShieldBonusChange(e.target.value)}
                  onBlur={handleShieldBonusBlur}
                  disabled={!character.isWearingShield}
                  className={`h-12 w-20 [appearance:textfield] border-2 text-center text-2xl font-bold focus:border-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    character.isWearingShield
                      ? 'border-blue-300 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}
                  min="0"
                  max="5"
                />
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
    </TooltipProvider>
  );
}
