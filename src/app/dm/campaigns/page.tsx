'use client';

import { Plus, Users, Calendar, Archive } from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  // This will eventually connect to our campaign store
  const campaigns: any[] = []; // Placeholder for campaigns

  return (
    <div className="campaigns-page">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Campaigns
          </h1>
          <p className="text-slate-600">
            Manage your D&D campaigns and adventures.
          </p>
        </div>
        <Link
          href="/dm/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          New Campaign
        </Link>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">0</h3>
              <p className="text-slate-600">Active Campaigns</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">0</h3>
              <p className="text-slate-600">Sessions This Month</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <Archive className="h-8 w-8 text-slate-500 mr-3" />
            <div>
              <h3 className="text-2xl font-bold text-slate-800">0</h3>
              <p className="text-slate-600">Archived Campaigns</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Your Campaigns</h2>
        </div>
        
        {campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No campaigns yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first campaign to start managing your D&D adventures.
            </p>
            <Link
              href="/dm/campaigns/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={20} />
              Create Your First Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-6 hover:bg-slate-50 transition-colors">
                {/* Campaign list items will go here */}
                <p>Campaign: {campaign.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
