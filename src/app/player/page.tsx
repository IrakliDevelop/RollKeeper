'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  User,
  Crown,
  Calendar,
  Archive,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  ArrowLeft,
  Upload,
  Download,
} from 'lucide-react';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';

export default function PlayerDashboardPage() {
  const {
    characters,
    getActiveCharacters,
    getArchivedCharacters,
    setActiveCharacter,
    archiveCharacter,
    restoreCharacter,
    deleteCharacter,
    duplicateCharacter,
    migrateFromOldStorage,
    importCharacter,
  } = usePlayerStore();

  const activeCharacters = getActiveCharacters();
  const archivedCharacters = getArchivedCharacters();

  // Check for migration on component mount
  useEffect(() => {
    if (characters.length === 0) {
      const migrated = migrateFromOldStorage();
      if (migrated) {
        console.log('Successfully migrated character from old storage');
      }
    }
  }, [characters.length, migrateFromOldStorage]);

  const handlePlayCharacter = (character: PlayerCharacter) => {
    setActiveCharacter(character.id);
  };

  const handleArchiveCharacter = (characterId: string) => {
    if (
      confirm(
        'Are you sure you want to archive this character? You can restore it later.'
      )
    ) {
      archiveCharacter(characterId);
    }
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (
      confirm(
        'Are you sure you want to permanently delete this character? This action cannot be undone.'
      )
    ) {
      deleteCharacter(characterId);
    }
  };

  const handleDuplicateCharacter = (character: PlayerCharacter) => {
    const newName = prompt(
      'Enter a name for the duplicated character:',
      `${character.name} (Copy)`
    );
    if (newName) {
      duplicateCharacter(character.id, newName);
    }
  };

  const handleImportCharacter = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const fileText = await file.text();
        const characterData = JSON.parse(fileText);

        // Try to determine character name for import
        let characterName = 'Imported Character';
        if (characterData.characterName) {
          characterName = characterData.characterName;
        } else if (characterData.state?.characterName) {
          characterName = characterData.state.characterName;
        } else if (characterData.character?.characterName) {
          characterName = characterData.character.characterName;
        }

        const characterId = importCharacter(characterData, characterName);
        alert(`Successfully imported character: ${characterName}`);

        // Ask if they want to switch to the imported character
        if (confirm('Would you like to open the imported character?')) {
          window.location.href = `/player/characters/${characterId}`;
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import character. Please check the file format.');
      }
    }
    // Reset the input
    event.target.value = '';
  };

  const handleTryMigration = () => {
    const migrated = migrateFromOldStorage();
    if (migrated) {
      alert('Successfully migrated your old character!');
    } else {
      alert('No old character data found to migrate.');
    }
  };

  const getClassColor = (className: string) => {
    const colors: Record<string, string> = {
      Fighter: 'bg-red-100 text-red-800',
      Wizard: 'bg-blue-100 text-blue-800',
      Rogue: 'bg-gray-100 text-gray-800',
      Cleric: 'bg-yellow-100 text-yellow-800',
      Ranger: 'bg-green-100 text-green-800',
      Paladin: 'bg-purple-100 text-purple-800',
      Barbarian: 'bg-orange-100 text-orange-800',
      Bard: 'bg-pink-100 text-pink-800',
      Druid: 'bg-emerald-100 text-emerald-800',
      Monk: 'bg-amber-100 text-amber-800',
      Sorcerer: 'bg-indigo-100 text-indigo-800',
      Warlock: 'bg-violet-100 text-violet-800',
    };
    return colors[className] || 'bg-slate-100 text-slate-800';
  };

  const CharacterCard = ({
    character,
    isArchived = false,
  }: {
    character: PlayerCharacter;
    isArchived?: boolean;
  }) => (
    <div
      className={`rounded-lg border-l-4 bg-white shadow-md transition-shadow hover:shadow-lg ${
        isArchived ? 'border-gray-400 opacity-75' : 'border-blue-500'
      }`}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-1 text-xl font-semibold text-slate-800">
              {character.name}
            </h3>
            <div className="mb-2 flex items-center space-x-2">
              <span className="text-slate-600">{character.race}</span>
              <span className="text-slate-400">•</span>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${getClassColor(character.class)}`}
              >
                {character.class}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">Level {character.level}</span>
            </div>
            {character.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {character.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {!isArchived && (
            <div className="flex space-x-1">
              <button
                onClick={() => handleDuplicateCharacter(character)}
                className="rounded p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title="Duplicate Character"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => handleArchiveCharacter(character.id)}
                className="rounded p-2 text-slate-400 transition-colors hover:bg-yellow-50 hover:text-yellow-600"
                title="Archive Character"
              >
                <Archive size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 text-sm text-slate-500">
          <div className="flex justify-between">
            <span>
              Created: {new Date(character.createdAt).toLocaleDateString()}
            </span>
            <span>
              Last Played: {new Date(character.lastPlayed).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          {!isArchived ? (
            <>
              <Link
                href={`/player/characters/${character.id}`}
                onClick={() => handlePlayCharacter(character)}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-blue-700"
              >
                Play Character
              </Link>
              <Link
                href={`/player/characters/${character.id}/edit`}
                className="flex items-center justify-center rounded-md bg-slate-100 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-200"
                title="Edit Character"
              >
                <Edit3 size={16} />
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => restoreCharacter(character.id)}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
              >
                Restore
              </button>
              <button
                onClick={() => handleDeleteCharacter(character.id)}
                className="flex items-center justify-center rounded-md bg-red-100 px-3 py-2 text-red-700 transition-colors hover:bg-red-200"
                title="Delete Permanently"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link
                href="/"
                className="mr-6 flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
              >
                <ArrowLeft size={20} />
                Back to Home
              </Link>
              <div className="flex items-center">
                <User className="mr-3 h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-bold text-slate-800">
                  Player Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dm"
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-purple-600"
              >
                <Crown size={16} />
                DM Tools
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-slate-800">
              Your Characters
            </h1>
            <p className="text-slate-600">
              Manage your D&D characters and jump into your adventures
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Import Character */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-green-700">
              <Upload size={18} />
              Import Character
              <input
                type="file"
                accept=".json"
                onChange={handleImportCharacter}
                className="hidden"
              />
            </label>

            {/* Try Migration */}
            <button
              onClick={handleTryMigration}
              className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-yellow-700"
              title="Try to migrate old character data"
            >
              <Download size={18} />
              Migrate Old Data
            </button>

            {/* New Character */}
            <Link
              href="/player/characters/new"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-blue-700"
            >
              <Plus size={18} />
              New Character
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="flex items-center">
              <User className="mr-3 h-8 w-8 text-blue-500" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {activeCharacters.length}
                </h3>
                <p className="text-slate-600">Active Characters</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="flex items-center">
              <Calendar className="mr-3 h-8 w-8 text-green-500" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {activeCharacters.reduce((sum, char) => sum + char.level, 0)}
                </h3>
                <p className="text-slate-600">Total Levels</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="flex items-center">
              <Archive className="mr-3 h-8 w-8 text-slate-500" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {archivedCharacters.length}
                </h3>
                <p className="text-slate-600">Archived</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="flex items-center">
              <ExternalLink className="mr-3 h-8 w-8 text-purple-500" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {characters.length}
                </h3>
                <p className="text-slate-600">Total Characters</p>
              </div>
            </div>
          </div>
        </div>

        {/* Characters Section */}
        {activeCharacters.length === 0 && archivedCharacters.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-md">
            <User size={64} className="mx-auto mb-6 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-800">
              No Characters Yet
            </h3>
            <p className="mb-6 text-slate-600">
              Create your first character, import an existing one, or migrate
              from your old character sheet!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/player/characters/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
              >
                <Plus size={20} />
                Create New Character
              </Link>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-700">
                <Upload size={20} />
                Import Character
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportCharacter}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleTryMigration}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-6 py-3 text-white transition-colors hover:bg-yellow-700"
              >
                <Download size={20} />
                Migrate Old Data
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Characters */}
            {activeCharacters.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-800">
                  <User size={24} />
                  Active Characters ({activeCharacters.length})
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activeCharacters.map(character => (
                    <CharacterCard key={character.id} character={character} />
                  ))}
                </div>
              </div>
            )}

            {/* Archived Characters */}
            {archivedCharacters.length > 0 && (
              <div>
                <h2 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-700">
                  <Archive size={24} />
                  Archived Characters ({archivedCharacters.length})
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {archivedCharacters.map(character => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      isArchived
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
