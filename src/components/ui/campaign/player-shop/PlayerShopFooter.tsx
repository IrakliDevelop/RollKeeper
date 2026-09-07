import type { Currency } from '@/types/character';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { formatPurseLine } from './PlayerShopDialog.utils';

/**
 * "Your purse" + the post-purchase preview (artboard 1b). `after` is the
 * caller's `spendCopper(purse, previewCostCopper)` result — the exact same
 * `currency.ts` helper the real debit will run, applied speculatively to the
 * item/quantity currently focused — so this preview line can never disagree
 * with what a purchase would actually leave in the purse. `after === null`
 * (can't afford, or nothing to preview) hides the second line entirely.
 */
export function PlayerShopFooter({
  purse,
  previewLabel,
  previewCostCopper,
  after,
}: {
  purse: Currency;
  previewLabel: string | null;
  previewCostCopper: number;
  after: Currency | null;
}) {
  return (
    <div className="border-divider bg-surface-secondary flex flex-col gap-2.5 rounded-lg border-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-heading text-base font-semibold">Your purse</span>
        <span className="text-heading text-base font-bold tabular-nums">
          {formatPurseLine(purse)}
        </span>
      </div>
      {previewLabel && after && (
        <div className="border-divider flex flex-wrap items-center justify-between gap-4 border-t pt-2.5">
          <span className="text-body text-sm">
            After buying {previewLabel} —{' '}
            {formatCurrencyFromCopper(previewCostCopper)}
          </span>
          <span className="text-accent-emerald-text text-base font-bold tabular-nums">
            {formatPurseLine(after)}
          </span>
        </div>
      )}
    </div>
  );
}
