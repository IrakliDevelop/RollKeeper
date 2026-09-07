'use client';

import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';
import { MAX_SHOP_DESCRIPTION_LENGTH } from './NPCShopTab.utils';
import type { ShopOpenSectionProps } from './NPCShopTab.types';

/**
 * The Shop tab's header block: the "Open for business" toggle, the
 * merchant's purse, and the player-facing shop description. Extracted from
 * `NPCShopTab/index.tsx` (Task 13a) to keep that file under the ~150-line
 * budget.
 *
 * The description field is deliberately its own labeled control, never
 * `CampaignNPC.description` — that field is the DM's private note (shown
 * only in DM surfaces, authored under a "Brief description" placeholder with
 * no hint it could ever be public) and publishing it would leak DM-only
 * content the instant a shop opens. See `shopProjection.ts`'s
 * `buildPublicShop` doc comment (controller ruling R17).
 */
export function ShopOpenSection({
  npcName,
  shopOpen,
  description,
  readOnly,
  publishError,
  currency,
  onSetOpen,
  onSetDescription,
  onSetCurrency,
}: ShopOpenSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Switch
          checked={shopOpen}
          disabled={readOnly}
          onCheckedChange={onSetOpen}
          aria-label="Open for business"
          label="Open for business"
          description="Players can't see this stock yet. Turn it on to publish."
        />
        <NPCCurrencyStrip
          currency={currency}
          readonly={readOnly}
          onChange={readOnly ? undefined : onSetCurrency}
          label="Merchant's purse"
        />
      </div>

      <Input
        id="shop-description"
        label="Shown to players as"
        value={description}
        onChange={event => onSetDescription(event.target.value)}
        placeholder="Ironmonger of the Low Market"
        helperText={`Visible to players under ${npcName}'s name once the shop is open — unlike the private description elsewhere, which players never see.`}
        maxLength={MAX_SHOP_DESCRIPTION_LENGTH}
        disabled={readOnly}
      />

      {publishError && (
        <p role="alert" className="text-accent-red-text text-sm">
          {publishError}
        </p>
      )}
    </div>
  );
}
