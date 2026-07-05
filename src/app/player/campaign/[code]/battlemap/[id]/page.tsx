'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useHydration } from '@/hooks/useHydration';
import { PlayerBattleMapView } from '@/components/ui/campaign/location-map/PlayerBattleMapView';

function PlayerBattleMapPage() {
  const params = useParams();
  const search = useSearchParams();
  const code = params.code as string;
  const battleMapId = params.id as string;
  const characterId = search.get('character') ?? '';

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
    <PlayerBattleMapView
      campaignCode={code}
      battleMapId={battleMapId}
      characterId={characterId}
      characterAvatar={character.avatar}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlayerBattleMapPage />
    </Suspense>
  );
}
