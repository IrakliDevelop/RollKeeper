'use client';

import ClassSelector from "@/components/ui/character/ClassSelector";
import { ALIGNMENTS } from "@/utils/constants";
import { CharacterState } from "@/types/character";

interface CharacterBasicInfoProps {
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
}

export default function CharacterBasicInfo({
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
  onUpdateAlignment
}: CharacterBasicInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
        Character Information
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Race</label>
          <input 
            type="text" 
            placeholder="Human"
            value={race}
            onChange={(e) => onUpdateRace(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
          />
        </div>
        <ClassSelector
          value={characterClass}
          onChange={onUpdateClass}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
          <input 
            type="number" 
            placeholder="1"
            min="1" 
            max="20"
            value={level}
            onChange={(e) => onUpdateLevel(parseInt(e.target.value) || 1)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
          <input 
            type="text" 
            placeholder="Soldier"
            value={background}
            onChange={(e) => onUpdateBackground(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
          <input 
            type="text" 
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => onUpdatePlayerName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
          <select 
            value={alignment}
            onChange={(e) => onUpdateAlignment(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          >
            <option value="">Select...</option>
            {ALIGNMENTS.map(alignment => (
              <option key={alignment} value={alignment}>{alignment}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
