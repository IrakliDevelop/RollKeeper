'use client';

import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Users,
  Calendar,
  Archive,
  Sword,
} from 'lucide-react';
import { useDMStore } from '@/store/dmStore';

export default function DMCampaignsPage() {
  const { campaigns, setActiveCampaign } = useDMStore();

  const activeCampaigns = campaigns.filter(c => !c.isArchived);
  const archivedCampaigns = campaigns.filter(c => c.isArchived);

  // Calculate stats
  const totalSessions = campaigns.reduce(
    (sum, c) => sum + c.sessions.length,
    0
  );
  const totalPlayers = campaigns.reduce(
    (sum, c) => sum + c.playerCharacters.length,
    0
  );

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
            <Users className="mr-3 h-8 w-8 text-blue-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {activeCampaigns.length}
              </h3>
              <p className="text-slate-600">Active Campaigns</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="mr-3 h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {totalSessions}
              </h3>
              <p className="text-slate-600">Total Sessions</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Archive className="mr-3 h-8 w-8 text-slate-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {archivedCampaigns.length}
              </h3>
              <p className="text-slate-600">Archived</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Sword className="mr-3 h-8 w-8 text-red-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {totalPlayers}
              </h3>
              <p className="text-slate-600">Total Players</p>
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
          {/* Active Campaigns */}
          <div className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-700">
              <Users size={20} />
              Active Campaigns ({activeCampaigns.length})
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeCampaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-slate-800">
                      {campaign.name}
                    </h3>
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                      Active
                    </span>
                  </div>

                  <p className="mb-4 line-clamp-2 text-sm text-slate-600">
                    {campaign.description}
                  </p>

                  <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      {
                        campaign.playerCharacters.filter(pc => pc.isActive)
                          .length
                      }{' '}
                      players
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      {campaign.sessions.length} sessions
                    </div>
                  </div>

                  {campaign.tags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1">
                      {campaign.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {campaign.tags.length > 3 && (
                        <span className="text-xs text-slate-400">
                          +{campaign.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/dm/campaigns/${campaign.id}`}
                      onClick={() => setActiveCampaign(campaign.id)}
                      className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white transition-colors hover:bg-blue-700"
                    >
                      Open Campaign
                    </Link>
                    {campaign.encounters.length > 0 && (
                      <Link
                        href={`/dm/campaigns/${campaign.id}/combat`}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                      >
                        Combat
                      </Link>
                    )}
                  </div>

                  <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-slate-500">
                    Created: {new Date(campaign.createdAt).toLocaleDateString()}
                    {campaign.updatedAt !== campaign.createdAt && (
                      <span className="ml-2">
                        • Updated:{' '}
                        {new Date(campaign.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Archived Campaigns */}
          {archivedCampaigns.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-700">
                <Archive size={20} />
                Archived Campaigns ({archivedCampaigns.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {archivedCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border-l-4 border-gray-400 bg-gray-50 p-6 shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-xl font-semibold text-slate-700">
                        {campaign.name}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        Archived
                      </span>
                    </div>

                    <p className="mb-4 line-clamp-2 text-sm text-slate-500">
                      {campaign.description}
                    </p>

                    <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
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
                      className="block rounded-md bg-gray-600 px-3 py-2 text-center text-sm text-white transition-colors hover:bg-gray-700"
                    >
                      View Archive
                    </Link>

                    <div className="mt-3 border-t border-gray-300 pt-3 text-xs text-slate-400">
                      Created:{' '}
                      {new Date(campaign.createdAt).toLocaleDateString()}
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
