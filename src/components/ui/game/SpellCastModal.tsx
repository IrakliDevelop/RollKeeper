'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Sparkles } from 'lucide-react';
import { Spell, SpellSlots, ConcentrationState } from '@/types/character';

interface SpellCastModalProps {
  isOpen: boolean;
  onClose: () => void;
  spell: Spell;
  spellSlots: SpellSlots;
  concentration: ConcentrationState;
  onCastSpell: (spellLevel: number) => void;
}

export function SpellCastModal({ 
  isOpen, 
  onClose, 
  spell, 
  spellSlots, 
  concentration, 
  onCastSpell 
}: SpellCastModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  // Get available spell levels (spell's base level and higher)
  const availableLevels = [];
  for (let level = Math.max(1, spell.level); level <= 9; level++) {
    const slot = spellSlots[level as keyof SpellSlots];
    if (slot.max > 0 && slot.used < slot.max) {
      availableLevels.push(level);
    }
  }

  // Set default selected level when modal opens
  React.useEffect(() => {
    if (isOpen && spell.level === 0) {
      setSelectedLevel(0); // Cantrips
    } else if (isOpen && availableLevels.length > 0) {
      setSelectedLevel(spell.level); // Default to base level
    } else {
      setSelectedLevel(null);
    }
  }, [isOpen, spell.level, availableLevels.length]);

  if (!isOpen) return null;

  // Check if this is a concentration spell and if already concentrating
  const isConcentrationSpell = spell.concentration;
  const alreadyConcentrating = concentration.isConcentrating;
  const concentrationWarning = isConcentrationSpell && alreadyConcentrating;

  const handleCast = () => {
    if (selectedLevel !== null) {
      onCastSpell(selectedLevel);
      onClose();
      setSelectedLevel(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      setSelectedLevel(null);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedLevel(null);
  };

  const canCast = selectedLevel !== null && (
    spell.level === 0 || // Cantrips can always be cast
    availableLevels.includes(selectedLevel) // Or if we have the required slot
  );

  return (
    <div 
      className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Cast Spell</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Spell Info */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-purple-900 mb-1">{spell.name}</h3>
            <div className="flex items-center justify-center gap-2 text-sm text-purple-600">
              <span>{spell.school}</span>
              <span>•</span>
              <span>{spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</span>
              {spell.concentration && (
                <>
                  <span>•</span>
                  <span className="text-orange-600 font-medium">Concentration</span>
                </>
              )}
            </div>
          </div>

          {/* Concentration Warning */}
          {concentrationWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-sm">
                <p className="font-medium text-amber-800 mb-1">Concentration Warning</p>
                <p className="text-amber-700">
                  You are currently concentrating on <span className="font-medium">{concentration.spellName}</span>. 
                  Casting this spell will end your concentration on the previous spell.
                </p>
              </div>
            </div>
          )}

          {/* Cantrip Cast */}
          {spell.level === 0 ? (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">Cantrips don&apos;t use spell slots.</p>
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="font-medium text-purple-900">Cantrip Selected</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* No Available Slots */}
              {availableLevels.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-2">No available spell slots to cast this spell.</p>
                  <p className="text-sm text-gray-500">
                    You need at least a level {spell.level} spell slot.
                  </p>
                </div>
              ) : (
                <>
                  {/* Level Selection */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Choose spell slot level:</h4>
                    <div className="space-y-2">
                      {availableLevels.map((level) => {
                        const slot = spellSlots[level as keyof SpellSlots];
                        const available = slot.max - slot.used;
                        const isMinLevel = level === spell.level;
                        const isSelected = selectedLevel === level;
                        
                        return (
                          <button
                            key={level}
                            onClick={() => setSelectedLevel(level)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-purple-500 bg-purple-100 shadow-md'
                                : isMinLevel 
                                  ? 'border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100'
                                  : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                isSelected 
                                  ? 'bg-purple-600' 
                                  : isMinLevel 
                                    ? 'bg-purple-400' 
                                    : 'bg-slate-400'
                              }`}></div>
                              <span className={`font-medium ${
                                isSelected 
                                  ? 'text-purple-900' 
                                  : isMinLevel 
                                    ? 'text-purple-800' 
                                    : 'text-slate-700'
                              }`}>
                                Level {level}
                                {isMinLevel && (
                                  <span className={isSelected ? 'text-purple-700' : 'text-purple-600'}>
                                    {' '}(Base Level)
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className={`text-sm ${
                              isSelected 
                                ? 'text-purple-700' 
                                : isMinLevel 
                                  ? 'text-purple-600' 
                                  : 'text-slate-600'
                            }`}>
                              {available}/{slot.max} available
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Higher Level Effects */}
                  {spell.higherLevel && selectedLevel && selectedLevel > spell.level && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h5 className="font-medium text-blue-900 mb-2">At Higher Levels</h5>
                      <p className="text-sm text-blue-800">{spell.higherLevel}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          
          {canCast && (
            <button
              onClick={handleCast}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-violet-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Cast {spell.name}
              {selectedLevel !== null && selectedLevel > 0 && (
                <span className="ml-1 text-purple-200">
                  (Level {selectedLevel})
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 