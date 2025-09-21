'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import SimpleClassSelector from '@/components/ui/character/SimpleClassSelector';
import MulticlassManager from '@/components/ui/character/MulticlassManager';
import { ALIGNMENTS } from '@/utils/constants';
import { CharacterState } from '@/types/character';

interface CharacterBasicInfoProps {
  character: CharacterState;
  race: string;
  characterClass: CharacterState['class'];
  level: number;
  background: string;
  playerName: string;
  alignment: string;
  onUpdateRace: (race: string) => void;
  onUpdateClass: (characterClass: CharacterState['class']) => void;
  onUpdateLevel: (level: number) => void;
  onUpdateBackground: (background: string) => void;
  onUpdatePlayerName: (playerName: string) => void;
  onUpdateAlignment: (alignment: string) => void;
  // Multiclass methods
  onAddClassLevel: (
    className: string,
    isCustom?: boolean,
    spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none',
    hitDie?: number,
    subclass?: string
  ) => void;
  onRemoveClassLevel: (className: string) => void;
  onUpdateClassLevel: (className: string, newLevel: number) => void;
  getClassDisplayString: () => string;
}

export default function CharacterBasicInfo({
  character,
  race,
  characterClass,
  level,
  background,
  playerName,
  alignment,
  onUpdateRace,
  onUpdateClass,
  onUpdateLevel,
  onUpdateBackground,
  onUpdatePlayerName,
  onUpdateAlignment,
  onAddClassLevel,
  onRemoveClassLevel,
  onUpdateClassLevel,
  getClassDisplayString,
}: CharacterBasicInfoProps) {
  const [showMulticlassManager, setShowMulticlassManager] = useState(false);
  
  const isMulticlassed = (character.classes?.length || 0) > 1;
  const classDisplayString = getClassDisplayString();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
          Character Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Race
            </label>
            <input
              type="text"
              placeholder="Human"
              value={race}
              onChange={e => onUpdateRace(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Class Display - Show multiclass info or single class selector */}
          {isMulticlassed ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Classes
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-gray-300 bg-gray-50 p-2 text-gray-800">
                  {classDisplayString}
                </div>
                <button
                  onClick={() => setShowMulticlassManager(!showMulticlassManager)}
                  className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Manage multiclass levels"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <SimpleClassSelector value={characterClass} onChange={onUpdateClass} />
            </div>
          )}

          {/* Multiclass Settings Button - Separate row for single class */}
          {!isMulticlassed && (
            <div className="sm:col-span-2">
              <button
                onClick={() => setShowMulticlassManager(!showMulticlassManager)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Settings size={16} />
                Manage Multiclassing
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Level
            </label>
            <input
              type="number"
              placeholder="1"
              min="1"
              max="20"
              value={level}
              onChange={e => onUpdateLevel(parseInt(e.target.value) || 1)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Background
            </label>
            <input
              type="text"
              placeholder="Soldier"
              value={background}
              onChange={e => onUpdateBackground(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Player Name
            </label>
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={e => onUpdatePlayerName(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alignment
            </label>
            <select
              value={alignment}
              onChange={e => onUpdateAlignment(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              {ALIGNMENTS.map(alignment => (
                <option key={alignment} value={alignment}>
                  {alignment}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Multiclass Manager */}
      {showMulticlassManager && (
        <MulticlassManager
          character={character}
          onAddClassLevel={onAddClassLevel}
          onRemoveClassLevel={onRemoveClassLevel}
          onUpdateClassLevel={onUpdateClassLevel}
        />
      )}
    </div>
  );
}
