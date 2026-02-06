'use client';

import {
  Download,
  Upload,
  RotateCcw,
  FileText,
  ArrowLeft,
  Pencil,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { exportCharacterToFile } from '@/utils/fileOperations';
import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui/forms';
import { AvatarUpload } from './AvatarUpload';

interface CharacterSheetHeaderProps {
  characterId: string;
  characterName: string;
  characterRace: string;
  characterClass: string;
  characterLevel: number;
  saveStatus: 'saving' | 'saved' | 'error';
  lastSaved: Date | string | null;
  hasUnsavedChanges: boolean;
  onManualSave: () => void;
  onExport: () => void;
  onShowResetModal: () => void;
  onUpdateName: (name: string) => void;
  onAddToast: (toast: {
    type: 'error' | 'damage' | 'attack' | 'save' | 'info' | 'success';
    title: string;
    message: string;
  }) => void;
}

export default function CharacterSheetHeader({
  characterId,
  characterName,
  characterRace,
  characterClass,
  characterLevel,
  saveStatus,
  lastSaved,
  hasUnsavedChanges,
  onManualSave,
  onExport,
  onShowResetModal,
  onUpdateName,
  onAddToast,
}: CharacterSheetHeaderProps) {
  const { exportCharacter } = useCharacterStore();
  const { getCharacterById, updateCharacterData } = usePlayerStore();

  // Get character data for avatar
  const playerCharacter = getCharacterById(characterId);

  // Handle avatar change
  const handleAvatarChange = (newAvatar: string | undefined) => {
    if (playerCharacter?.characterData) {
      updateCharacterData(characterId, {
        ...playerCharacter.characterData,
        avatar: newAvatar,
      });
    } else {
    }
  };

  // Header visibility state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } else if (!isHovering) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsHeaderVisible(false);
        } else if (currentScrollY < lastScrollY) {
          setIsHeaderVisible(true);
        }
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isHovering]);

  return (
    <>
      {!isHeaderVisible && (
        <div
          className="fixed top-0 left-0 z-[60] h-3 w-full cursor-pointer"
          onMouseEnter={() => setIsHovering(true)}
          title="Hover to show header"
        />
      )}

      <header
        className={`border-divider bg-surface-raised sticky top-0 z-50 border-b shadow-lg transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/player">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Characters
                </Button>
              </Link>
              <div className="ml-6">
                <h1 className="text-heading text-xl font-bold">
                  {characterName}
                </h1>
                <p className="text-body text-sm">
                  {characterRace} {characterClass || 'Unknown Class'} • Level{' '}
                  {characterLevel}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <SaveIndicator lastSaved={lastSaved} status={saveStatus} />

              <ThemeToggle />

              {/* File Operations */}
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => {
                    try {
                      const exportData = exportCharacter();
                      exportCharacterToFile(exportData);
                      onAddToast({
                        type: 'success',
                        title: 'Export Successful',
                        message: 'Character exported successfully!',
                      });
                    } catch (error) {
                      console.error('Export failed:', error);
                      onAddToast({
                        type: 'error',
                        title: 'Export Failed',
                        message: 'Failed to export character.',
                      });
                    }
                  }}
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={16} />}
                  title="Export Character"
                >
                  Export
                </Button>

                <Button asChild variant="outline" size="sm">
                  <label className="cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Upload size={16} />
                      Import
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const text = await file.text();
                            const data = JSON.parse(text);

                            // Use the player store's import function
                            const { importCharacter: importToPlayerStore } =
                              usePlayerStore.getState();
                            const newCharacterId = importToPlayerStore(data);

                            onAddToast({
                              type: 'success',
                              title: 'Import Successful',
                              message:
                                'Character imported successfully! Redirecting to new character...',
                            });

                            // Redirect to the newly imported character after a brief delay
                            setTimeout(() => {
                              window.location.href = `/player/characters/${newCharacterId}`;
                            }, 1500);
                          } catch (error) {
                            console.error('Import failed:', error);
                            onAddToast({
                              type: 'error',
                              title: 'Import Failed',
                              message:
                                'Failed to import character. Please check the file format.',
                            });
                          }
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </Button>

                <Button
                  onClick={onShowResetModal}
                  variant="danger"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  title="Reset Character"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Character Header */}
      <header className="relative z-30 mx-auto mb-8 max-w-7xl">
        <div className="border-divider bg-surface-raised/90 rounded-xl border p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <AvatarUpload
              avatar={playerCharacter?.avatar}
              characterId={characterId}
              characterName={characterName}
              onAvatarChange={handleAvatarChange}
              size="lg"
              editable={isEditMode}
            />

            {/* Name Input and Buttons - side by side */}
            <div className="flex flex-1 items-start justify-between gap-4">
              <div className="flex-1">
                {isEditMode ? (
                  <Input
                    type="text"
                    placeholder="Character Name"
                    value={characterName}
                    onChange={e => onUpdateName(e.target.value)}
                    className="text-text-primary placeholder-text-tertiary w-full border-none bg-transparent text-3xl font-bold outline-none"
                    size="lg"
                  />
                ) : (
                  <h2 className="text-heading w-full text-3xl font-bold">
                    {characterName || 'Unnamed Character'}
                  </h2>
                )}
                <SaveIndicator
                  status={saveStatus}
                  lastSaved={lastSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                  className="mt-1"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 gap-2">
                {/* Edit/View Mode Toggle */}
                <Button
                  onClick={() => setIsEditMode(!isEditMode)}
                  variant={isEditMode ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={
                    isEditMode ? <Eye size={16} /> : <Pencil size={16} />
                  }
                  className={
                    isEditMode
                      ? 'bg-linear-to-r from-blue-600 to-blue-700 shadow-md hover:from-blue-700 hover:to-blue-800'
                      : 'shadow-sm'
                  }
                  title={
                    isEditMode ? 'Switch to view mode' : 'Switch to edit mode'
                  }
                >
                  {isEditMode ? 'View' : 'Edit'}
                </Button>

                {/* <Button
                  onClick={onManualSave}
                  disabled={!hasUnsavedChanges}
                  variant="success"
                  size="sm"
                  leftIcon={<Save size={16} />}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md"
                >
                  Save
                </Button> */}
                <Button
                  onClick={onExport}
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={16} />}
                  className="shadow-sm"
                >
                  Export
                </Button>

                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="shadow-sm"
                  title="Try the new Notes module prototype"
                >
                  <Link href="/prototype" className="flex items-center gap-2">
                    <FileText size={16} />
                    Notes Prototype
                  </Link>
                </Button>

                <Button
                  onClick={onShowResetModal}
                  variant="danger"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  className="bg-gradient-to-r from-red-600 to-red-700 shadow-md hover:from-red-700 hover:to-red-800"
                  title="Reset character - this will clear all data!"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
