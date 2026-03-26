'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Map } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import DmLocationEditor from '@/components/ui/campaign/location-map/DmLocationEditor';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';

export default function BattleMapEditorPage() {
  const params = useParams();
  const code = params.code as string;
  const id = params.id as string;
  const hasHydrated = useHydration();
  const { getBattleMap, updateBattleMap } = useBattleMapStore();
  const { dmId } = useDmStore();

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  const battleMap = getBattleMap(code, id);

  if (!battleMap) {
    return (
      <div className="bg-surface flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-heading text-lg font-semibold">
          Battle map not found
        </p>
        <Link href={`/dm/campaign/${code}/battlemaps`}>
          <Button variant="ghost" leftIcon={<ArrowLeft size={16} />}>
            Back to Battle Maps
          </Button>
        </Link>
      </div>
    );
  }

  function handleSave(canvasState: string) {
    updateBattleMap(code, id, {
      canvasState,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSyncToPlayers() {
    // The editor's internal hook handles the actual sync POST.
    // This callback fires after a successful sync for any page-level side effects.
  }

  return (
    <div className="bg-surface flex h-screen flex-col overflow-hidden">
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href={`/dm/campaign/${code}/battlemaps`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Battle Maps
                </Button>
              </Link>
              <div className="ml-6 flex items-center">
                <Map className="text-accent-orange-text mr-3 h-6 w-6" />
                <h1 className="text-heading text-xl font-bold">
                  {battleMap.name}
                </h1>
              </div>
            </div>
            <ThemeToggle showSystemOption />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DmLocationEditor
          location={battleMap}
          campaignCode={code}
          dmId={dmId}
          mode="battlemap"
          onSave={handleSave}
          onSyncToPlayers={handleSyncToPlayers}
        />
      </main>
    </div>
  );
}
