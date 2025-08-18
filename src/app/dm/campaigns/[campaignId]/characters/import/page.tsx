'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Users, FileText, AlertCircle, CheckCircle, X, Plus } from 'lucide-react';
import { useDMStore } from '@/store/dmStore';
import { usePlayerStore } from '@/store/playerStore';
import { CharacterState } from '@/types/character';

interface ImportedCharacterPreview {
  id: string;
  data: CharacterState;
  fileName?: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export default function CharacterImportPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  
  const { getCampaignById, importPlayerCharacter } = useDMStore();
  const { characters: playerCharacters } = usePlayerStore();
  
  const campaign = getCampaignById(campaignId);
  
  const [importedCharacters, setImportedCharacters] = useState<ImportedCharacterPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'player'>('file');

  // Validate character data
  const validateCharacterData = (data: unknown, _fileName?: string): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Invalid character data structure'], warnings: [] };
    }

    let characterState: CharacterState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataAny = data as any;
    
    if (dataAny.state) {
      // Zustand persist format
      characterState = dataAny.state as CharacterState;
    } else if (dataAny.character) {
      // Character export format
      characterState = dataAny.character as CharacterState;
    } else if (dataAny.characterData) {
      // PlayerCharacter format
      characterState = dataAny.characterData as CharacterState;
    } else if (dataAny.name || dataAny.characterName) {
      // Direct character state
      characterState = data as CharacterState;
    } else {
      errors.push('Unrecognized character data format');
      return { isValid: false, errors, warnings };
    }

    // Required fields validation
    if (!characterState.name && !characterState.playerName) {
      errors.push('Character name is required');
    }
    
    if (!characterState.class || !characterState.class.name) {
      errors.push('Character class is required');
    }
    
    if (!characterState.level || characterState.level < 1 || characterState.level > 20) {
      errors.push('Character level must be between 1 and 20');
    }
    
    if (!characterState.race) {
      errors.push('Character race is required');
    }

    // Warnings for missing optional data
    if (!characterState.hitPoints || !characterState.hitPoints.max) {
      warnings.push('Hit points data is missing or incomplete');
    }
    
    if (!characterState.abilities) {
      warnings.push('Ability scores are missing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  // Handle file import
  const handleFileImport = useCallback(async (files: FileList) => {
    setIsProcessing(true);
    const newImportedCharacters: ImportedCharacterPreview[] = [];

    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        const characterData = JSON.parse(content);
        
        const validation = validateCharacterData(characterData, file.name);
        
        newImportedCharacters.push({
          id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          data: characterData,
          fileName: file.name,
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings
        });
      } catch (error) {
        newImportedCharacters.push({
          id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          data: {} as CharacterState,
          fileName: file.name,
          isValid: false,
          errors: [`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: []
        });
      }
    }

    setImportedCharacters(prev => [...prev, ...newImportedCharacters]);
    setIsProcessing(false);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileImport(files);
    }
  }, [handleFileImport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileImport(files);
    }
    // Reset input
    e.target.value = '';
  }, [handleFileImport]);

  // Import from existing player characters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImportFromPlayer = (playerCharacter: any) => {
    const validation = validateCharacterData(playerCharacter);
    
    setImportedCharacters(prev => [...prev, {
      id: `player-${playerCharacter.id}`,
      data: playerCharacter,
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    }]);
  };

  // Remove character from import list
  const removeImportedCharacter = (id: string) => {
    setImportedCharacters(prev => prev.filter(char => char.id !== id));
  };

  // Confirm import of valid characters
  const confirmImport = async () => {
    const validCharacters = importedCharacters.filter(char => char.isValid);
    
    if (validCharacters.length === 0) {
      alert('No valid characters to import');
      return;
    }

    try {
      setIsProcessing(true);
      
      for (const character of validCharacters) {
        // Normalize character data based on format
        let characterState: CharacterState;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataAny = character.data as any;
        
        if (dataAny.state) {
          characterState = dataAny.state as CharacterState;
        } else if (dataAny.character) {
          characterState = dataAny.character as CharacterState;
        } else if (dataAny.characterData) {
          characterState = dataAny.characterData as CharacterState;
        } else {
          characterState = character.data as CharacterState;
        }

        // Ensure the character has a proper ID and name
        if (!characterState.id) {
          characterState.id = `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        const characterName = characterState.name || 'Imported Character';
        characterState.name = characterName;

        // Import into DM store
        importPlayerCharacter(campaignId, characterState, {
          type: character.fileName ? 'json' : 'manual',
          timestamp: new Date(),
          fileName: character.fileName,
          version: '1.0.0',
          hash: JSON.stringify(characterState).length.toString()
        });
      }

      // Clear imported characters
      setImportedCharacters([]);
      
      // Navigate back to campaign with success message
      router.push(`/dm/campaigns/${campaignId}?imported=${validCharacters.length}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Campaign Not Found</h1>
        <Link href="/dm/campaigns" className="text-blue-600 hover:text-blue-800">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const validCharacters = importedCharacters.filter(char => char.isValid);
  const invalidCharacters = importedCharacters.filter(char => !char.isValid);

  return (
    <div className="character-import-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/dm/campaigns/${campaignId}`}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Campaign
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Import Characters</h1>
          <p className="text-slate-600">Add player characters to &quot;{campaign.name}&quot;</p>
        </div>
      </div>

      {/* Import Mode Selector */}
      <div className="mb-8">
        <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setImportMode('file')}
            className={`px-4 py-2 rounded-md transition-colors ${
              importMode === 'file'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            JSON Files
          </button>
          <button
            onClick={() => setImportMode('player')}
            className={`px-4 py-2 rounded-md transition-colors ${
              importMode === 'player'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            Player Characters
          </button>
        </div>
      </div>

      {/* Import Interface */}
      {importMode === 'file' ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Import from JSON Files</h2>
          
          {/* File Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
          >
            <Upload size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              Drop character files here or click to browse
            </h3>
            <p className="text-slate-600 mb-4">
              Supports JSON exports from RollKeeper and other compatible formats
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              <Upload size={16} />
              Choose Files
              <input
                type="file"
                accept=".json"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Import from Player Characters</h2>
          
          {playerCharacters.length === 0 ? (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Player Characters Found</h3>
              <p className="text-slate-600 mb-4">
                Create characters in the Player Dashboard first, then import them here.
              </p>
              <Link
                href="/player"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Go to Player Dashboard
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playerCharacters
                .filter(pc => !pc.isArchived)
                .map(playerChar => (
                <div key={playerChar.id} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-800 mb-1">{playerChar.name}</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    {playerChar.race} {playerChar.class} (Level {playerChar.level})
                  </p>
                  <button
                    onClick={() => handleImportFromPlayer(playerChar)}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    disabled={importedCharacters.some(ic => ic.id === `player-${playerChar.id}`)}
                  >
                    {importedCharacters.some(ic => ic.id === `player-${playerChar.id}`) ? 'Added' : 'Import'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Preview */}
      {importedCharacters.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">Import Preview</h2>
            <span className="text-sm text-slate-600">
              {validCharacters.length} valid, {invalidCharacters.length} invalid
            </span>
          </div>

          <div className="space-y-4">
            {importedCharacters.map(character => (
              <div
                key={character.id}
                className={`border rounded-lg p-4 ${
                  character.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {character.isValid ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                                          <h3 className="font-semibold text-slate-800">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(character.data as any).name || character.fileName || 'Unknown Character'}
                    </h3>
                      {character.fileName && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {character.fileName}
                        </span>
                      )}
                    </div>
                    
                    {character.isValid && (
                      <p className="text-sm text-slate-600 mb-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(character.data as any).race} {(character.data as any).class?.name} (Level {(character.data as any).level})
                      </p>
                    )}

                    {character.errors.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                        <ul className="text-sm text-red-700 list-disc list-inside">
                          {character.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {character.warnings.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-yellow-800 mb-1">Warnings:</p>
                        <ul className="text-sm text-yellow-700 list-disc list-inside">
                          {character.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeImportedCharacter(character.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Actions */}
      {importedCharacters.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setImportedCharacters([])}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Clear All
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {validCharacters.length} character{validCharacters.length !== 1 ? 's' : ''} ready to import
            </span>
            <button
              onClick={confirmImport}
              disabled={validCharacters.length === 0 || isProcessing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Importing...' : `Import ${validCharacters.length} Character${validCharacters.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-slate-800">Processing characters...</span>
          </div>
        </div>
      )}
    </div>
  );
}
