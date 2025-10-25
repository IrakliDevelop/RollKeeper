'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Users,
  Calendar,
  Archive,
  Sword,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { useAuth } from '@/contexts/AuthContext';

export default function DMCampaignsPage() {
  const { isAuthenticated } = useAuth();
  const { 
    campaigns, 
    isLoading, 
    error, 
    fetchCampaigns, 
    setActiveCampaign,
    clearError,
    getDMCampaigns,
    getPlayerCampaigns 
  } = useCampaignStore();

  // Fetch campaigns on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchCampaigns();
    }
  }, [isAuthenticated, fetchCampaigns]);

  const dmCampaigns = getDMCampaigns();
  const playerCampaigns = getPlayerCampaigns();
  const activeCampaigns = campaigns.filter(c => c.is_active);

  // Calculate stats
  const totalMembers = campaigns.reduce(
    (sum, c) => sum + (c.memberCount || 0),
    0
  );

  const copyInviteCode = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to manage your campaigns.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading campaigns...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Error Loading Campaigns</h2>
          <p className="mb-4 text-gray-600">{error}</p>
          <button
            onClick={() => {
              clearError();
              fetchCampaigns();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-campaigns-list">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Your Campaigns</h1>
        <Link
          href="/dm/campaigns/new"
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-purple-700"
        >
          <Plus size={18} />
          New Campaign
        </Link>
      </div>

      {/* Campaign Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Sword className="mr-3 h-8 w-8 text-purple-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {dmCampaigns.length}
              </h3>
              <p className="text-slate-600">DM Campaigns</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {playerCampaigns.length}
              </h3>
              <p className="text-slate-600">Player Campaigns</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="mr-3 h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {activeCampaigns.length}
              </h3>
              <p className="text-slate-600">Total Active</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Archive className="mr-3 h-8 w-8 text-orange-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {totalMembers}
              </h3>
              <p className="text-slate-600">Total Members</p>
            </div>
          </div>
        </div>
      </div>

      {activeCampaigns.length === 0 ? (
        <div className="rounded-lg bg-white p-6 py-12 text-center shadow-md">
          <FolderOpen size={64} className="mx-auto mb-6 text-gray-400" />
          <h3 className="mb-2 text-xl font-semibold text-slate-800">
            No campaigns found
          </h3>
          <p className="mb-6 text-lg text-slate-600">
            Start a new adventure and manage your D&D campaigns!
          </p>
          <Link
            href="/dm/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-white transition-colors hover:bg-purple-700"
          >
            <Plus size={20} />
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* DM Campaigns */}
          {dmCampaigns.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-700">
                <Sword size={20} />
                Your DM Campaigns ({dmCampaigns.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {dmCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border-l-4 border-purple-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-xl font-semibold text-slate-800">
                        {campaign.name}
                      </h3>
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                        DM
                      </span>
                    </div>

                    <p className="mb-4 line-clamp-2 text-sm text-slate-600">
                      {campaign.description || 'No description provided'}
                    </p>

                    <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Users size={12} />
                        {campaign.memberCount || 0} members
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {campaign.invite_code && (
                      <div className="mb-4 flex items-center gap-2 rounded bg-gray-50 p-2">
                        <span className="text-xs text-gray-600">Invite Code:</span>
                        <code className="flex-1 text-xs font-mono text-gray-800">
                          {campaign.invite_code}
                        </code>
                        <button
                          onClick={() => copyInviteCode(campaign.invite_code!)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                          title="Copy invite code"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link
                        href={`/dm/campaigns/${campaign.id}`}
                        onClick={() => setActiveCampaign(campaign.id)}
                        className="flex-1 rounded-md bg-purple-600 px-3 py-2 text-center text-sm text-white transition-colors hover:bg-purple-700"
                      >
                        Manage Campaign
                      </Link>
                      <Link
                        href={`/dm/campaigns/${campaign.id}/combat`}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                      >
                        Combat
                      </Link>
                    </div>

                    <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-slate-500">
                      Created: {new Date(campaign.created_at).toLocaleDateString()}
                      {campaign.updated_at !== campaign.created_at && (
                        <span className="ml-2">
                          • Updated: {new Date(campaign.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player Campaigns */}
          {playerCampaigns.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-700">
                <Users size={20} />
                Player Campaigns ({playerCampaigns.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {playerCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-xl font-semibold text-slate-800">
                        {campaign.name}
                      </h3>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        Player
                      </span>
                    </div>

                    <p className="mb-4 line-clamp-2 text-sm text-slate-600">
                      {campaign.description || 'No description provided'}
                    </p>

                    <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Users size={12} />
                        {campaign.memberCount || 0} members
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        Joined: {new Date(campaign.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/dm/campaigns/${campaign.id}`}
                        onClick={() => setActiveCampaign(campaign.id)}
                        className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white transition-colors hover:bg-blue-700"
                      >
                        View Campaign
                      </Link>
                      <Link
                        href={`/dm/campaigns/${campaign.id}/combat`}
                        className="rounded-md bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700"
                      >
                        Join Combat
                      </Link>
                    </div>

                    <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-slate-500">
                      Created: {new Date(campaign.created_at).toLocaleDateString()}
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
