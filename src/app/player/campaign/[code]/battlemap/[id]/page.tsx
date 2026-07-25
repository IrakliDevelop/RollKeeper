'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useHydration } from '@/hooks/useHydration';
import { markBattleMapJoined } from '@/hooks/useJoinedBattleMap';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { PlayerVttScreen } from '@/components/ui/campaign/player-vtt/PlayerVttScreen';
import { VttErrorFallback } from '@/components/ui/campaign/dm-vtt/VttErrorFallback';

function PlayerBattleMapPage() {
  const params = useParams();
  const search = useSearchParams();
  const code = params.code as string;
  const battleMapId = params.id as string;
  const characterId = search.get('character') ?? '';

  // Reaching this page at all counts as joining (covers deep links, not just
  // the sheet's Join banner) — hides the bottom banner back on the sheet.
  useEffect(() => {
    if (battleMapId) markBattleMapJoined(battleMapId);
  }, [battleMapId]);

  const hasHydrated = useHydration();
  const character = usePlayerStore(s =>
    s.characters.find(c => c.id === characterId)
  );

  if (!hasHydrated) return null;

  if (!characterId || !character) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <p className="text-body">
          Open the battle map from your character sheet&apos;s “Join map”
          banner.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<VttErrorFallback />}>
      <PlayerVttScreen
        campaignCode={code}
        battleMapId={battleMapId}
        characterId={characterId}
      />
    </ErrorBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlayerBattleMapPage />
    </Suspense>
  );
}
