'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { BattleMapPickerDialog } from '@/components/ui/campaign/battle-map/BattleMapPickerDialog';
import { useBattleMapStore } from '@/store/battleMapStore';
import { findLinkedBattleMap } from '@/utils/battleMapLinks';

interface EncounterBattleMapButtonProps {
  campaignCode: string;
  encounterId: string;
}

/**
 * Combat-header entry to the encounter's battle map. Linked → one-click
 * open (hot path mid-session) with a chevron for switching; unlinked →
 * opens the picker.
 */
export function EncounterBattleMapButton({
  campaignCode,
  encounterId,
}: EncounterBattleMapButtonProps) {
  const { getBattleMaps } = useBattleMapStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  const linked = findLinkedBattleMap(getBattleMaps(campaignCode), encounterId);

  return (
    <>
      {linked ? (
        <div className="flex items-center gap-0.5">
          <Link href={`/dm/campaign/${campaignCode}/battlemaps/${linked.id}`}>
            <Button variant="secondary" size="sm" aria-label="Open battle map">
              <MapIcon size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Open Battle Map</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPickerOpen(true)}
            aria-label="Change battle map"
            title="Change battle map"
          >
            <ChevronDown size={16} />
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPickerOpen(true)}
          aria-label="Battle map"
        >
          <MapIcon size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Battle Map</span>
        </Button>
      )}
      <BattleMapPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        campaignCode={campaignCode}
        encounterId={encounterId}
      />
    </>
  );
}
