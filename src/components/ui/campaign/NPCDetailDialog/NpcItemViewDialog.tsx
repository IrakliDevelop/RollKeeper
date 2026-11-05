'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import RichTextRenderer from '@/components/ui/utils/RichTextRenderer';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { sentenceCase } from '../PlayerDetailDialog/shared';
import { itemKindParts } from './NPCDetailDialog.utils';
import type { NPCInventoryItem } from '@/types/encounter';

interface NpcItemViewDialogProps {
  item: NPCInventoryItem | null;
  onClose: () => void;
  onEdit?: () => void;
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="type-ui flex flex-wrap gap-x-1">
      <dt className="text-muted">{label}</dt>
      <dd className="text-heading">{children}</dd>
    </div>
  );
}

/** Totals for stacks of more than one, rounded as the old view did. */
const total = (each: number, quantity: number) =>
  parseFloat((each * quantity).toFixed(2));

/** The read-only view of one carried item. */
export function NpcItemViewDialog({
  item,
  onClose,
  onEdit,
}: NpcItemViewDialogProps) {
  // Keep the last item on screen while the dialog plays its exit.
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);
  if (!shown) return null;

  const description = [
    ...itemKindParts(shown),
    ...(shown.equipped ? ['Equipped'] : []),
  ].join(' · ');
  const stacked = shown.quantity > 1;

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent
        size="md"
        // Nothing to describe: say so, or Radix points at a missing node.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader>
          <DialogTitle>{shown.name}</DialogTitle>
          {description && (
            <DialogDescription className="type-body text-muted">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogBody className="space-y-4">
          <dl className="space-y-1">
            {shown.category && (
              <Fact label="Category">{sentenceCase(shown.category)}</Fact>
            )}
            <Fact label="Quantity">{shown.quantity}</Fact>
            {shown.weight !== undefined && (
              <Fact label="Weight">
                {shown.weight} lb each
                {stacked && (
                  <span className="text-muted">
                    {` (${total(shown.weight, shown.quantity)} lb total)`}
                  </span>
                )}
              </Fact>
            )}
            {shown.value !== undefined && (
              <Fact label="Value">
                {formatCurrencyFromCopper(shown.value)} each
                {stacked && (
                  <span className="text-muted">
                    {` (${formatCurrencyFromCopper(total(shown.value, shown.quantity))} total)`}
                  </span>
                )}
              </Fact>
            )}
          </dl>

          {shown.description && (
            <div>
              <h3 className="type-label-heading text-heading mb-1">
                Description
              </h3>
              <RichTextRenderer content={shown.description} />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {onEdit && <Button onClick={onEdit}>Edit item</Button>}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
