'use client';

import {
  Save,
  Download,
  Upload,
  RotateCcw,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { SyncIndicator } from '@/components/ui/sync/SyncIndicator';
import { HeaderAuthButton } from '@/components/ui/auth/AuthButton';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { exportCharacterToFile } from '@/utils/fileOperations';
import { useState, useEffect } from 'react';

interface CharacterSheetHeaderProps {
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

  // Header visibility state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

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
        className={`sticky top-0 z-50 border-b border-slate-200 bg-white shadow-lg transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
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
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  {characterName}
                </h1>
                <p className="text-sm text-slate-600">
                  {characterRace} {characterClass || 'Unknown Class'} • Level{' '}
                  {characterLevel}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <SyncIndicator compact />
              <SaveIndicator lastSaved={lastSaved} status={saveStatus} />
              <HeaderAuthButton />

              {/* File Operations */}
              <div className="flex items-center space-x-2">
                <button
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
                  className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                  title="Export Character"
                >
                  <Download size={16} />
                  Export
                </button>

                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
                  <Upload size={16} />
                  Import
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

                <button
                  onClick={onShowResetModal}
                  className="flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
                  title="Reset Character"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Character Header */}
      <header className="relative z-30 mx-auto mb-8 max-w-7xl">
        <div className="rounded-xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Character Name"
                value={characterName}
                onChange={e => onUpdateName(e.target.value)}
                className="w-full border-none bg-transparent text-3xl font-bold text-gray-800 placeholder-gray-400 outline-none"
              />
              <SaveIndicator
                status={saveStatus}
                lastSaved={lastSaved}
                hasUnsavedChanges={hasUnsavedChanges}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onManualSave}
                disabled={!hasUnsavedChanges}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-sm text-white shadow-md transition-all hover:from-emerald-700 hover:to-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={onExport}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-2 text-sm text-white shadow-md transition-all hover:from-slate-700 hover:to-slate-800"
              >
                <Download size={16} />
                Export
              </button>

              <Link
                href="/prototype"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800"
                title="Try the new Notes module prototype"
              >
                <FileText size={16} />
                Notes Prototype
              </Link>
              <button
                onClick={onShowResetModal}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm text-white shadow-md transition-all hover:from-red-700 hover:to-red-800"
                title="Reset character - this will clear all data!"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
