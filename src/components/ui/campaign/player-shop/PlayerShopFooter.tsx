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
    <dl className="border-divider flex flex-col gap-2 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <dt className="type-ui text-heading">Your purse</dt>
        <dd className="type-ui text-heading tabular-nums">
          {formatPurseLine(purse)}
        </dd>
      </div>
      {previewLabel && after && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <dt className="type-small text-body">
            After buying {previewLabel} —{' '}
            {formatCurrencyFromCopper(previewCostCopper)}
          </dt>
          <dd className="type-ui text-heading tabular-nums">
            {formatPurseLine(after)}
          </dd>
        </div>
      )}
    </dl>
  );
}
