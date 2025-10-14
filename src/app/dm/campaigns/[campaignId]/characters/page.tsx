'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Crown,
  Heart,
  Shield,
  Zap,
  BookOpen,
  Activity,
  Eye,
  Sword,
  Settings,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { useAuth } from '@/contexts/AuthContext';
import { CharacterState, MulticlassInfo, SpellSlots } from '@/types/character';

interface CharacterWithMember {
  id: string;
  name: string;
  characterData: CharacterState;
  playerName: string;
  playerId: string;
  memberId: string;
  joinedAt: string;
  isActive: boolean;
}

export default function CampaignCharactersPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const { isAuthenticated } = useAuth();
  const { getCampaignById, fetchCampaigns, isLoading } = useCampaignStore();

  // Fetch campaigns on mount if needed
  useEffect(() => {
    if (isAuthenticated && !getCampaignById(campaignId)) {
      fetchCampaigns();
    }
  }, [isAuthenticated, campaignId, fetchCampaigns, getCampaignById]);

  const campaign = getCampaignById(campaignId);
  const isDM = campaign?.userRole === 'dm';

  // Get characters from campaign members
  const campaignMembers = campaign?.campaign_members || [];
  const charactersWithMembers: CharacterWithMember[] = campaignMembers
    .filter(member => member.characters && member.users && member.is_active)
    .map(member => ({
      id: member.characters!.id,
      name: member.characters!.name,
      characterData: member.characters!.character_data as unknown as CharacterState,
      playerName: member.users!.display_name || member.users!.username,
      playerId: member.user_id,
      memberId: member.id,
      joinedAt: member.joined_at,
      isActive: member.is_active,
    }));

  // Helper functions
  const getCharacterLevel = (characterData: CharacterState) => {
    return characterData?.level || characterData?.totalLevel || 1;
  };

  const getCharacterClass = (characterData: CharacterState) => {
    if (characterData?.classes && characterData.classes.length > 0) {
      return characterData.classes.map((c: MulticlassInfo) => c.className).join(' / ');
    }
    return characterData?.class?.name || 'Unknown';
  };

  const getCharacterRace = (characterData: CharacterState) => {
    return characterData?.race || 'Unknown';
  };

  const getCharacterHP = (characterData: CharacterState) => {
    const hp = characterData?.hitPoints;
    return {
      current: hp?.current || 0,
      max: hp?.max || 0,
      temp: hp?.temporary || 0,
    };
  };

  const getCharacterAC = (characterData: CharacterState) => {
    return characterData?.armorClass || 0;
  };

  const getCharacterSpellSlots = (characterData: CharacterState) => {
    const spellSlots = characterData?.spellSlots;
    if (!spellSlots) return { total: 0, used: 0, available: 0 };
    
    let totalSlots = 0;
    let usedSlots = 0;
    
    for (let level = 1; level <= 9; level++) {
      const slots = spellSlots[level as keyof SpellSlots];
      if (slots) {
        totalSlots += slots.max || 0;
        usedSlots += slots.used || 0;
      }
    }
    
    return { total: totalSlots, used: usedSlots, available: totalSlots - usedSlots };
  };

  // Loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Loading campaign characters...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Authentication Required</h1>
        <p className="text-slate-600">Please sign in to access this page.</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Campaign Not Found</h1>
        <Link href="/dm/campaigns" className="text-blue-600 hover:text-blue-800">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  if (!isDM) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-slate-600">Only campaign DMs can manage characters.</p>
      </div>
    );
  }

  const CharacterCard = ({ character }: { character: CharacterWithMember }) => {
    const level = getCharacterLevel(character.characterData);
    const characterClass = getCharacterClass(character.characterData);
    const race = getCharacterRace(character.characterData);
    const hp = getCharacterHP(character.characterData);
    const ac = getCharacterAC(character.characterData);
    const spellSlots = getCharacterSpellSlots(character.characterData);

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-800">{character.name}</h3>
            <p className="text-slate-600">
              {race} {characterClass} (Level {level})
            </p>
            <p className="text-sm text-slate-500">Player: {character.playerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              Active
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {/* HP */}
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3">
            <Heart className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-sm font-medium text-red-800">Hit Points</div>
              <div className="text-lg font-bold text-red-900">
                {hp.current}{hp.temp > 0 && `+${hp.temp}`}/{hp.max}
              </div>
            </div>
          </div>

          {/* AC */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-medium text-blue-800">Armor Class</div>
              <div className="text-lg font-bold text-blue-900">{ac}</div>
            </div>
          </div>

          {/* Spell Slots */}
          {spellSlots.total > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-3">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-sm font-medium text-purple-800">Spell Slots</div>
                <div className="text-lg font-bold text-purple-900">
                  {spellSlots.available}/{spellSlots.total}
                </div>
              </div>
            </div>
          )}

          {/* Level */}
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
            <Crown className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="text-sm font-medium text-yellow-800">Level</div>
              <div className="text-lg font-bold text-yellow-900">{level}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dm/campaigns/${campaignId}/characters/${character.id}`}
            className="flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Eye size={14} />
            View Details
          </Link>
          
          <Link
            href={`/dm/campaigns/${campaignId}/combat?addCharacter=${character.id}`}
            className="flex items-center gap-1 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-200"
          >
            <Sword size={14} />
            Add to Combat
          </Link>

          <button className="flex items-center gap-1 rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200">
            <Settings size={14} />
            Manage
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>Joined: {new Date(character.joinedAt).toLocaleDateString()}</span>
            <span>Player ID: {character.playerId.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    );
  };

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
          <h1 className="text-3xl font-bold text-slate-800">Character Management</h1>
          <p className="text-slate-600">
            Manage player characters in &quot;{campaign.name}&quot;
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {charactersWithMembers.length}
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
                {charactersWithMembers.length > 0
                  ? Math.round(
                      charactersWithMembers.reduce(
                        (sum, char) => sum + getCharacterLevel(char.characterData),
                        0
                      ) / charactersWithMembers.length
                    )
                  : 0}
              </h3>
              <p className="text-slate-600">Average Level</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Activity className="mr-3 h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {charactersWithMembers.filter(char => {
                  const hp = getCharacterHP(char.characterData);
                  return hp.current > hp.max * 0.5;
                }).length}
              </h3>
              <p className="text-slate-600">Healthy</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <BookOpen className="mr-3 h-8 w-8 text-indigo-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {charactersWithMembers.filter(char => {
                  const slots = getCharacterSpellSlots(char.characterData);
                  return slots.total > 0;
                }).length}
              </h3>
              <p className="text-slate-600">Spellcasters</p>
            </div>
          </div>
        </div>
      </div>

      {/* Characters */}
      {charactersWithMembers.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-md">
          <Users size={64} className="mx-auto mb-6 text-gray-400" />
          <h3 className="mb-2 text-xl font-semibold text-slate-800">
            No Characters Found
          </h3>
          <p className="mb-6 text-slate-600">
            Players need to join this campaign with their characters to see them here.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href={`/dm/campaigns/${campaignId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
            >
              <Users size={20} />
              Manage Members
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-800">
              <Users size={24} />
              Campaign Characters ({charactersWithMembers.length})
            </h2>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {charactersWithMembers.map(character => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}