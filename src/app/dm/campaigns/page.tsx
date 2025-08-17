'use client';

import Link from 'next/link';
import { Plus, FolderOpen, Users, Calendar, Archive, Sword } from 'lucide-react';
import { useDMStore } from '@/store/dmStore';

export default function DMCampaignsPage() {
  const { campaigns, setActiveCampaign } = useDMStore();
  
  const activeCampaigns = campaigns.filter(c => !c.isArchived);
  const archivedCampaigns = campaigns.filter(c => c.isArchived);
  
  // Calculate stats
  const totalSessions = campaigns.reduce((sum, c) => sum + c.sessions.length, 0);
  const totalPlayers = campaigns.reduce((sum, c) => sum + c.playerCharacters.length, 0);

  return (
    <div className="dm-campaigns-list">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Your Campaigns</h1>
        <Link href="/dm/campaigns/new" className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition-colors">
          <Plus size={18} />
          New Campaign
        </Link>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{activeCampaigns.length}</h3>
              <p className="text-slate-600">Active Campaigns</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{totalSessions}</h3>
              <p className="text-slate-600">Total Sessions</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Archive className="h-8 w-8 text-slate-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{archivedCampaigns.length}</h3>
              <p className="text-slate-600">Archived</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Sword className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">{totalPlayers}</h3>
              <p className="text-slate-600">Total Players</p>
            </div>
          </div>
        </div>
      </div>

      {activeCampaigns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center py-12">
          <FolderOpen size={64} className="mx-auto mb-6 text-gray-400" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No campaigns found</h3>
          <p className="text-slate-600 text-lg mb-6">Start a new adventure and manage your D&D campaigns!</p>
          <Link href="/dm/campaigns/new" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Plus size={20} />
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* Active Campaigns */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Users size={20} />
              Active Campaigns ({activeCampaigns.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaigns.map(campaign => (
                <div key={campaign.id} className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-semibold text-slate-800">{campaign.name}</h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Active
                    </span>
                  </div>
                  
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">{campaign.description}</p>
                  
                  <div className="flex justify-between items-center text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      {campaign.playerCharacters.filter(pc => pc.isActive).length} players
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      {campaign.sessions.length} sessions
                    </div>
                  </div>
                  
                  {campaign.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {campaign.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                      {campaign.tags.length > 3 && (
                        <span className="text-xs text-slate-400">+{campaign.tags.length - 3} more</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Link 
                      href={`/dm/campaigns/${campaign.id}`}
                      onClick={() => setActiveCampaign(campaign.id)}
                      className="flex-1 text-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Open Campaign
                    </Link>
                    {campaign.encounters.length > 0 && (
                      <Link 
                        href={`/dm/campaigns/${campaign.id}/combat`}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                      >
                        Combat
                      </Link>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-slate-500">
                    Created: {new Date(campaign.createdAt).toLocaleDateString()}
                    {campaign.updatedAt !== campaign.createdAt && (
                      <span className="ml-2">• Updated: {new Date(campaign.updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Archived Campaigns */}
          {archivedCampaigns.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Archive size={20} />
                Archived Campaigns ({archivedCampaigns.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {archivedCampaigns.map(campaign => (
                  <div key={campaign.id} className="bg-gray-50 rounded-lg p-6 shadow-md border-l-4 border-gray-400">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-semibold text-slate-700">{campaign.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        Archived
                      </span>
                    </div>
                    
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{campaign.description}</p>
                    
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
                      <div className="flex items-center gap-1">
                        <Users size={12} />
                        {campaign.playerCharacters.length} players
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {campaign.sessions.length} sessions
                      </div>
                    </div>
                    
                    <Link 
                      href={`/dm/campaigns/${campaign.id}`}
                      className="block text-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                    >
                      View Archive
                    </Link>
                    
                    <div className="mt-3 pt-3 border-t border-gray-300 text-xs text-slate-400">
                      Created: {new Date(campaign.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}