'use client';

import { Button } from '@/components/ui/forms/button';
import RichTextRenderer from '@/components/ui/utils/RichTextRenderer';
import type { CampaignNPC } from '@/types/encounter';

interface LoreTabProps {
  npc: CampaignNPC;
  /** Opens the editor; omit it to hide the "Add lore" button. */
  onAddLore?: () => void;
}

export function LoreTab({ npc, onAddLore }: LoreTabProps) {
  if (npc.loreHtml) return <RichTextRenderer content={npc.loreHtml} />;
  return (
    <div className="py-12 text-center">
      <p className="type-subheading text-heading">No lore yet</p>
      {onAddLore && (
        <Button className="mt-4" onClick={onAddLore}>
          Add lore
        </Button>
      )}
    </div>
  );
}
