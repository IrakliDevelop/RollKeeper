'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Settings, Sword, FileText, Plus, Calendar } from 'lucide-react';
import { useDMStore } from '@/store/dmStore';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  
  const { getCampaignById, setActiveCampaign } = useDMStore();
  const campaign = getCampaignById(campaignId);

  // Set this as the active campaign
  React.useEffect(() => {
    if (campaign) {
      setActiveCampaign(campaignId);
    }
  }, [campaign, campaignId, setActiveCampaign]);

  if (!campaign) {
    return (
      <div className="campaign-not-found text-center py-12">
        <FileText size={64} className="mx-auto mb-6 text-gray-400" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Campaign Not Found</h1>
        <p className="text-slate-600 mb-6">
          The campaign you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Link href="/dm/campaigns" className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          <ArrowLeft size={16} />
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const activePlayers = campaign.playerCharacters.filter(pc => pc.isActive);
  const recentSessions = campaign.sessions.slice(-3).reverse();

  return (
    <div className="campaign-detail-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dm/campaigns" className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          Back to Campaigns
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-800">{campaign.name}</h1>
            {campaign.isArchived && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                Archived
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="text-slate-600 mt-1">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{activePlayers.length}</h3>
              <p className="text-slate-600">Active Players</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{campaign.sessions.length}</h3>
              <p className="text-slate-600">Sessions Played</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Sword className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{campaign.encounters.length}</h3>
              <p className="text-slate-600">Encounters</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{campaign.notes.length}</h3>
              <p className="text-slate-600">Notes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Players & Sessions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Player Characters */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Users size={20} />
                Player Characters ({activePlayers.length})
              </h2>
              <Link href={`/dm/campaigns/${campaignId}/characters/import`} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
                <Plus size={16} />
                Import Characters
              </Link>
            </div>
            
            <div className="p-6">
              {activePlayers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No player characters</h3>
                  <p className="text-slate-600 mb-4">Import player character sheets to start managing your campaign.</p>
                  <Link href={`/dm/campaigns/${campaignId}/characters/import`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={16} />
                    Import First Character
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activePlayers.map(pc => (
                    <div key={pc.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-800">{pc.characterName}</h3>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Level {pc.level}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">
                        {pc.race} {pc.class}
                      </p>
                      <p className="text-xs text-slate-500">
                        Player: {pc.playerName}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link href={`/dm/campaigns/${campaignId}/characters/${pc.id}`} className="flex-1 text-center px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200 transition-colors">
                          View
                        </Link>
                        <button className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors">
                          Combat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Calendar size={20} />
                Recent Sessions
              </h2>
              <Link href={`/dm/campaigns/${campaignId}/sessions/new`} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm">
                <Plus size={16} />
                New Session
              </Link>
            </div>
            
            <div className="p-6">
              {recentSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No sessions yet</h3>
                  <p className="text-slate-600 mb-4">Start logging your campaign sessions and track your progress.</p>
                  <Link href={`/dm/campaigns/${campaignId}/sessions/new`} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <Plus size={16} />
                    Log First Session
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSessions.map(session => (
                    <div key={session.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-800">{session.name}</h3>
                        <span className="text-xs text-slate-500">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                      </div>
                      {session.summary && (
                        <p className="text-sm text-slate-600 mb-2">{session.summary}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{session.presentPlayers.length} players present</span>
                        {session.xpAwarded > 0 && (
                          <span>{session.xpAwarded} XP awarded</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions & Campaign Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href={`/dm/campaigns/${campaignId}/combat`} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                <Sword className="h-5 w-5 text-red-600" />
                <span className="text-red-800 font-medium">Start Combat</span>
              </Link>
              
              <Link href={`/dm/campaigns/${campaignId}/characters/import`} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800 font-medium">Import Characters</span>
              </Link>
              
              <Link href={`/dm/campaigns/${campaignId}/sessions/new`} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="text-green-800 font-medium">Log Session</span>
              </Link>
              
              <Link href={`/dm/campaigns/${campaignId}/notes`} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="text-purple-800 font-medium">Campaign Notes</span>
              </Link>
              
              <Link href={`/dm/campaigns/${campaignId}/settings`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <Settings className="h-5 w-5 text-slate-600" />
                <span className="text-slate-800 font-medium">Campaign Settings</span>
              </Link>
            </div>
          </div>

          {/* Campaign Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Campaign Info</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Created:</span>
                <span className="ml-2 text-slate-800">{new Date(campaign.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500">Last Updated:</span>
                <span className="ml-2 text-slate-800">{new Date(campaign.updatedAt).toLocaleDateString()}</span>
              </div>
              {campaign.tags.length > 0 && (
                <div>
                  <span className="text-slate-500 block mb-2">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {campaign.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
