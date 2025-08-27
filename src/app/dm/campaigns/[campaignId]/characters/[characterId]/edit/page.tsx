'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function DMEditCharacterPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;
  const characterId = params.characterId as string;

  useEffect(() => {
    // Redirect to the character view page for now
    // In the future, this could be a dedicated edit interface
    window.location.replace(
      `/dm/campaigns/${campaignId}/characters/${characterId}`
    );
  }, [campaignId, characterId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <p className="text-gray-600">Redirecting to character view...</p>
      </div>
    </div>
  );
}
