'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Plus, User, Crown, Calendar, Archive, Edit3, Trash2, Copy, ExternalLink, ArrowLeft, Upload, Download } from 'lucide-react';
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
    importCharacter
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
    if (confirm('Are you sure you want to archive this character? You can restore it later.')) {
      archiveCharacter(characterId);
    }
  };

  const handleDeleteCharacter = (characterId: string) => {
    if (confirm('Are you sure you want to permanently delete this character? This action cannot be undone.')) {
      deleteCharacter(characterId);
    }
  };

  const handleDuplicateCharacter = (character: PlayerCharacter) => {
    const newName = prompt('Enter a name for the duplicated character:', `${character.name} (Copy)`);
    if (newName) {
      duplicateCharacter(character.id, newName);
    }
  };

  const handleImportCharacter = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      'Fighter': 'bg-red-100 text-red-800',
      'Wizard': 'bg-blue-100 text-blue-800',
      'Rogue': 'bg-gray-100 text-gray-800',
      'Cleric': 'bg-yellow-100 text-yellow-800',
      'Ranger': 'bg-green-100 text-green-800',
      'Paladin': 'bg-purple-100 text-purple-800',
      'Barbarian': 'bg-orange-100 text-orange-800',
      'Bard': 'bg-pink-100 text-pink-800',
      'Druid': 'bg-emerald-100 text-emerald-800',
      'Monk': 'bg-amber-100 text-amber-800',
      'Sorcerer': 'bg-indigo-100 text-indigo-800',
      'Warlock': 'bg-violet-100 text-violet-800'
    };
    return colors[className] || 'bg-slate-100 text-slate-800';
  };

  const CharacterCard = ({ character, isArchived = false }: { character: PlayerCharacter; isArchived?: boolean }) => (
    <div className={`bg-white rounded-lg shadow-md border-l-4 transition-shadow hover:shadow-lg ${
      isArchived ? 'border-gray-400 opacity-75' : 'border-blue-500'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-800 mb-1">{character.name}</h3>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-slate-600">{character.race}</span>
              <span className="text-slate-400">•</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getClassColor(character.class)}`}>
                {character.class}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">Level {character.level}</span>
            </div>
            {character.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {character.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
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
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Duplicate Character"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => handleArchiveCharacter(character.id)}
                className="p-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                title="Archive Character"
              >
                <Archive size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-500 mb-4">
          <div className="flex justify-between">
            <span>Created: {new Date(character.createdAt).toLocaleDateString()}</span>
            <span>Last Played: {new Date(character.lastPlayed).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          {!isArchived ? (
            <>
              <Link
                href={`/player/characters/${character.id}`}
                onClick={() => handlePlayCharacter(character)}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-center font-medium"
              >
                Play Character
              </Link>
              <Link
                href={`/player/characters/${character.id}/edit`}
                className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                title="Edit Character"
              >
                <Edit3 size={16} />
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => restoreCharacter(character.id)}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Restore
              </button>
              <button
                onClick={() => handleDeleteCharacter(character.id)}
                className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
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
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors mr-6">
                <ArrowLeft size={20} />
                Back to Home
              </Link>
              <div className="flex items-center">
                <User className="h-6 w-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-bold text-slate-800">Player Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dm"
                className="flex items-center gap-2 text-slate-600 hover:text-purple-600 transition-colors"
              >
                <Crown size={16} />
                DM Tools
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Your Characters</h1>
            <p className="text-slate-600">
              Manage your D&D characters and jump into your adventures
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Import Character */}
            <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors cursor-pointer">
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
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg shadow-md hover:bg-yellow-700 transition-colors"
              title="Try to migrate old character data"
            >
              <Download size={18} />
              Migrate Old Data
            </button>
            
            {/* New Character */}
            <Link
              href="/player/characters/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Character
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{activeCharacters.length}</h3>
                <p className="text-slate-600">Active Characters</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">
                  {activeCharacters.reduce((sum, char) => sum + char.level, 0)}
                </h3>
                <p className="text-slate-600">Total Levels</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center">
              <Archive className="h-8 w-8 text-slate-500 mr-3" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{archivedCharacters.length}</h3>
                <p className="text-slate-600">Archived</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center">
              <ExternalLink className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{characters.length}</h3>
                <p className="text-slate-600">Total Characters</p>
              </div>
            </div>
          </div>
        </div>

        {/* Characters Section */}
        {activeCharacters.length === 0 && archivedCharacters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <User size={64} className="mx-auto mb-6 text-gray-400" />
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Characters Yet</h3>
            <p className="text-slate-600 mb-6">
              Create your first character, import an existing one, or migrate from your old character sheet!
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link
                href="/player/characters/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Create New Character
              </Link>
              
              <label className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
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
                <h2 className="text-2xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                  <User size={24} />
                  Active Characters ({activeCharacters.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeCharacters.map(character => (
                    <CharacterCard key={character.id} character={character} />
                  ))}
                </div>
              </div>
            )}

            {/* Archived Characters */}
            {archivedCharacters.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-slate-700 mb-6 flex items-center gap-2">
                  <Archive size={24} />
                  Archived Characters ({archivedCharacters.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {archivedCharacters.map(character => (
                    <CharacterCard key={character.id} character={character} isArchived />
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
