'use client';

import { useMemo } from 'react';

import { buildNpcEntity } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import { SavedCreaturePicker } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/SavedCreaturePicker';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';

import { creatureFromEntity } from './tableRosterModel';

const NO_NPCS: CampaignNPC[] = [];

/**
 * Read-only campaign NPC picker: the library is only read, never created
 * or deleted from the Table route; the pick becomes a Table-local copy.
 */
export function TableAddNpcTab({
  campaignCode,
  onAdd,
}: {
  campaignCode: string;
  onAdd: (stats: ReturnType<typeof creatureFromEntity>) => void;
}) {
  const library = useNPCStore(
    state => state.npcsByCampaign[campaignCode] ?? NO_NPCS
  );
  const npcs = useMemo(
    () => library.filter(npc => (npc.kind ?? 'npc') === 'npc'),
    [library]
  );

  return (
    <SavedCreaturePicker
      creatures={npcs}
      emptyMessage="No campaign NPCs yet. Create them on the campaign page."
      onSelect={npc =>
        onAdd(
          creatureFromEntity(
            buildNpcEntity(npc, {
              isHidden: false,
              playerDisposition: 'neutral',
              campaignCode,
            }),
            'campaign-npc'
          )
        )
      }
    />
  );
}
