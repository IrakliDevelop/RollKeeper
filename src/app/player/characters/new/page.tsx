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
          savingThrowProficiencies: [],
          skillOptions: [],
          armorProficiencies: [],
          weaponProficiencies: [],
          spellcasting: null,
        },
        playerName: playerName.trim() || 'Player',
        level: 1,
      };

      const characterId = createCharacter(
        characterName.trim(),
        partialCharacterData
      );

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
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link
                href="/player"
                className="mr-6 flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
              >
                <ArrowLeft size={20} />
                Back to Characters
              </Link>
              <h1 className="text-xl font-bold text-slate-800">
                Create New Character
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="mb-8 text-center">
            <Dice6 className="mx-auto mb-4 h-16 w-16 text-blue-600" />
            <h1 className="mb-2 text-3xl font-bold text-slate-800">
              Create Your Character
            </h1>
            <p className="text-slate-600">
              Fill in the basic information to get started. You can customize
              everything else in the character sheet.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Character Name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="characterName"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Character Name *
                </label>
                <input
                  type="text"
                  id="characterName"
                  required
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g., Thorin Ironbeard"
                />
              </div>

              {/* Race */}
              <div>
                <label
                  htmlFor="race"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
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
                    { value: 'Other', label: 'Other' },
                  ]}
                  value={selectedRace}
                  onChange={selectedValue =>
                    setSelectedRace(selectedValue as string)
                  }
                  placeholder="Select a race..."
                  color="blue"
                />
              </div>

              {/* Class */}
              <div>
                <label
                  htmlFor="class"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Class
                </label>
                <FancySelect
                  options={[
                    { value: '', label: 'Select a class...' },
                    ...COMMON_CLASSES.map(classData => ({
                      value: classData.name,
                      label: classData.name,
                      description:
                        classData.spellcaster !== 'none'
                          ? `${
                              classData.spellcaster === 'full'
                                ? 'Full'
                                : classData.spellcaster === 'half'
                                  ? 'Half'
                                  : classData.spellcaster === 'third'
                                    ? '1/3'
                                    : 'Pact'
                            } Caster`
                          : 'Non-spellcaster',
                    })),
                  ]}
                  value={selectedClass}
                  onChange={selectedValue =>
                    setSelectedClass(selectedValue as string)
                  }
                  placeholder="Select a class..."
                  color="blue"
                />
              </div>

              {/* Player Name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="playerName"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Player Name
                </label>
                <input
                  type="text"
                  id="playerName"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Character Preview */}
            <div className="rounded-lg bg-slate-50 p-6">
              <h3 className="mb-4 text-lg font-medium text-slate-800">
                Character Preview
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <span className="text-slate-500">Name:</span>
                  <p className="font-medium text-slate-800">
                    {characterName || 'Character Name'}
                  </p>
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
            <div className="flex items-center justify-between border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={rollStats}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 transition-colors hover:text-slate-800"
              >
                <Dice6 size={16} />
                Quick Roll Stats
              </button>

              <div className="flex space-x-4">
                <Link
                  href="/player"
                  className="px-6 py-2 text-slate-600 transition-colors hover:text-slate-800"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isCreating || !characterName.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
