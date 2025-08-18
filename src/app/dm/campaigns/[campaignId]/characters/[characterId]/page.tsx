'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Crown, Edit3, Save, FileText, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { useDMStore } from '@/store/dmStore';
import { useCharacterStore } from '@/store/characterStore';
import { 
  CharacterHeader, 
  XPTracker, 
  CurrencyManager, 
  InventoryManager 
} from '@/components/shared/character';

// Import the main character sheet component (we'll need to modify this import)
// For now, let's create a simplified version that shows character data

export default function DMCharacterViewPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;
  const characterId = params.characterId as string;
  
  const { getCampaignById, getPlayerCharacterById, updatePlayerCharacter, removePlayerCharacter } = useDMStore();
  const { loadCharacterState } = useCharacterStore();
  
  const campaign = getCampaignById(campaignId);
  const characterRef = getPlayerCharacterById(campaignId, characterId);
  
  const [dmNotes, setDmNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [viewMode, setViewMode] = useState<'dm' | 'player'>('dm');
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);

  // Initialize DM notes
  useEffect(() => {
    if (characterRef) {
      setDmNotes(characterRef.dmNotes || '');
    }
  }, [characterRef]);

  // Load character data into the character store for viewing
  useEffect(() => {
    if (characterRef && viewMode === 'player') {
      loadCharacterState(characterRef.characterData);
    }
  }, [characterRef, viewMode, loadCharacterState]);

  const saveDmNotes = () => {
    if (characterRef) {
      updatePlayerCharacter(campaignId, characterId, { dmNotes });
      setIsEditingNotes(false);
    }
  };

  const handleRemoveCharacter = () => {
    removePlayerCharacter(campaignId, characterId);
    router.push(`/dm/campaigns/${campaignId}/characters`);
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

  if (!characterRef) {
    return (
      <div className="text-center py-12">
        <FileText size={64} className="mx-auto mb-6 text-gray-400" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Character Not Found</h1>
        <p className="text-slate-600 mb-6">
          This character doesn&apos;t exist in this campaign or has been removed.
        </p>
        <Link 
          href={`/dm/campaigns/${campaignId}/characters`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Characters
        </Link>
      </div>
    );
  }

  const character = characterRef.characterData;

  return (
    <div className="dm-character-view">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href={`/dm/campaigns/${campaignId}/characters`}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors mr-6"
              >
                <ArrowLeft size={20} />
                Back to Characters
              </Link>
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-purple-600" />
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    {characterRef.customName || character.name}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {character.race} {character.class?.name || 'Unknown Class'} • Level {character.level}
                    {characterRef.playerName && ` • ${characterRef.playerName}`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('dm')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'dm'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Crown size={14} className="inline mr-1" />
                  DM View
                </button>
                <button
                  onClick={() => setViewMode('player')}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'player'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Eye size={14} className="inline mr-1" />
                  Player View
                </button>
              </div>

              {/* Character Actions */}
              <div className="flex items-center space-x-2">
                <Link
                  href={`/dm/campaigns/${campaignId}/combat?addCharacter=${characterId}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Add to Combat
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'dm' ? (
          // DM-specific view with character summary and management tools
          <div className="space-y-8">
            {/* DM Character Sheet Overview */}
            <div className="space-y-6">
              {/* DM Status Bar */}
              <div className="bg-gradient-to-r from-slate-700 via-blue-600 to-purple-700 rounded-xl p-4 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Crown size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">DM Character View</h2>
                      <p className="text-slate-200 text-sm">
                        Viewing {characterRef.customName || character.name} as DM
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      characterRef.syncStatus === 'synced' ? 'bg-green-500' :
                      characterRef.syncStatus === 'outdated' ? 'bg-yellow-500' :
                      characterRef.syncStatus === 'conflict' ? 'bg-red-500' : 'bg-gray-500'
                    }`}>
                      📡 {characterRef.syncStatus.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      characterRef.isActive ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {characterRef.isActive ? '🟢 ACTIVE' : '⚫ INACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Character Header with Basic Info */}
              <CharacterHeader
                name={character.name}
                race={character.race}
                classInfo={character.class}
                level={character.level}
                background={character.background}
                playerName={characterRef.playerName}
                alignment={character.alignment}
                showPlayerName={true}
                showBackground={true}
                showAlignment={true}
                readonly={true}
                className="shadow-lg"
              />

              {/* Character Stats Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* XP Tracker */}
                <XPTracker
                  currentXP={character.experience || 0}
                  currentLevel={character.level}
                  readonly={true}
                  hideControls={true}
                  className="shadow-lg"
                />

                {/* Currency Manager */}
                <CurrencyManager
                  currency={character.currency || { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 }}
                  readonly={true}
                  hideControls={true}
                  compact={false}
                  className="shadow-lg"
                />
              </div>

              {/* Inventory Manager */}
              <InventoryManager
                items={character.inventoryItems || []}
                readonly={true}
                hideAddButton={true}
                hideFilters={false}
                maxItemsToShow={10}
                className="shadow-lg"
              />
            </div>

            {/* DM Notes */}
            <div className="bg-gradient-to-br from-purple-50 via-white to-purple-50 rounded-xl shadow-xl border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-white text-lg">📝</span>
                    </div>
                    <h2 className="text-xl font-bold text-white">DM Notes</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingNotes ? (
                      <>
                        <button
                          onClick={saveDmNotes}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 shadow-lg font-medium"
                        >
                          <Save size={16} />
                          Save Notes
                        </button>
                        <button
                          onClick={() => {
                            setDmNotes(characterRef.dmNotes || '');
                            setIsEditingNotes(false);
                          }}
                          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50 transition-all duration-200 shadow-lg font-medium"
                      >
                        <Edit3 size={16} />
                        Edit Notes
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {isEditingNotes ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-purple-700 mb-2">
                      Private notes about this character (only visible to you as DM):
                    </label>
                    <textarea
                      value={dmNotes}
                      onChange={(e) => setDmNotes(e.target.value)}
                      placeholder="Add private notes about this character's backstory, motivations, secrets, character development, or anything else you want to remember as their DM..."
                      className="w-full h-40 p-4 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 resize-none bg-white shadow-inner text-slate-800 placeholder-slate-400"
                    />
                    <div className="text-xs text-purple-600 flex items-center gap-1">
                      <span>💡</span>
                      <span>Tip: Use this space for character secrets, plot hooks, or session notes!</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 rounded-xl p-6 min-h-[10rem] shadow-inner">
                    {characterRef.dmNotes ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-purple-700 mb-3">
                          <span className="text-sm font-medium">📖 Your Private Notes:</span>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                            {characterRef.dmNotes}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">📝</span>
                        </div>
                        <h3 className="text-lg font-medium text-purple-800 mb-2">No DM Notes Yet</h3>
                        <p className="text-purple-600 mb-4">
                          Click &quot;Edit Notes&quot; to add private notes about this character.
                        </p>
                        <p className="text-sm text-purple-500 italic">
                          Perfect for backstory details, secrets, plot hooks, or session reminders!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Character Management */}
            <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-600 via-slate-700 to-blue-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">⚙️</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">Character Management</h2>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Campaign Settings */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">🎮</span>
                      </div>
                      <h3 className="text-lg font-bold text-blue-800">Campaign Settings</h3>
                    </div>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={characterRef.isActive}
                          onChange={(e) => updatePlayerCharacter(campaignId, characterId, { isActive: e.target.checked })}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-slate-800">Active in Campaign</span>
                          <p className="text-xs text-slate-600">Character participates in sessions and can be added to combat</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          characterRef.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {characterRef.isActive ? '✅ Active' : '⏸️ Inactive'}
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={characterRef.isVisible}
                          onChange={(e) => updatePlayerCharacter(campaignId, characterId, { isVisible: e.target.checked })}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-slate-800">Visible to Other Players</span>
                          <p className="text-xs text-slate-600">Other players can see this character in shared views</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          characterRef.isVisible ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {characterRef.isVisible ? '👁️ Visible' : '🙈 Hidden'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Import Information */}
                  <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-6 border border-emerald-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">📥</span>
                      </div>
                      <h3 className="text-lg font-bold text-emerald-800">Import Information</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-emerald-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-emerald-700">Imported:</span>
                          <span className="text-sm font-semibold text-emerald-900">
                            {new Date(characterRef.importedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border border-emerald-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-emerald-700">Last Sync:</span>
                          <span className="text-sm font-semibold text-emerald-900">
                            {new Date(characterRef.lastSynced).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border border-emerald-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-emerald-700">Source:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            characterRef.importSource.type === 'json' ? 'bg-blue-100 text-blue-800' :
                            characterRef.importSource.type === 'localStorage' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {characterRef.importSource.type === 'json' ? '📄 JSON File' :
                             characterRef.importSource.type === 'localStorage' ? '💾 Local Storage' :
                             characterRef.importSource.type}
                          </span>
                        </div>
                      </div>
                      
                      {characterRef.importSource.fileName && (
                        <div className="bg-white rounded-lg p-3 border border-emerald-200">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium text-emerald-700">File:</span>
                            <span className="text-xs font-mono text-emerald-900 bg-emerald-50 px-2 py-1 rounded max-w-32 truncate">
                              {characterRef.importSource.fileName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="lg:col-span-2">
                  <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-xl p-6 border border-red-200 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">⚠️</span>
                      </div>
                      <h3 className="text-lg font-bold text-red-800">Danger Zone</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border border-red-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-800 mb-2">Remove Character from Campaign</h4>
                            <p className="text-sm text-red-700 mb-3">
                              This will permanently remove this character from the campaign. This action cannot be undone.
                            </p>
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                              <strong>Warning:</strong> The character data will be completely removed from this campaign. 
                              If the character was imported from a JSON file, you can re-import it later.
                            </div>
                          </div>
                          <button
                            onClick={() => setShowRemoveConfirmation(true)}
                            className="ml-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-lg font-medium"
                          >
                            <Trash2 size={16} />
                            Remove Character
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Player view - embed the full character sheet
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <div className="flex items-center gap-2 text-purple-800">
                <Crown size={16} />
                <span className="font-medium">DM View</span>
              </div>
              <p className="text-sm text-purple-700 mt-1">
                You&apos;re viewing this character as it appears to the player. This is read-only in the DM interface.
              </p>
            </div>
            
            {/* Character Sheet Iframe or Component */}
            <div className="text-center py-12 text-slate-600">
              <FileText size={48} className="mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium mb-2">Player Character Sheet View</h3>
              <p className="mb-6">
                The full interactive character sheet would be displayed here.<br />
                This would reuse the same component as /player/characters/[characterId]
              </p>
              <div className="space-y-2 text-sm text-left max-w-md mx-auto bg-slate-50 p-4 rounded-lg">
                <div><strong>Name:</strong> {character.name}</div>
                <div><strong>Race:</strong> {character.race}</div>
                <div><strong>Class:</strong> {character.class?.name} (Level {character.level})</div>
                <div><strong>Player:</strong> {character.playerName}</div>
                <div><strong>HP:</strong> {character.hitPoints?.current}/{character.hitPoints?.max}</div>
                <div><strong>AC:</strong> {character.armorClass}</div>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                To implement: Import and render the full CharacterSheet component here
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Remove Character Confirmation Modal */}
      {showRemoveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Character Removal</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to remove <strong>{characterRef?.customName || character?.name}</strong> from this campaign?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>This will:</strong>
                </p>
                <ul className="text-sm text-red-600 mt-1 ml-4 list-disc">
                  <li>Remove all character data from this campaign</li>
                  <li>Delete any DM notes associated with this character</li>
                  <li>Remove the character from combat encounters</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCharacter}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Remove Character
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
