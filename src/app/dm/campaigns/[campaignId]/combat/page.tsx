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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <h1 className="mb-2 text-2xl font-bold text-slate-800">
              Campaign Not Found
            </h1>
            <p className="mb-4 text-slate-600">
              The requested campaign could not be found.
            </p>
            <Link
              href="/dm"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dm/campaigns/${campaignId}`}
                className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                <span>Back to Campaign</span>
              </Link>

              <div className="h-6 w-px bg-gray-300" />

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <Swords className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Combat Tracker
                  </h1>
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CombatCanvas campaignId={campaignId} />
      </main>
    </div>
  );
}
