'use client';

import React, { useEffect } from 'react';
import { Users, Sword, FileText, Settings, Plus, Crown, Calendar, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useCampaignStore } from '@/store/campaignStore';
import { useAuth } from '@/contexts/AuthContext';

export default function DMDashboard() {
  const { isAuthenticated } = useAuth();
  const { 
    campaigns, 
    isLoading, 
    error, 
    fetchCampaigns, 
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
  const recentCampaigns = activeCampaigns
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

  // Calculate stats
  const totalMembers = campaigns.reduce(
    (sum, c) => sum + (c.memberCount || 0),
    0
  );
  return (
    <div className="dm-dashboard">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-800">
          Dungeon Master Dashboard
        </h1>
        <p className="text-slate-600">
          Manage your campaigns, track combat encounters, and organize your D&D
          sessions.
        </p>
        
        {/* Quick Stats */}
        {isAuthenticated && !isLoading && (
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-600" />
              <span className="text-slate-600">
                <strong className="text-slate-800">{dmCampaigns.length}</strong> campaigns as DM
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-slate-600">
                <strong className="text-slate-800">{totalMembers}</strong> total players
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-slate-600">
                <strong className="text-slate-800">{playerCampaigns.length}</strong> campaigns as player
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dm/campaigns/new"
          className="rounded-lg border-l-4 border-purple-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="mb-4 flex items-center">
            <Plus className="mr-3 h-8 w-8 text-purple-500" />
            <h3 className="text-lg font-semibold text-slate-800">
              New Campaign
            </h3>
          </div>
          <p className="text-slate-600">
            Start a new D&D campaign and begin managing your adventure.
          </p>
        </Link>

        <Link
          href="/dm/campaigns"
          className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="mb-4 flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-500" />
            <h3 className="text-lg font-semibold text-slate-800">Campaigns</h3>
          </div>
          <p className="text-slate-600">
            View and manage all your active and archived campaigns.
          </p>
        </Link>

        <div className="rounded-lg border-l-4 border-red-500 bg-white p-6 opacity-75 shadow-md">
          <div className="mb-4 flex items-center">
            <Sword className="mr-3 h-8 w-8 text-red-500" />
            <h3 className="text-lg font-semibold text-slate-800">
              Combat Tracker
            </h3>
          </div>
          <p className="text-slate-600">
            Track initiative, HP, and resources during combat encounters.
          </p>
          <span className="mt-2 block text-xs text-slate-500">Coming Soon</span>
        </div>

        <Link
          href="/dm/settings"
          className="rounded-lg border-l-4 border-green-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="mb-4 flex items-center">
            <Settings className="mr-3 h-8 w-8 text-green-500" />
            <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
          </div>
          <p className="text-slate-600">
            Configure your DM preferences and automation settings.
          </p>
        </Link>
      </div>

      {/* Recent Activity Section */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Recent Campaigns</h2>
          <Link
            href="/dm/campaigns"
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
          >
            View All
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600">Loading campaigns...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Failed to load campaigns: {error}</span>
          </div>
        )}

        {/* Authentication Required */}
        {!isAuthenticated && (
          <div className="py-8 text-center text-slate-500">
            <Crown className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2">Sign in to view your campaigns</p>
            <Link
              href="/auth"
              className="text-purple-600 hover:text-purple-700"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Empty State */}
        {isAuthenticated && !isLoading && !error && recentCampaigns.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2">No campaigns yet. Create your first campaign to get started!</p>
            <Link
              href="/dm/campaigns/new"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Link>
          </div>
        )}

        {/* Recent Campaigns List */}
        {isAuthenticated && !isLoading && !error && recentCampaigns.length > 0 && (
          <div className="space-y-4">
            {recentCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Crown className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800">{campaign.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {campaign.memberCount || 0} players
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated {new Date(campaign.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/dm/campaigns/${campaign.id}`}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
                >
                  Manage
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Beta Notice */}
      <div className="mt-8 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
              Beta
            </span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-slate-800">
              DM Toolset is in Beta
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              This module is actively being developed. Features will be added
              incrementally while maintaining compatibility with your existing
              character sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
