'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { Button } from '@/components/ui/forms';
import { Save, Download, Upload, RotateCcw } from 'lucide-react';

export default function CharacterHeaderSection() {
  const {
    character,
    updateCharacter,
    exportCharacter,
    importCharacter,
    resetCharacter,
  } = useCharacterStore();

  const { saveStatus, hasUnsavedChanges, manualSave } = useAutoSave();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const characterData = JSON.parse(e.target?.result as string);
          importCharacter(characterData);
        } catch (error) {
          console.error('Error importing character:', error);
          alert(
            'Error importing character file. Please check the file format.'
          );
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    exportCharacter();
  };

  const handleReset = () => {
    if (
      confirm(
        'Are you sure you want to reset your character? This action cannot be undone.'
      )
    ) {
      resetCharacter();
    }
  };

  return (
    <header className="relative overflow-hidden rounded-xl border border-slate-600 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-2xl"></div>
      <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-gradient-to-tr from-green-500/10 to-blue-500/10 blur-xl"></div>

      <div className="relative">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          {/* Character Info */}
          <div className="flex-1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Character Name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Character Name
                </label>
                <input
                  type="text"
                  value={character.name}
                  onChange={e => updateCharacter({ name: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Enter character name"
                />
              </div>

              {/* Level */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={character.level}
                  onChange={e =>
                    updateCharacter({ level: parseInt(e.target.value) || 1 })
                  }
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Class */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Class
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={character.class?.name || ''}
                    onChange={e =>
                      updateCharacter({
                        class: {
                          ...character.class,
                          name: e.target.value,
                          isCustom: true,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter class name"
                  />
                  {character.class?.isCustom && (
                    <span className="absolute top-2 right-2 text-xs text-amber-400">
                      Custom
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Indicator & Actions */}
          <div className="flex flex-col items-end gap-4">
            {/* Save Status */}
            <SaveIndicator status={saveStatus} />

            <div className="flex gap-2">
              <Button
                onClick={manualSave}
                disabled={!hasUnsavedChanges}
                variant="primary"
                size="sm"
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save
              </Button>

              <Button
                onClick={handleExport}
                variant="secondary"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export
              </Button>

              <Button
                asChild
                variant="secondary"
                size="sm"
              >
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </Button>

              <Button
                onClick={handleReset}
                variant="danger"
                size="sm"
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
