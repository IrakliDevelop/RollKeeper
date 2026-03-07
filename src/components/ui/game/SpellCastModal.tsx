'use client';

import React, { useState } from 'react';
import { AlertTriangle, Sparkles, Zap, Infinity } from 'lucide-react';
import { Spell, SpellSlots, ConcentrationState } from '@/types/character';
import { Modal } from '@/components/ui/feedback/Modal';

interface SpellCastModalProps {
  isOpen: boolean;
  onClose: () => void;
  spell: Spell;
  spellSlots: SpellSlots;
  concentration: ConcentrationState;
  onCastSpell: (spellLevel: number, useFreecast: boolean) => void;
}

export function SpellCastModal({
  isOpen,
  onClose,
  spell,
  spellSlots,
  concentration,
  onCastSpell,
}: SpellCastModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [useFreecast, setUseFreecast] = useState(false);

  const isAtWill = spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;
  const hasFreeCasting = isAtWill || isInnate;
  const freeCastsRemaining = isInnate
    ? spell.freeCastMax! - (spell.freeCastsUsed || 0)
    : 0;
  const canFreecast = isAtWill || (isInnate && freeCastsRemaining > 0);

  const availableLevels = [];
  for (let level = Math.max(1, spell.level); level <= 9; level++) {
    const slot = spellSlots[level as keyof SpellSlots];
    if (slot.max > 0 && slot.used < slot.max) {
      availableLevels.push(level);
    }
  }

  React.useEffect(() => {
    if (!isOpen) return;
    if (spell.level === 0) {
      setSelectedLevel(0);
      setUseFreecast(false);
    } else if (canFreecast) {
      setSelectedLevel(spell.level);
      setUseFreecast(true);
    } else if (availableLevels.length > 0) {
      setSelectedLevel(spell.level);
      setUseFreecast(false);
    } else {
      setSelectedLevel(null);
      setUseFreecast(false);
    }
  }, [
    isOpen,
    spell.level,
    spell.freeCastMax,
    canFreecast,
    availableLevels.length,
  ]);

  if (!isOpen) return null;

  const isConcentrationSpell = spell.concentration;
  const alreadyConcentrating = concentration.isConcentrating;
  const concentrationWarning = isConcentrationSpell && alreadyConcentrating;

  const handleCast = () => {
    if (selectedLevel !== null) {
      onCastSpell(selectedLevel, useFreecast);
      onClose();
      setSelectedLevel(null);
      setUseFreecast(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedLevel(null);
    setUseFreecast(false);
  };

  const handleSelectFreecast = () => {
    setUseFreecast(true);
    setSelectedLevel(spell.level);
  };

  const handleSelectSlot = (level: number) => {
    setUseFreecast(false);
    setSelectedLevel(level);
  };

  const canCast =
    selectedLevel !== null &&
    (spell.level === 0 ||
      useFreecast ||
      availableLevels.includes(selectedLevel));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cast Spell"
      size="md"
      closeOnBackdropClick={true}
    >
      <div className="space-y-4">
        {/* Spell Info */}
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Sparkles className="text-purple-600" size={20} />
          </div>
          <h3 className="mb-1 text-xl font-bold text-purple-900">
            {spell.name}
          </h3>
          <div className="flex items-center justify-center gap-2 text-sm text-purple-600">
            <span>{spell.school}</span>
            <span>&bull;</span>
            <span>
              {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
            </span>
            {spell.concentration && (
              <>
                <span>&bull;</span>
                <span className="font-medium text-orange-600">
                  Concentration
                </span>
              </>
            )}
          </div>
          {spell.castingSource && (
            <div className="mt-1 text-xs text-purple-500">
              Source: {spell.castingSource}
            </div>
          )}
        </div>

        {/* Concentration Warning */}
        {concentrationWarning && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle
              className="mt-0.5 flex-shrink-0 text-amber-600"
              size={16}
            />
            <div className="text-sm">
              <p className="mb-1 font-medium text-amber-800">
                Concentration Warning
              </p>
              <p className="text-amber-700">
                You are currently concentrating on{' '}
                <span className="font-medium">{concentration.spellName}</span>.
                Casting this spell will end your concentration on the previous
                spell.
              </p>
            </div>
          </div>
        )}

        {/* Cantrip Cast */}
        {spell.level === 0 ? (
          <div className="text-center">
            <p className="mb-4 text-sm text-gray-600">
              Cantrips don&apos;t use spell slots.
            </p>
            <div className="mb-4 rounded-lg border-2 border-purple-300 bg-purple-50 p-3">
              <div className="flex items-center justify-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                <span className="font-medium text-purple-900">
                  Cantrip Selected
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Free Cast Option */}
            {hasFreeCasting && (
              <div>
                <h4 className="mb-3 font-medium text-gray-900">
                  {isAtWill ? 'At-Will Casting:' : 'Innate Casting:'}
                </h4>
                <button
                  onClick={handleSelectFreecast}
                  disabled={!canFreecast}
                  className={`flex w-full items-center justify-between rounded-lg border-2 p-3 transition-all duration-200 ${
                    useFreecast
                      ? 'border-emerald-500 bg-emerald-100 shadow-md'
                      : canFreecast
                        ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100'
                        : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        useFreecast
                          ? 'bg-emerald-600 text-white'
                          : canFreecast
                            ? 'bg-emerald-400 text-white'
                            : 'bg-gray-300 text-gray-500'
                      }`}
                    >
                      {isAtWill ? <Infinity size={14} /> : <Zap size={14} />}
                    </div>
                    <span
                      className={`font-medium ${
                        useFreecast
                          ? 'text-emerald-900'
                          : canFreecast
                            ? 'text-emerald-800'
                            : 'text-gray-500'
                      }`}
                    >
                      Cast free (no slot)
                      {isAtWill && (
                        <span className="ml-1 text-emerald-600">
                          &mdash; At Will
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className={`text-sm ${
                      useFreecast
                        ? 'text-emerald-700'
                        : canFreecast
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                    }`}
                  >
                    {isAtWill
                      ? 'Unlimited'
                      : `${freeCastsRemaining}/${spell.freeCastMax} remaining`}
                  </span>
                </button>
                {isInnate && freeCastsRemaining <= 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Free casts exhausted. Use a spell slot or take a long rest.
                  </p>
                )}
              </div>
            )}

            {/* Slot-Based Casting */}
            {availableLevels.length === 0 && !canFreecast ? (
              <div className="py-4 text-center">
                <p className="mb-2 text-gray-600">
                  No available spell slots to cast this spell.
                </p>
                <p className="text-sm text-gray-500">
                  You need at least a level {spell.level} spell slot.
                </p>
              </div>
            ) : (
              availableLevels.length > 0 && (
                <div>
                  <h4 className="mb-3 font-medium text-gray-900">
                    {hasFreeCasting
                      ? 'Or use a spell slot:'
                      : 'Choose spell slot level:'}
                  </h4>
                  <div className="space-y-2">
                    {availableLevels.map(level => {
                      const slot = spellSlots[level as keyof SpellSlots];
                      const available = slot.max - slot.used;
                      const isMinLevel = level === spell.level;
                      const isSelected =
                        !useFreecast && selectedLevel === level;

                      return (
                        <button
                          key={level}
                          onClick={() => handleSelectSlot(level)}
                          className={`flex w-full items-center justify-between rounded-lg border-2 p-3 transition-all duration-200 ${
                            isSelected
                              ? 'border-purple-500 bg-purple-100 shadow-md'
                              : isMinLevel
                                ? 'border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100'
                                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-3 w-3 rounded-full ${
                                isSelected
                                  ? 'bg-purple-600'
                                  : isMinLevel
                                    ? 'bg-purple-400'
                                    : 'bg-slate-400'
                              }`}
                            ></div>
                            <span
                              className={`font-medium ${
                                isSelected
                                  ? 'text-purple-900'
                                  : isMinLevel
                                    ? 'text-purple-800'
                                    : 'text-slate-700'
                              }`}
                            >
                              Level {level}
                              {isMinLevel && (
                                <span
                                  className={
                                    isSelected
                                      ? 'text-purple-700'
                                      : 'text-purple-600'
                                  }
                                >
                                  {' '}
                                  (Base Level)
                                </span>
                              )}
                            </span>
                          </div>
                          <span
                            className={`text-sm ${
                              isSelected
                                ? 'text-purple-700'
                                : isMinLevel
                                  ? 'text-purple-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {available}/{slot.max} available
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Higher Level Effects */}
            {spell.higherLevel &&
              selectedLevel &&
              !useFreecast &&
              selectedLevel > spell.level && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <h5 className="mb-2 font-medium text-blue-900">
                    At Higher Levels
                  </h5>
                  <p className="text-sm text-blue-800">{spell.higherLevel}</p>
                </div>
              )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800"
        >
          Cancel
        </button>

        {canCast && (
          <button
            onClick={handleCast}
            className={`rounded-lg px-6 py-2 font-medium text-white shadow-md transition-all duration-200 hover:shadow-lg ${
              useFreecast
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
            }`}
          >
            {useFreecast ? 'Cast Free' : 'Cast'} {spell.name}
            {selectedLevel !== null && selectedLevel > 0 && !useFreecast && (
              <span className="ml-1 text-purple-200">
                (Level {selectedLevel})
              </span>
            )}
          </button>
        )}
      </div>
    </Modal>
  );
}
