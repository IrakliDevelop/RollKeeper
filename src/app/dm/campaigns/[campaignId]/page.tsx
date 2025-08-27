'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Settings,
  Sword,
  FileText,
  Plus,
  Calendar,
} from 'lucide-react';
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
      <div className="campaign-not-found py-12 text-center">
        <FileText size={64} className="mx-auto mb-6 text-gray-400" />
        <h1 className="mb-2 text-2xl font-bold text-slate-800">
          Campaign Not Found
        </h1>
        <p className="mb-6 text-slate-600">
          The campaign you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Link
          href="/dm/campaigns"
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
        >
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
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dm/campaigns"
          className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={20} />
          Back to Campaigns
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-800">
              {campaign.name}
            </h1>
            {campaign.isArchived && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                Archived
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="mt-1 text-slate-600">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Users className="mr-3 h-8 w-8 text-blue-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {activePlayers.length}
              </h3>
              <p className="text-slate-600">Active Players</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="mr-3 h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {campaign.sessions.length}
              </h3>
              <p className="text-slate-600">Sessions Played</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <Sword className="mr-3 h-8 w-8 text-red-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {campaign.encounters.length}
              </h3>
              <p className="text-slate-600">Encounters</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-center">
            <FileText className="mr-3 h-8 w-8 text-purple-500" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">
                {campaign.notes.length}
              </h3>
              <p className="text-slate-600">Notes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column - Players & Sessions */}
        <div className="space-y-8 lg:col-span-2">
          {/* Player Characters */}
          <div className="rounded-lg bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                <Users size={20} />
                Player Characters ({activePlayers.length})
              </h2>
              <Link
                href={`/dm/campaigns/${campaignId}/characters`}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              >
                <Users size={16} />
                Manage Characters
              </Link>
            </div>

            <div className="p-6">
              {activePlayers.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-800">
                    No player characters
                  </h3>
                  <p className="mb-4 text-slate-600">
                    Import player character sheets to start managing your
                    campaign.
                  </p>
                  <Link
                    href={`/dm/campaigns/${campaignId}/characters/import`}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    Import First Character
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {activePlayers.map(pc => (
                    <div
                      key={pc.id}
                      className="rounded-lg border border-slate-200 p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">
                          {pc.characterName}
                        </h3>
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                          Level {pc.level}
                        </span>
                      </div>
                      <p className="mb-1 text-sm text-slate-600">
                        {pc.race} {pc.class}
                      </p>
                      <p className="text-xs text-slate-500">
                        Player: {pc.playerName}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`/dm/campaigns/${campaignId}/characters/${pc.id}`}
                          className="flex-1 rounded bg-slate-100 px-2 py-1 text-center text-xs text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          View
                        </Link>
                        <button className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-200">
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
          <div className="rounded-lg bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                <Calendar size={20} />
                Recent Sessions
              </h2>
              <Link
                href={`/dm/campaigns/${campaignId}/sessions/new`}
                className="flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700"
              >
                <Plus size={16} />
                New Session
              </Link>
            </div>

            <div className="p-6">
              {recentSessions.length === 0 ? (
                <div className="py-8 text-center">
                  <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-800">
                    No sessions yet
                  </h3>
                  <p className="mb-4 text-slate-600">
                    Start logging your campaign sessions and track your
                    progress.
                  </p>
                  <Link
                    href={`/dm/campaigns/${campaignId}/sessions/new`}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                  >
                    <Plus size={16} />
                    Log First Session
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentSessions.map(session => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">
                          {session.name}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                      </div>
                      {session.summary && (
                        <p className="mb-2 text-sm text-slate-600">
                          {session.summary}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {session.presentPlayers.length} players present
                        </span>
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
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link
                href={`/dm/campaigns/${campaignId}/combat`}
                className="flex items-center gap-3 rounded-lg bg-red-50 p-3 transition-colors hover:bg-red-100"
              >
                <Sword className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Start Combat</span>
              </Link>

              <Link
                href={`/dm/campaigns/${campaignId}/characters`}
                className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 transition-colors hover:bg-blue-100"
              >
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  Manage Characters
                </span>
              </Link>

              <Link
                href={`/dm/campaigns/${campaignId}/sessions/new`}
                className="flex items-center gap-3 rounded-lg bg-green-50 p-3 transition-colors hover:bg-green-100"
              >
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Log Session</span>
              </Link>

              <Link
                href={`/dm/campaigns/${campaignId}/notes`}
                className="flex items-center gap-3 rounded-lg bg-purple-50 p-3 transition-colors hover:bg-purple-100"
              >
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-purple-800">
                  Campaign Notes
                </span>
              </Link>

              <Link
                href={`/dm/campaigns/${campaignId}/settings`}
                className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
              >
                <Settings className="h-5 w-5 text-slate-600" />
                <span className="font-medium text-slate-800">
                  Campaign Settings
                </span>
              </Link>
            </div>
          </div>

          {/* Campaign Info */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              Campaign Info
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Created:</span>
                <span className="ml-2 text-slate-800">
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Last Updated:</span>
                <span className="ml-2 text-slate-800">
                  {new Date(campaign.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {campaign.tags.length > 0 && (
                <div>
                  <span className="mb-2 block text-slate-500">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {campaign.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                      >
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
