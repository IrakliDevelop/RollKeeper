'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Dice6 } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { COMMON_CLASSES, DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import { FancySelect } from '@/components/ui/forms/FancySelect';

export default function NewCharacterPage() {
  const router = useRouter();
  const { createCharacter } = usePlayerStore();
  
  const [characterName, setCharacterName] = useState('');
  const [selectedRace, setSelectedRace] = useState('Human');
  const [selectedClass, setSelectedClass] = useState('Fighter');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      if (!characterName.trim()) {
        alert('Please enter a character name');
        setIsCreating(false);
        return;
      }

      // Create partial character data with the selected options
      const partialCharacterData = {
        ...DEFAULT_CHARACTER_STATE,
        characterName: characterName.trim(),
        race: selectedRace,
        classInfo: {
          name: selectedClass,
          hitDie: 'd8',
          primaryAbility: 'strength',
          savingThrowProficiencies:  [],
          skillOptions: [],
          armorProficiencies: [],
          weaponProficiencies: [],
          spellcasting: null
        },
        playerName: playerName.trim() || 'Player',
        level: 1
      };

      const characterId = createCharacter(characterName.trim(), partialCharacterData);
      
      // Navigate to the new character sheet
      router.push(`/player/characters/${characterId}`);
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const rollStats = () => {
    // Future: implement ability score rolling
    alert('Ability score rolling will be available in the character sheet!');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/player" className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors mr-6">
                <ArrowLeft size={20} />
                Back to Characters
              </Link>
              <h1 className="text-xl font-bold text-slate-800">Create New Character</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <Dice6 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Your Character</h1>
            <p className="text-slate-600">
              Fill in the basic information to get started. You can customize everything else in the character sheet.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Character Name */}
              <div className="md:col-span-2">
                <label htmlFor="characterName" className="block text-sm font-medium text-slate-700 mb-2">
                  Character Name *
                </label>
                <input
                  type="text"
                  id="characterName"
                  required
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Thorin Ironbeard"
                />
              </div>

              {/* Race */}
              <div>
                <label htmlFor="race" className="block text-sm font-medium text-slate-700 mb-2">
                  Race
                </label>
                <FancySelect
                  options={[
                    { value: 'Human', label: 'Human' },
                    { value: 'Elf', label: 'Elf' },
                    { value: 'Dwarf', label: 'Dwarf' },
                    { value: 'Halfling', label: 'Halfling' },
                    { value: 'Dragonborn', label: 'Dragonborn' },
                    { value: 'Gnome', label: 'Gnome' },
                    { value: 'Half-Elf', label: 'Half-Elf' },
                    { value: 'Half-Orc', label: 'Half-Orc' },
                    { value: 'Tiefling', label: 'Tiefling' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  value={selectedRace}
                  onChange={(selectedValue) => setSelectedRace(selectedValue as string)}
                  placeholder="Select a race..."
                  color="blue"
                />
              </div>

              {/* Class */}
              <div>
                <label htmlFor="class" className="block text-sm font-medium text-slate-700 mb-2">
                  Class
                </label>
                <FancySelect
            options={[
              { value: '', label: 'Select a class...' },
              ...COMMON_CLASSES.map((classData) => ({
                value: classData.name,
                label: classData.name,
                description: classData.spellcaster !== 'none' ? 
                  `${classData.spellcaster === 'full' ? 'Full' : 
                     classData.spellcaster === 'half' ? 'Half' : 
                     classData.spellcaster === 'third' ? '1/3' : 
                     'Pact'} Caster` : 'Non-spellcaster'
              }))
            ]}
            value={selectedClass}
            onChange={(selectedValue) => setSelectedClass(selectedValue as string)}
            placeholder="Select a class..."
            color="blue"
          />
              </div>

              {/* Player Name */}
              <div className="md:col-span-2">
                <label htmlFor="playerName" className="block text-sm font-medium text-slate-700 mb-2">
                  Player Name
                </label>
                <input
                  type="text"
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Character Preview */}
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-slate-800 mb-4">Character Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Name:</span>
                  <p className="font-medium text-slate-800">{characterName || 'Character Name'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Race:</span>
                  <p className="font-medium text-slate-800">{selectedRace}</p>
                </div>
                <div>
                  <span className="text-slate-500">Class:</span>
                  <p className="font-medium text-slate-800">{selectedClass}</p>
                </div>
                <div>
                  <span className="text-slate-500">Level:</span>
                  <p className="font-medium text-slate-800">1</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={rollStats}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                <Dice6 size={16} />
                Quick Roll Stats
              </button>
              
              <div className="flex space-x-4">
                <Link
                  href="/player"
                  className="px-6 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isCreating || !characterName.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={16} />
                  {isCreating ? 'Creating...' : 'Create Character'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
