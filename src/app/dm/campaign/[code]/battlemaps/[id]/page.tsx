'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CampaignSettingsSyncControls } from '@/components/ui/campaign/CampaignSettingsSyncControls';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import DmLocationEditor from '@/components/ui/campaign/location-map/DmLocationEditor';
import { DmVttScreen } from '@/components/ui/campaign/dm-vtt/DmVttScreen';
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
      <div className="bg-surface flex min-h-dvh items-center justify-center">
        <p className="text-muted">Loading battle map…</p>
      </div>
    );
  }

  const battleMap = getBattleMap(code, id);

  if (!battleMap) {
    return (
      <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="type-subheading text-heading">Battle map not found</p>
        <p className="type-body text-muted">
          It was deleted, or the link is out of date.
        </p>
        <Button asChild variant="ghost" leftIcon={<ArrowLeft size={16} />}>
          <Link href={`/dm/campaign/${code}/battlemaps`}>
            Back to battle maps
          </Link>
        </Button>
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
    <div className="bg-surface flex h-dvh flex-col overflow-hidden">
      {campaign && (
        <CampaignSettingsSyncControls campaign={campaign} headless />
      )}
      <CampaignHeader
        crumb={{
          href: `/dm/campaign/${code}/battlemaps`,
          label: 'Battle maps',
        }}
        title={
          <h1 className="type-heading text-heading truncate">
            {battleMap.name}
          </h1>
        }
        actions={
          <div
            role="group"
            aria-label="Mode"
            className="flex items-center gap-1"
          >
            <Button
              variant="secondary"
              size="sm"
              selected={mode === 'setup'}
              aria-pressed={mode === 'setup'}
              onClick={() => handleModeChange('setup')}
            >
              Setup
            </Button>
            {/* The play branch returned above, so Play is never current here. */}
            <Button
              variant="secondary"
              size="sm"
              selected={false}
              aria-pressed={false}
              onClick={() => handleModeChange('play')}
            >
              Play
            </Button>
          </div>
        }
      />

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
