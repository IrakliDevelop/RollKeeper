'use client';

import { calculateCharacterArmorClass } from '@/utils/calculations';
import { Input } from '@/components/ui/forms';
import { CharacterState } from '@/types/character';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ArmorClassManagerProps {
  character: CharacterState;
  onUpdateArmorClass: (ac: number) => void;
  onUpdateTempArmorClass: (tempAC: number) => void;
  onToggleShield: () => void;
  onUpdateShieldBonus: (bonus: number) => void;
}

export default function ArmorClassManager({
  character,
  onUpdateArmorClass,
  onUpdateTempArmorClass,
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
  const [isTempACActive, setIsTempACActive] = useState(
    character.tempArmorClass > 0
  );

  // Update local state when character data changes externally
  useEffect(() => {
    setBaseACInput(character.armorClass.toString());
  }, [character.armorClass]);

  useEffect(() => {
    setTempACInput(character.tempArmorClass.toString());
    setIsTempACActive(character.tempArmorClass > 0);
  }, [character.tempArmorClass]);

  useEffect(() => {
    setShieldBonusInput(character.shieldBonus.toString());
  }, [character.shieldBonus]);

  // Handlers for Base AC
  const handleBaseACChange = (value: string) => {
    setBaseACInput(value);
  };

  const handleBaseACBlur = () => {
    const numValue = parseInt(baseACInput);
    const finalValue = isNaN(numValue) ? 10 : numValue;
    const clampedValue = Math.max(0, Math.min(30, finalValue));
    setBaseACInput(clampedValue.toString());
    onUpdateArmorClass(clampedValue);
  };

  const handleBaseACKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Handlers for Temp AC
  const handleTempACChange = (value: string) => {
    setTempACInput(value);
  };

  const handleTempACBlur = () => {
    const numValue = parseInt(tempACInput);
    const finalValue = isNaN(numValue) ? 0 : numValue;
    const clampedValue = Math.max(0, Math.min(20, finalValue));
    setTempACInput(clampedValue.toString());
    onUpdateTempArmorClass(clampedValue);
    if (clampedValue === 0) {
      setIsTempACActive(false);
    }
  };

  const handleTempACKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleToggleTempAC = () => {
    if (isTempACActive) {
      // Deactivating - reset to 0
      setTempACInput('0');
      onUpdateTempArmorClass(0);
      setIsTempACActive(false);
    } else {
      // Activating - set to 1 or keep current value
      const currentValue = parseInt(tempACInput) || 0;
      if (currentValue === 0) {
        setTempACInput('1');
        onUpdateTempArmorClass(1);
      }
      setIsTempACActive(true);
    }
  };

  // Handlers for Shield Bonus
  const handleShieldBonusChange = (value: string) => {
    setShieldBonusInput(value);
  };

  const handleShieldBonusBlur = () => {
    const numValue = parseInt(shieldBonusInput);
    const finalValue = isNaN(numValue) ? 2 : numValue;
    const clampedValue = Math.max(0, Math.min(5, finalValue));
    setShieldBonusInput(clampedValue.toString());
    onUpdateShieldBonus(clampedValue);
  };

  const handleShieldBonusKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <TooltipProvider>
      <div className="mb-6">
        <div className="border-accent-red-border rounded-xl border-2 bg-gradient-to-r from-[var(--gradient-red-from)] to-[var(--gradient-red-to)] p-6">
          <div className="mb-6 text-center">
            <h3 className="text-accent-red-text mb-3 flex items-center justify-center gap-2 text-xl font-bold">
              🛡️ ARMOR CLASS
            </h3>
            <div className="text-accent-red-text mb-2 text-5xl font-bold">
              {calculateCharacterArmorClass(character)}
            </div>
            <div className="text-accent-red-text-muted text-base font-medium">
              Total AC
            </div>
          </div>

          {/* AC Components - Row Layout with Better Alignment */}
          <div className="mb-6 space-y-4">
            {/* Base AC Row */}
            <div className="border-accent-red-border-strong bg-surface-raised rounded-lg border-2 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <div className="text-accent-red-text text-lg font-bold">
                    Base AC
                  </div>
                  <Tooltip content="From armor & dexterity modifier">
                    <span className="text-accent-red-text-muted hover:text-accent-red-text cursor-help transition-colors">
                      <Info size={16} />
                    </span>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={baseACInput}
                  onChange={e => handleBaseACChange(e.target.value)}
                  onBlur={handleBaseACBlur}
                  onKeyDown={handleBaseACKeyDown}
                  className="border-accent-red-border-strong bg-accent-red-bg text-accent-red-text focus:border-accent-red-text-muted h-12 w-20 [appearance:textfield] border-2 text-center text-2xl font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  min="0"
                  max="30"
                />
              </div>
            </div>

            {/* Temporary AC Row */}
            <div
              className={`bg-surface-raised rounded-lg border-2 p-4 shadow-sm transition-all duration-200 ${
                isTempACActive
                  ? 'bg-accent-orange-bg border-orange-500'
                  : 'border-accent-orange-border hover:border-orange-400'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <Tooltip
                    content={`Click to ${isTempACActive ? 'deactivate and reset' : 'activate'} temporary AC`}
                  >
                    <button
                      type="button"
                      onClick={handleToggleTempAC}
                      className={`flex items-center gap-2 text-lg font-bold transition-opacity hover:opacity-80 ${
                        isTempACActive ? 'text-orange-700' : 'text-orange-800'
                      }`}
                    >
                      <span>Temp AC</span>
                      {/* {isTempACActive && <span className="text-xl">✨</span>} */}
                    </button>
                  </Tooltip>
                  <Tooltip content="Bonuses from spells & temporary magical effects">
                    <span className="cursor-help text-orange-400 transition-colors hover:text-orange-600">
                      <Info size={16} />
                    </span>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={tempACInput}
                  onChange={e => handleTempACChange(e.target.value)}
                  onBlur={handleTempACBlur}
                  onKeyDown={handleTempACKeyDown}
                  disabled={!isTempACActive}
                  className={`h-12 w-20 [appearance:textfield] border-2 text-center text-2xl font-bold focus:border-orange-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    isTempACActive
                      ? 'border-accent-orange-border bg-accent-orange-bg text-accent-orange-text'
                      : 'border-divider bg-surface-secondary text-faint'
                  }`}
                  min="0"
                  max="20"
                />
              </div>
            </div>

            {/* Shield Row */}
            <div
              className={`bg-surface-raised rounded-lg border-2 p-4 shadow-sm transition-all duration-200 ${
                character.isWearingShield
                  ? 'border-accent-blue-border-strong bg-accent-blue-bg'
                  : 'border-accent-blue-border-strong hover:border-accent-blue-text-muted'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <Tooltip
                    content={`Click to ${character.isWearingShield ? 'unequip' : 'equip'} shield`}
                  >
                    <button
                      type="button"
                      onClick={onToggleShield}
                      className={`flex items-center gap-2 text-lg font-bold transition-opacity hover:opacity-80 ${
                        character.isWearingShield
                          ? 'text-blue-700'
                          : 'text-blue-800'
                      }`}
                    >
                      <span>Shield +</span>
                      {/* {character.isWearingShield && (
                        <span className="text-2xl">🛡️</span>
                      )} */}
                    </button>
                  </Tooltip>
                  <Tooltip content="Shield bonus to AC (typically +2, or more for magical shields)">
                    <span className="cursor-help text-blue-400 transition-colors hover:text-blue-600">
                      <Info size={16} />
                    </span>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  value={shieldBonusInput}
                  onChange={e => handleShieldBonusChange(e.target.value)}
                  onBlur={handleShieldBonusBlur}
                  onKeyDown={handleShieldBonusKeyDown}
                  disabled={!character.isWearingShield}
                  className={`h-12 w-20 [appearance:textfield] border-2 text-center text-2xl font-bold focus:border-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    character.isWearingShield
                      ? 'border-accent-blue-border-strong bg-accent-blue-bg text-accent-blue-text'
                      : 'border-divider bg-surface-secondary text-faint'
                  }`}
                  min="0"
                  max="5"
                />
              </div>
            </div>
          </div>

          {/* AC Formula Display */}
          <div className="text-center">
            <div className="border-accent-red-border-strong bg-surface-raised text-accent-red-text inline-flex items-center gap-3 rounded-lg border-2 px-6 py-3 text-lg font-medium shadow-sm">
              <span className="text-xl font-bold">{character.armorClass}</span>
              <span className="text-accent-red-text-muted text-lg">+</span>
              <span className="text-xl font-bold">
                {character.tempArmorClass}
              </span>
              {character.isWearingShield && (
                <>
                  <span className="text-accent-red-text-muted text-lg">+</span>
                  <span className="text-xl font-bold">
                    {character.shieldBonus}
                  </span>
                </>
              )}
              <span className="text-accent-red-text-muted text-lg">=</span>
              <span className="text-accent-red-text text-2xl font-bold">
                {calculateCharacterArmorClass(character)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
