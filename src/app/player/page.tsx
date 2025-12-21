'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  User,
  Crown,
  Archive,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  ArrowLeft,
  Upload,
  Download,
  Settings,
  Skull,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { AvatarUpload } from '@/components/ui/character/AvatarUpload';

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
    settings,
    updateSettings,
  } = usePlayerStore();

  const [showSettings, setShowSettings] = useState(false);

  const activeCharacters = getActiveCharacters();
  const archivedCharacters = getArchivedCharacters();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const getClassBadgeVariant = (
    className: string
  ):
    | 'danger'
    | 'secondary'
    | 'neutral'
    | 'warning'
    | 'success'
    | 'primary'
    | 'info' => {
    const variants: Record<
      string,
      | 'danger'
      | 'secondary'
      | 'neutral'
      | 'warning'
      | 'success'
      | 'primary'
      | 'info'
    > = {
      Fighter: 'danger',
      Wizard: 'secondary',
      Rogue: 'neutral',
      Cleric: 'warning',
      Ranger: 'success',
      Paladin: 'primary',
      Barbarian: 'danger',
      Bard: 'info',
      Druid: 'success',
      Monk: 'warning',
      Sorcerer: 'secondary',
      Warlock: 'primary',
    };
    return variants[className] || 'neutral';
  };

  const CharacterCard = ({
    character,
    isArchived = false,
  }: {
    character: PlayerCharacter;
    isArchived?: boolean;
  }) => (
    <div
      className={`rounded-lg border-2 bg-gradient-to-br from-white to-slate-50 shadow-md transition-all hover:shadow-xl ${
        isArchived
          ? 'border-gray-300 opacity-75 hover:from-slate-50 hover:to-gray-100'
          : 'border-blue-300 hover:from-slate-50 hover:to-blue-50'
      }`}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <AvatarUpload
              avatar={character.avatar}
              characterId={character.id}
              characterName={character.name}
              onAvatarChange={() => {}} // View only on dashboard
              size="md"
              editable={false}
            />
          </div>

          {/* Character Info */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 truncate text-xl font-semibold text-slate-800">
                  {character.name}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm text-slate-600">
                    {character.race}
                  </span>
                  <span className="text-slate-400">•</span>
                  <Badge variant={getClassBadgeVariant(character.class)}>
                    {character.class}
                  </Badge>
                  <span className="text-slate-400">•</span>
                  <span className="text-sm text-slate-600">
                    Level {character.level}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {!isArchived && (
                <div className="flex flex-shrink-0 space-x-1">
                  <Button
                    onClick={() => handleDuplicateCharacter(character)}
                    variant="ghost"
                    size="sm"
                    title="Duplicate Character"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    onClick={() => handleArchiveCharacter(character.id)}
                    variant="ghost"
                    size="sm"
                    title="Archive Character"
                  >
                    <Archive size={16} />
                  </Button>
                </div>
              )}
            </div>

            {/* Tags */}
            {character.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {character.tags.map(tag => (
                  <Badge key={tag} variant="neutral" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
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
                className="flex-1"
              >
                <Button variant="secondary" fullWidth>
                  Play Character
                </Button>
              </Link>
              <Link href={`/player/characters/${character.id}/edit`}>
                <Button variant="ghost" size="md" title="Edit Character">
                  <Edit3 size={16} />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Button
                onClick={() => restoreCharacter(character.id)}
                variant="success"
                fullWidth
              >
                Restore
              </Button>
              <Button
                onClick={() => handleDeleteCharacter(character.id)}
                variant="danger"
                size="md"
                title="Delete Permanently"
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Home
                </Button>
              </Link>
              <div className="ml-6 flex items-center">
                <User className="mr-3 h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-bold text-slate-800">
                  Player Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dm">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Crown size={16} />}
                >
                  DM Tools
                </Button>
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
            <Button
              variant="success"
              leftIcon={<Upload size={18} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import Character
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportCharacter}
              className="hidden"
            />

            {/* New Character */}
            <Link href="/player/characters/new">
              <Button variant="secondary" leftIcon={<Plus size={18} />}>
                New Character
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-md">
            <div className="flex items-center">
              <User className="mr-3 h-8 w-8 text-blue-600" />
              <div>
                <h3
                  className="text-2xl font-bold text-slate-800"
                  suppressHydrationWarning
                >
                  {activeCharacters.length}
                </h3>
                <p className="text-slate-600">Active Characters</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border-2 border-gray-200 bg-gradient-to-br from-slate-50 to-gray-50 p-6 shadow-md">
            <div className="flex items-center">
              <Archive className="mr-3 h-8 w-8 text-slate-500" />
              <div>
                <h3
                  className="text-2xl font-bold text-slate-800"
                  suppressHydrationWarning
                >
                  {archivedCharacters.length}
                </h3>
                <p className="text-slate-600">Archived</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-md">
            <div className="flex items-center">
              <ExternalLink className="mr-3 h-8 w-8 text-purple-600" />
              <div>
                <h3
                  className="text-2xl font-bold text-slate-800"
                  suppressHydrationWarning
                >
                  {characters.length}
                </h3>
                <p className="text-slate-600">Total Characters</p>
              </div>
            </div>
          </div>
        </div>

        {/* Characters Section */}
        {activeCharacters.length === 0 && archivedCharacters.length === 0 ? (
          <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-slate-50 to-blue-50 p-12 text-center shadow-md">
            <User size={64} className="mx-auto mb-6 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-slate-800">
              No Characters Yet
            </h3>
            <p className="mb-6 text-slate-600">
              Create your first character, import an existing one, or migrate
              from your old character sheet!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/player/characters/new">
                <Button variant="secondary" leftIcon={<Plus size={20} />}>
                  Create New Character
                </Button>
              </Link>

              <label className="cursor-pointer">
                <Button variant="success" leftIcon={<Upload size={20} />}>
                  Import Character
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportCharacter}
                  className="hidden"
                />
              </label>

              <Button
                onClick={handleTryMigration}
                variant="warning"
                leftIcon={<Download size={20} />}
              >
                Migrate Old Data
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Characters */}
            {activeCharacters.length > 0 && (
              <div className="mb-12" suppressHydrationWarning>
                <h2
                  className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-800"
                  suppressHydrationWarning
                >
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
              <div suppressHydrationWarning>
                <h2
                  className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-700"
                  suppressHydrationWarning
                >
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

        {/* Settings Section */}
        <div className="mb-8">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-slate-600" />
              <span className="text-lg font-semibold text-slate-700">
                Settings & Features
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Easter Eggs
              </span>
            </div>
            {showSettings ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {showSettings && (
            <div className="mt-2 rounded-lg border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                {/* Death Animation Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <Skull className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800">
                        &quot;YOU DIED&quot; Animation
                      </h4>
                      <p className="text-sm text-slate-500">
                        Dark Souls-style death screen when your character dies
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings?.enableDeathAnimation}
                      onChange={e =>
                        updateSettings({
                          enableDeathAnimation: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-red-600 peer-focus:ring-2 peer-focus:ring-red-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>

                {/* Level Up Animation Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800">
                        Level Up Animation
                      </h4>
                      <p className="text-sm text-slate-500">
                        Skyrim-style celebration when your character levels up
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings?.enableLevelUpAnimation}
                      onChange={e =>
                        updateSettings({
                          enableLevelUpAnimation: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-amber-500 peer-focus:ring-2 peer-focus:ring-amber-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                </div>

                <p className="text-center text-sm text-slate-400">
                  More features coming soon! 🎲{' '}
                  <span className="text-amber-500">maybe</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
