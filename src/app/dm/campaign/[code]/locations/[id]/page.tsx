'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
import { CampaignSettingsSyncControls } from '@/components/ui/campaign/CampaignSettingsSyncControls';
import DmLocationEditor from '@/components/ui/campaign/location-map/DmLocationEditor';
import { useLocationStore } from '@/store/locationStore';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';

export default function LocationEditorPage() {
  const params = useParams();
  const code = params.code as string;
  const id = params.id as string;
  const hasHydrated = useHydration();
  const { getLocation, updateLocation } = useLocationStore();
  const { dmId } = useDmStore();
  const campaign = useDmStore(state =>
    state.campaigns.find(item => item.code === code)
  );

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-dvh items-center justify-center">
        <p className="text-muted">Loading location…</p>
      </div>
    );
  }

  const location = getLocation(code, id);

  if (!location) {
    return (
      <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="type-subheading text-heading">Location not found</p>
        <p className="type-body text-muted">
          It was deleted, or the link is out of date.
        </p>
        <Button asChild variant="ghost" leftIcon={<ArrowLeft size={16} />}>
          <Link href={`/dm/campaign/${code}/locations`}>Back to locations</Link>
        </Button>
      </div>
    );
  }

  function handleSave(canvasState: string) {
    updateLocation(code, id, {
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
        crumb={{ href: `/dm/campaign/${code}/locations`, label: 'Locations' }}
        title={
          <h1 className="type-heading text-heading truncate">
            {location.name}
          </h1>
        }
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DmLocationEditor
          location={location}
          campaignCode={code}
          dmId={dmId}
          onSave={handleSave}
          onSyncToPlayers={handleSyncToPlayers}
        />
      </main>
    </div>
  );
}
