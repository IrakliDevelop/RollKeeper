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
    window.location.replace(`/dm/campaigns/${campaignId}/characters/${characterId}`);
  }, [campaignId, characterId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to character view...</p>
      </div>
    </div>
  );
}
