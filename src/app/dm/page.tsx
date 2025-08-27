'use client';

import { Users, Sword, FileText, Settings, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DMDashboard() {
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
        <h2 className="mb-4 text-xl font-semibold text-slate-800">
          Recent Activity
        </h2>
        <div className="py-8 text-center text-slate-500">
          <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No recent activity. Create your first campaign to get started!</p>
        </div>
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
