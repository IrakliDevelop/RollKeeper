'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { HeaderTrailing } from '@/components/auth/HeaderTrailing';
import { CampaignSettingsSyncControls } from '@/components/ui/campaign/CampaignSettingsSyncControls';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import DmLocationEditor from '@/components/ui/campaign/location-map/DmLocationEditor';
import { DmVttScreen } from '@/components/ui/campaign/dm-vtt/DmVttScreen';
import { DmVttTopBar } from '@/components/ui/campaign/dm-vtt/DmVttTopBar';
import { VttErrorFallback } from '@/components/ui/campaign/dm-vtt/VttErrorFallback';
import { useBattleMapMode } from '@/components/ui/campaign/dm-vtt/useBattleMapMode';
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
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === code)
  );

  const { mode, handleModeChange } = useBattleMapMode(id, hasHydrated, () =>
    getBattleMap(code, id)
  );

  if (!hasHydrated || mode === null) {
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

  if (mode === 'play') {
    return (
      <>
        {campaign && (
          <CampaignSettingsSyncControls campaign={campaign} headless />
        )}
        <ErrorBoundary fallback={<VttErrorFallback />}>
          <DmVttScreen
            campaignCode={code}
            battleMapId={id}
            dmId={dmId}
            mode={mode}
            onModeChange={handleModeChange}
          />
        </ErrorBoundary>
      </>
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
      {campaign && (
        <CampaignSettingsSyncControls campaign={campaign} headless />
      )}
      <header className="border-divider bg-surface-secondary border-b">
        <DmVttTopBar
          campaignCode={code}
          battleMapId={id}
          dmId={dmId}
          mapName={battleMap.name}
          mode="setup"
          onModeChange={handleModeChange}
          showDisplay={false}
          trailing={<HeaderTrailing showSystemOption />}
        />
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
