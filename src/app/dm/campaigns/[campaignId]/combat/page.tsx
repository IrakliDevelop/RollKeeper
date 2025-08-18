'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Swords } from 'lucide-react';
import { CombatCanvas } from '@/components/dm/CombatTracker/CombatCanvas';
import { useDMStore } from '@/store/dmStore';

export default function CombatTrackerPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  
  const { getCampaignById } = useDMStore();
  const campaign = getCampaignById(campaignId);

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Campaign Not Found</h1>
            <p className="text-slate-600 mb-4">The requested campaign could not be found.</p>
            <Link
              href="/dm"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href={`/dm/campaigns/${campaignId}`}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back to Campaign</span>
              </Link>
              
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Swords className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Combat Tracker</h1>
                  <p className="text-sm text-gray-600">{campaign.name}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Campaign:</span> {campaign.name}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CombatCanvas campaignId={campaignId} />
      </main>
    </div>
  );
}
