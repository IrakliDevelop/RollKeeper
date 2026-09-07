'use client';

import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { cn } from '@/utils/cn';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';
import {
  MAX_SHOP_DESCRIPTION_LENGTH,
  SHOP_CLOSED_SUBTITLE,
  shopOpenSubtitle,
} from './NPCShopTab.utils';
import type { ShopOpenSectionProps } from './NPCShopTab.types';

/**
 * The Shop tab's header block: the "Open for business" toggle, the
 * merchant's purse, and the player-facing shop description. Extracted from
 * `NPCShopTab/index.tsx` (Task 13a) to keep that file under the ~150-line
 * budget.
 *
 * The toggle's bordered card and subtitle copy switch treatment (neutral vs.
 * emerald-tinted, and closed vs. open subtitle text) is artboard 1a's
 * open-state chrome (Task 13b) — a bare `Switch` with the closed copy
 * hardcoded regardless of state, as Slice 2 shipped it, is not what the
 * design shows once a shop can actually be open.
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
  onSetDescription,
  onSetCurrency,
}: ShopOpenSectionProps) {
  const subtitle = shopOpen
    ? shopOpenSubtitle(npcName, itemsInStock)
    : SHOP_CLOSED_SUBTITLE;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch justify-between gap-4">
        <div
          className={cn(
            'flex flex-1 items-center gap-3 rounded-lg border p-3',
            readOnly && 'opacity-70',
            shopOpen
              ? 'border-accent-emerald-border bg-accent-emerald-bg'
              : 'border-divider bg-surface-secondary'
          )}
        >
          <Switch
            checked={shopOpen}
            disabled={readOnly}
            onCheckedChange={onSetOpen}
            aria-label="Open for business"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-heading text-sm font-semibold">
              Open for business
            </span>
            <span
              className={cn(
                'text-xs',
                shopOpen ? 'text-accent-emerald-text' : 'text-body'
              )}
            >
              {subtitle}
            </span>
          </div>
        </div>
        <NPCCurrencyStrip
          currency={currency}
          readonly={readOnly}
          onChange={readOnly ? undefined : onSetCurrency}
          label="Merchant's purse"
          labelExtra={
            todayCopper > 0 ? (
              <span className="text-accent-emerald-text-muted font-semibold">
                +{formatCurrencyFromCopper(todayCopper)} today
              </span>
            ) : undefined
          }
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
