'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { SaveIndicator } from '@/components/ui/SaveIndicator';
import { Save, Download, Upload, RotateCcw, Edit2 } from 'lucide-react';

export default function CharacterHeaderSection() {
  const { 
    character, 
    updateCharacter, 
    exportCharacter, 
    importCharacter, 
    resetCharacter 
  } = useCharacterStore();
  
  const { saveStatus, hasUnsavedChanges, manualSave } = useAutoSave();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const characterData = JSON.parse(e.target?.result as string);
          importCharacter(characterData);
        } catch (error) {
          console.error('Error importing character:', error);
          alert('Error importing character file. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    exportCharacter();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your character? This action cannot be undone.')) {
      resetCharacter();
    }
  };

  return (
    <header className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-xl border border-slate-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-500/10 to-blue-500/10 rounded-full blur-xl"></div>
      
      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Character Info */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Character Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Character Name</label>
                <input
                  type="text"
                  value={character.name}
                  onChange={(e) => updateCharacter({ name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter character name"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Level</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={character.level}
                  onChange={(e) => updateCharacter({ level: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Class */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Class</label>
                <div className="relative">
                  <input
                    type="text"
                    value={character.class?.name || ''}
                    onChange={(e) => updateCharacter({ 
                      class: { 
                        ...character.class, 
                        name: e.target.value,
                        isCustom: true 
                      } 
                    })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter class name"
                  />
                  {character.class?.isCustom && (
                    <span className="absolute right-2 top-2 text-xs text-amber-400">Custom</span>
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
              <button 
                onClick={manualSave}
                disabled={!hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Save size={16} />
                Save
              </button>
              
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
              >
                <Download size={16} />
                Export
              </button>
              
              <label className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 cursor-pointer transition-all shadow-md">
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 