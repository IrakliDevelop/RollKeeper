'use client';

import { NPCDetailDialog } from '@/components/ui/campaign/NPCDetailDialog';
import { useNPCStore } from '@/store/npcStore';

import type { CampaignNPC } from '@/types/encounter';

interface DmVttNpcDialogProps {
  campaignCode: string;
  encounterId?: string;
  npc: CampaignNPC | null;
  entityId: string | null;
  onClose: () => void;
}

/**
 * Read-only NPC statblock dialog for the Selected tab's "View NPC details"
 * eye icon (`DetailHeader.tsx` gates on `npcSourceId && actions.onViewNPC`) —
 * mirrors the dialog `EncounterView` mounts for the same action
 * (`EncounterView.tsx:322-342`). Re-fetches the live NPC record so edits
 * made elsewhere (e.g. the NPC roster) show up, falling back to the
 * snapshot captured at click time if the NPC was since deleted.
 */
export function DmVttNpcDialog({
  campaignCode,
  encounterId,
  npc,
  entityId,
  onClose,
}: DmVttNpcDialogProps) {
  const getNPC = useNPCStore(state => state.getNPC);
  if (!npc) return null;

  return (
    <NPCDetailDialog
      npc={getNPC(campaignCode, npc.id) ?? npc}
      open
      onOpenChange={open => !open && onClose()}
      readOnly
      encounterId={encounterId}
      npcEntityId={entityId ?? undefined}
    />
  );
}
