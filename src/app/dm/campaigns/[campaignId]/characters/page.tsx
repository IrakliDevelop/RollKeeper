'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Plus,
  Crown,
  Sword,
  Eye,
  EyeOff,
  MoreVertical,
  AlertTriangle,
  FolderSync,
} from 'lucide-react';
import { useDMStore } from '@/store/dmStore';
import { PlayerCharacterReference } from '@/types/dm';

export default function CampaignCharactersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { getCampaignById, updatePlayerCharacter, removePlayerCharacter } =
    useDMStore();
  const campaign = getCampaignById(campaignId);

  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);

  if (!campaign) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">
          Campaign Not Found
        </h1>
        <Link
          href="/dm/campaigns"
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const activeCharacters = campaign.playerCharacters.filter(pc => pc.isActive);
  const inactiveCharacters = campaign.playerCharacters.filter(
    pc => !pc.isActive
  );

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'text-green-600 bg-green-100';
      case 'outdated':
        return 'text-yellow-600 bg-yellow-100';
      case 'conflict':
        return 'text-red-600 bg-red-100';
      case 'manual':
        return 'text-blue-600 bg-blue-100';
      case 'error':
        return 'text-red-800 bg-red-200';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacters(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const toggleCharacterVisibility = (
    characterId: string,
    currentVisibility: boolean
  ) => {
    updatePlayerCharacter(campaignId, characterId, {
      isVisible: !currentVisibility,
    });
  };

  const toggleCharacterActive = (
    characterId: string,
    currentActive: boolean
  ) => {
    updatePlayerCharacter(campaignId, characterId, {
      isActive: !currentActive,
    });
  };

  // Function to remove character (reserved for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeCharacter = (characterId: string, characterName: string) => {
    if (
      confirm(
        `Are you sure you want to remove "${characterName}" from this campaign? This action cannot be undone.`
      )
    ) {
      removePlayerCharacter(campaignId, characterId);
    }
  };

  const CharacterCard = ({
    character,
    isInactive = false,
  }: {
    character: PlayerCharacterReference;
    isInactive?: boolean;
  }) => (
    <div
      className={`rounded-lg border-l-4 bg-white shadow-md transition-shadow hover:shadow-lg ${
        isInactive ? 'border-gray-400 opacity-75' : 'border-blue-500'
      }`}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedCharacters.includes(character.id)}
              onChange={() => toggleCharacterSelection(character.id)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-800">
                  {character.customName || character.characterName}
                </h3>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getSyncStatusColor(character.syncStatus)}`}
                >
                  {character.syncStatus}
                </span>
              </div>

              <p className="mb-2 text-slate-600">
                {character.race} {character.class} (Level {character.level})
              </p>

              <p className="mb-3 text-sm text-slate-500">
                Player: {character.playerName}
              </p>

              {/* Character Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">HP:</span>
                  <span className="ml-2 font-medium">
                    {character.characterData.hitPoints?.current || 0}/
                    {character.characterData.hitPoints?.max || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">AC:</span>
                  <span className="ml-2 font-medium">
                    {character.characterData.armorClass || '--'}
                  </span>
                </div>
              </div>

              {/* Import Info */}
              <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>
                    Imported:{' '}
                    {new Date(character.importedAt).toLocaleDateString()}
                  </span>
                  <span>
                    Last Sync:{' '}
                    {new Date(character.lastSynced).toLocaleDateString()}
                  </span>
                </div>
                {character.importSource.type === 'json' &&
                  character.importSource.fileName && (
                    <div className="mt-1">
                      From: {character.importSource.fileName}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Actions Dropdown */}
          <div className="relative">
            <button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <MoreVertical size={16} />
            </button>
            {/* TODO: Implement dropdown menu */}
          </div>
        </div>

        {/* Character Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              toggleCharacterVisibility(character.id, character.isVisible)
            }
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-sm transition-colors ${
              character.isVisible
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {character.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            {character.isVisible ? 'Visible' : 'Hidden'}
          </button>

          <button
            onClick={() =>
              toggleCharacterActive(character.id, character.isActive)
            }
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-sm transition-colors ${
              character.isActive
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users size={14} />
            {character.isActive ? 'Active' : 'Inactive'}
          </button>

          {character.syncStatus !== 'synced' && (
            <button className="flex items-center gap-1 rounded-md bg-yellow-100 px-3 py-1 text-sm text-yellow-700 transition-colors hover:bg-yellow-200">
              <FolderSync size={14} />
              Sync
            </button>
          )}

          <Link
            href={`/dm/campaigns/${campaignId}/characters/${character.id}`}
            className="flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Eye size={14} />
            View
          </Link>

          <Link
            href={`/dm/campaigns/${campaignId}/combat?addCharacter=${character.id}`}
            className="flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-200"
          >
            <Sword size={14} />
            Add to Combat
          </Link>
        </div>

        {/* DM Notes */}
        {character.dmNotes && (
          <div className="mt-4 rounded-md bg-purple-50 p-3">
            <h4 className="mb-1 text-sm font-medium text-purple-800">
              DM Notes
            </h4>
            <p className="text-sm text-purple-700">{character.dmNotes}</p>
          </div>
        )}

        {/* Warnings */}
        {character.syncStatus === 'conflict' && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">Sync Conflict</span>
            </div>
            <p className="mt-1 text-sm text-red-700">
              Character data has been modified both here and by the player.
              Manual resolution required.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="campaign-characters-page">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href={`/dm/campaigns/${campaignId}`}
          className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={20} />
          Back to Campaign
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800">
            Character Management
          </h1>
          <p className="text-slate-600">
            Manage player characters in &quot;{campaign.name}&quot;
          </p>
        </div>
        <Link
          href={`/dm/campaigns/${campaignId}/characters/import`}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Import Characters
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-500" />
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
            <Crown className="mr-3 h-8 w-8 text-purple-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {activeCharacters.reduce((avg, char) => avg + char.level, 0) /
                  (activeCharacters.length || 1)}
              </h3>
              <p className="text-slate-600">Average Level</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <FolderSync className="mr-3 h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {
                  campaign.playerCharacters.filter(
                    pc => pc.syncStatus === 'synced'
                  ).length
                }
              </h3>
              <p className="text-slate-600">Synced</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <AlertTriangle className="mr-3 h-8 w-8 text-red-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {
                  campaign.playerCharacters.filter(
                    pc =>
                      pc.syncStatus === 'conflict' || pc.syncStatus === 'error'
                  ).length
                }
              </h3>
              <p className="text-slate-600">Issues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCharacters.length > 0 && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-800">
              {selectedCharacters.length} character
              {selectedCharacters.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700">
                Add to Combat
              </button>
              <button className="rounded-md bg-yellow-600 px-3 py-1 text-sm text-white transition-colors hover:bg-yellow-700">
                Sync All
              </button>
              <button
                onClick={() => setSelectedCharacters([])}
                className="rounded-md bg-slate-600 px-3 py-1 text-sm text-white transition-colors hover:bg-slate-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Characters */}
      {campaign.playerCharacters.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-md">
          <Users size={64} className="mx-auto mb-6 text-gray-400" />
          <h3 className="mb-2 text-xl font-semibold text-slate-800">
            No Characters Imported
          </h3>
          <p className="mb-6 text-slate-600">
            Import player character sheets to start managing your campaign
            roster.
          </p>
          <Link
            href={`/dm/campaigns/${campaignId}/characters/import`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={20} />
            Import Characters
          </Link>
        </div>
      ) : (
        <>
          {/* Active Characters */}
          {activeCharacters.length > 0 && (
            <div className="mb-12">
              <h2 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-800">
                <Users size={24} />
                Active Characters ({activeCharacters.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {activeCharacters.map(character => (
                  <CharacterCard key={character.id} character={character} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Characters */}
          {inactiveCharacters.length > 0 && (
            <div>
              <h2 className="mb-6 flex items-center gap-2 text-2xl font-semibold text-slate-700">
                <Users size={24} className="text-gray-500" />
                Inactive Characters ({inactiveCharacters.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {inactiveCharacters.map(character => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    isInactive
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
