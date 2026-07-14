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
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MapIcon size={16} />}
            >
              Open Battle Map
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
          leftIcon={<MapIcon size={16} />}
        >
          Battle Map
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
