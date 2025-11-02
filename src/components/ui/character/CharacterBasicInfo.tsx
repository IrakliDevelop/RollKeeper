'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import SimpleClassSelector from '@/components/ui/character/SimpleClassSelector';
import MulticlassManager from '@/components/ui/character/MulticlassManager';
import { Button, Input } from '@/components/ui/forms';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
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
            <Input
              label="Race"
              type="text"
              placeholder="Human"
              value={race}
              onChange={e => onUpdateRace(e.target.value)}
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
                <Button
                  onClick={() => setShowMulticlassManager(!showMulticlassManager)}
                  variant="primary"
                  size="sm"
                  leftIcon={<Settings size={16} />}
                  title="Manage multiclass levels"
                  className="px-2"
                />
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
              <Button
                onClick={() => setShowMulticlassManager(!showMulticlassManager)}
                variant="outline"
                size="md"
                leftIcon={<Settings size={16} />}
                fullWidth
                className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                Manage Multiclassing
              </Button>
            </div>
          )}

          <div>
            <Input
              label="Level"
              type="number"
              placeholder="1"
              min="1"
              max="20"
              value={level.toString()}
              onChange={e => onUpdateLevel(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Input
              label="Background"
              type="text"
              placeholder="Soldier"
              value={background}
              onChange={e => onUpdateBackground(e.target.value)}
            />
          </div>
          <div>
            <Input
              label="Player Name"
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={e => onUpdatePlayerName(e.target.value)}
            />
          </div>
          <div>
            <SelectField
              label="Alignment"
              value={alignment}
              onValueChange={onUpdateAlignment}
            >
              {ALIGNMENTS.map(align => (
                <SelectItem key={align} value={align}>
                  {align}
                </SelectItem>
              ))}
            </SelectField>
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
