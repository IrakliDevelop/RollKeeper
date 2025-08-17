'use client';

import { Users, Sword, FileText, Settings, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DMDashboard() {
  return (
    <div className="dm-dashboard">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Dungeon Master Dashboard
        </h1>
        <p className="text-slate-600">
          Manage your campaigns, track combat encounters, and organize your D&D sessions.
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link
          href="/dm/campaigns/new"
          className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-purple-500"
        >
          <div className="flex items-center mb-4">
            <Plus className="h-8 w-8 text-purple-500 mr-3" />
            <h3 className="text-lg font-semibold text-slate-800">New Campaign</h3>
          </div>
          <p className="text-slate-600">Start a new D&D campaign and begin managing your adventure.</p>
        </Link>

        <Link
          href="/dm/campaigns"
          className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-blue-500"
        >
          <div className="flex items-center mb-4">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <h3 className="text-lg font-semibold text-slate-800">Campaigns</h3>
          </div>
          <p className="text-slate-600">View and manage all your active and archived campaigns.</p>
        </Link>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500 opacity-75">
          <div className="flex items-center mb-4">
            <Sword className="h-8 w-8 text-red-500 mr-3" />
            <h3 className="text-lg font-semibold text-slate-800">Combat Tracker</h3>
          </div>
          <p className="text-slate-600">Track initiative, HP, and resources during combat encounters.</p>
          <span className="text-xs text-slate-500 mt-2 block">Coming Soon</span>
        </div>

        <Link
          href="/dm/settings"
          className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-green-500"
        >
          <div className="flex items-center mb-4">
            <Settings className="h-8 w-8 text-green-500 mr-3" />
            <h3 className="text-lg font-semibold text-slate-800">Settings</h3>
          </div>
          <p className="text-slate-600">Configure your DM preferences and automation settings.</p>
        </Link>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No recent activity. Create your first campaign to get started!</p>
        </div>
      </div>

      {/* Beta Notice */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Beta
            </span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-slate-800">
              DM Toolset is in Beta
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              This module is actively being developed. Features will be added incrementally while maintaining compatibility with your existing character sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
