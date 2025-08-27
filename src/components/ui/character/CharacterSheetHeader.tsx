'use client';

import { Save, Download, Upload, RotateCcw, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SaveIndicator } from "@/components/ui/feedback/SaveIndicator";
import { usePlayerStore } from "@/store/playerStore";
import { useCharacterStore } from "@/store/characterStore";
import { exportCharacterToFile } from "@/utils/fileOperations";
import { useState, useEffect } from "react";

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
  onAddToast: (toast: { type: 'error' | 'damage' | 'attack' | 'save' | 'info' | 'success'; title: string; message: string }) => void;
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
  onAddToast
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
      }
      else if (!isHovering) {
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
          className="fixed top-0 left-0 w-full h-3 z-[60] cursor-pointer"
          onMouseEnter={() => setIsHovering(true)}
          title="Hover to show header"
        />
      )}
      
      <header 
        className={`bg-white shadow-lg border-b border-slate-200 sticky top-0 z-50 transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/player" className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors mr-6">
                <ArrowLeft size={20} />
                Back to Characters
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{characterName}</h1>
                <p className="text-sm text-slate-600">
                  {characterRace} {characterClass || 'Unknown Class'} • Level {characterLevel}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <SaveIndicator 
                lastSaved={lastSaved} 
                status={saveStatus}
              />
              
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
                        message: 'Character exported successfully!'
                      });
                    } catch (error) {
                      console.error('Export failed:', error);
                      onAddToast({
                        type: 'error',
                        title: 'Export Failed',
                        message: 'Failed to export character.'
                      });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Export Character"
                >
                  <Download size={16} />
                  Export
                </button>
                
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                  <Upload size={16} />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          
                          // Use the player store's import function
                          const { importCharacter: importToPlayerStore } = usePlayerStore.getState();
                          const newCharacterId = importToPlayerStore(data);
                          
                          onAddToast({
                            type: 'success',
                            title: 'Import Successful',
                            message: 'Character imported successfully! Redirecting to new character...'
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
                            message: 'Failed to import character. Please check the file format.'
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
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
      <header className="max-w-7xl mx-auto mb-8 relative z-30">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Character Name"
                value={characterName}
                onChange={(e) => onUpdateName(e.target.value)}
                className="text-3xl font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-800 w-full"
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
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Save size={16} />
                Save
              </button>
              <button 
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all shadow-md"
              >
                <Download size={16} />
                Export
              </button>

              <Link 
                href="/prototype"
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
                title="Try the new Notes module prototype"
              >
                <FileText size={16} />
                Notes Prototype
              </Link>
              <button 
                onClick={onShowResetModal}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md"
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
