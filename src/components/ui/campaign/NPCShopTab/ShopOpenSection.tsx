'use client';

import { useId } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';
import {
  MAX_SHOP_DESCRIPTION_LENGTH,
  SHOP_CLOSED_SUBTITLE,
  SHOP_PUBLISH_ERROR_COPY,
  shopOpenSubtitle,
} from './NPCShopTab.utils';
import type { ShopOpenSectionProps } from './NPCShopTab.types';

/**
 * The Shop tab's header block: the "Open for business" switch with its
 * subtitle, the publish error and "Try again" when a request failed, the
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
  itemsInStock,
  todayCopper,
  onSetOpen,
  onRetryPublish,
  onSetDescription,
  onSetCurrency,
}: ShopOpenSectionProps) {
  const errorId = useId();
  const subtitle = shopOpen
    ? shopOpenSubtitle(npcName, itemsInStock)
    : SHOP_CLOSED_SUBTITLE;

  return (
    <div className="space-y-4">
      <Switch
        checked={shopOpen}
        disabled={readOnly}
        onCheckedChange={onSetOpen}
        label="Open for business"
        description={subtitle}
      />

      {publishError && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <p id={errorId} role="alert" className="type-small text-blood-text">
            {SHOP_PUBLISH_ERROR_COPY[publishError]}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-describedby={errorId}
            onClick={onRetryPublish}
          >
            Try again
          </Button>
        </div>
      )}

      <NPCCurrencyStrip
        currency={currency}
        readonly={readOnly}
        onChange={readOnly ? undefined : onSetCurrency}
        label="Merchant's purse"
        labelExtra={
          todayCopper > 0 ? (
            <span className="type-small text-muted tabular-nums">
              +{formatCurrencyFromCopper(todayCopper)} today
            </span>
          ) : undefined
        }
      />

      <Input
        id="shop-description"
        label="Shown to players as"
        value={description}
        onChange={event => onSetDescription(event.target.value)}
        placeholder="Ironmonger of the Low Market"
        helperText={`Players see this under ${npcName}'s name once the shop opens. Your private description stays hidden.`}
        maxLength={MAX_SHOP_DESCRIPTION_LENGTH}
        disabled={readOnly}
      />
    </div>
  );
}
