'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Heart,
  Shield,
  Zap,
  BookOpen,
  Sword,
  Eye,
  EyeOff,
  Crown,
  Activity,
  Target,
  Flame,
  Snowflake,
  Bolt,
  Skull,
  AlertTriangle,
  Loader2,
  Settings,
  Edit,
  Save,
  X,
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { useAuth } from '@/contexts/AuthContext';

export default function CharacterDetailPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const characterId = params.characterId as string;

  const { isAuthenticated } = useAuth();
  const { getCampaignById, fetchCampaigns, isLoading } = useCampaignStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [dmNotes, setDmNotes] = useState('');

  // Fetch campaigns on mount if needed
  useEffect(() => {
    if (isAuthenticated && !getCampaignById(campaignId)) {
      fetchCampaigns();
    }
  }, [isAuthenticated, campaignId, fetchCampaigns, getCampaignById]);

  const campaign = getCampaignById(campaignId);
  const isDM = campaign?.userRole === 'dm';

  // Find the character
  const campaignMembers = campaign?.campaign_members || [];
  const characterMember = campaignMembers.find(
    member => member.characters?.id === characterId
  );

  const character = characterMember?.characters;
  const characterData = character?.character_data;
  const player = characterMember?.users;

  // Helper functions for character data
  const getAbilityModifier = (score: number) => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const getSpellSlotsByLevel = (characterData: any) => {
    const spellSlots = characterData?.spellSlots || {};
    const slots = [];
    
    for (let level = 1; level <= 9; level++) {
      const levelSlots = spellSlots[level];
      if (levelSlots && levelSlots.max > 0) {
        slots.push({
          level,
          max: levelSlots.max,
          used: levelSlots.used || 0,
          available: levelSlots.max - (levelSlots.used || 0),
        });
      }
    }
    
    return slots;
  };

  const getSavingThrows = (characterData: any) => {
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const savingThrows = characterData?.savingThrows || {};
    
    return abilities.map(ability => ({
      name: ability,
      value: savingThrows[ability] || 0,
      proficient: characterData?.proficiencies?.savingThrows?.includes(ability) || false,
    }));
  };

  const getSkills = (characterData: any) => {
    const skills = characterData?.skills || {};
    const proficiencies = characterData?.proficiencies?.skills || [];
    
    return Object.entries(skills).map(([skill, value]) => ({
      name: skill,
      value: value as number,
      proficient: proficiencies.includes(skill),
    }));
  };

  // Loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Loading character details...</p>
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

  if (!campaign || !character || !characterData) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Character Not Found</h1>
        <Link 
          href={`/dm/campaigns/${campaignId}/characters`} 
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Characters
        </Link>
      </div>
    );
  }

  if (!isDM) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Access Denied</h1>
        <p className="text-slate-600">Only campaign DMs can view character details.</p>
      </div>
    );
  }

  const level = characterData?.level || characterData?.totalLevel || 1;
  const characterClass = characterData?.classes?.map((c: any) => c.className).join('/') || 'Unknown';
  const race = characterData?.race || 'Unknown';
  const hp = characterData?.hitPoints || { current: 0, max: 0, temporary: 0 };
  const ac = characterData?.armorClass || 0;
  const abilities = characterData?.abilityScores || {};
  const spellSlots = getSpellSlotsByLevel(characterData);
  const savingThrows = getSavingThrows(characterData);
  const skills = getSkills(characterData);

  return (
    <div className="character-detail-page">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href={`/dm/campaigns/${campaignId}/characters`}
            className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
          >
            <ArrowLeft size={20} />
            Back to Characters
          </Link>
        </div>
        
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{character.name}</h1>
                <p className="text-lg text-slate-600">
                  {race} {characterClass} (Level {level})
                </p>
                <p className="text-sm text-slate-500">
                  Player: {player?.display_name || player?.username}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link
                href={`/dm/campaigns/${campaignId}/combat?addCharacter=${character.id}`}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                <Sword size={16} />
                Add to Combat
              </Link>
              <button className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-white transition-colors hover:bg-slate-700">
                <Settings size={16} />
                Manage
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column - Core Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hit Points & AC */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <Heart className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-slate-800">Hit Points</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-900 mb-2">
                  {hp.current}
                  {hp.temporary > 0 && <span className="text-blue-600">+{hp.temporary}</span>}
                  <span className="text-2xl text-slate-500">/{hp.max}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-red-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, (hp.current / hp.max) * 100))}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">Armor Class</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-900">{ac}</div>
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Ability Scores</h3>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(ability => {
                const score = abilities[ability] || 10;
                const modifier = getAbilityModifier(score);
                return (
                  <div key={ability} className="text-center">
                    <div className="text-xs font-medium text-slate-600 uppercase mb-1">
                      {ability.slice(0, 3)}
                    </div>
                    <div className="rounded-lg border-2 border-slate-300 p-2">
                      <div className="text-lg font-bold text-slate-800">{score}</div>
                      <div className="text-sm text-slate-600">{formatModifier(modifier)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Saving Throws */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Saving Throws</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {savingThrows.map(save => (
                <div key={save.name} className="flex items-center justify-between p-2 rounded bg-slate-50">
                  <span className={`text-sm ${save.proficient ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {save.name.charAt(0).toUpperCase() + save.name.slice(1, 3)}
                  </span>
                  <span className={`text-sm ${save.proficient ? 'font-bold' : ''}`}>
                    {formatModifier(save.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Skills</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {skills.map(skill => (
                  <div key={skill.name} className="flex items-center justify-between p-2 rounded bg-slate-50">
                    <span className={`text-sm ${skill.proficient ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {skill.name.charAt(0).toUpperCase() + skill.name.slice(1)}
                    </span>
                    <span className={`text-sm ${skill.proficient ? 'font-bold' : ''}`}>
                      {formatModifier(skill.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Additional Info */}
        <div className="space-y-6">
          {/* Spell Slots */}
          {spellSlots.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-800">Spell Slots</h3>
              </div>
              <div className="space-y-3">
                {spellSlots.map(slot => (
                  <div key={slot.level} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      Level {slot.level}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {slot.available}/{slot.max}
                      </span>
                      <div className="flex gap-1">
                        {Array.from({ length: slot.max }, (_, i) => (
                          <div
                            key={i}
                            className={`h-3 w-3 rounded-full ${
                              i < slot.available ? 'bg-purple-600' : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Combat Stats */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Combat Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Initiative</span>
                <span className="font-medium">
                  {formatModifier(getAbilityModifier(abilities.dexterity || 10))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Speed</span>
                <span className="font-medium">{characterData?.speed || 30} ft</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Hit Dice</span>
                <span className="font-medium">{level}d{characterData?.hitDie || 8}</span>
              </div>
            </div>
          </div>

          {/* Character Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Character Info</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-600">Background:</span>
                <span className="ml-2 font-medium">{characterData?.background || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-slate-600">Alignment:</span>
                <span className="ml-2 font-medium">{characterData?.alignment || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-slate-600">Experience:</span>
                <span className="ml-2 font-medium">{characterData?.experience || 0} XP</span>
              </div>
            </div>
          </div>

          {/* DM Notes */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">DM Notes</h3>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                {isEditing ? <X size={14} /> : <Edit size={14} />}
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={dmNotes}
                  onChange={(e) => setDmNotes(e.target.value)}
                  placeholder="Add private notes about this character..."
                  className="w-full h-32 p-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700">
                    <Save size={14} />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                {dmNotes || 'No notes added yet. Click Edit to add private notes about this character.'}
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Player Info</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-600">Name:</span>
                <span className="ml-2 font-medium">{player?.display_name || player?.username}</span>
              </div>
              <div>
                <span className="text-slate-600">Joined:</span>
                <span className="ml-2 font-medium">
                  {new Date(characterMember?.joined_at || '').toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-600">Status:</span>
                <span className="ml-2">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Active
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}