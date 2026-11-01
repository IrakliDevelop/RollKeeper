'use client';

import { useState } from 'react';
import { Package, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { ItemTransfer } from '@/types/sharedState';

interface ItemTransferNotificationProps {
  transfers: ItemTransfer[];
  onDismiss: (transferId: string) => void;
  onNavigateToInventory: () => void;
}

export function ItemTransferNotification({
  transfers,
  onDismiss,
  onNavigateToInventory,
}: ItemTransferNotificationProps) {
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  if (transfers.length === 0) return null;

  const visibleTransfers = transfers.filter(t => !dismissingIds.has(t.id));
  if (visibleTransfers.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      onDismiss(id);
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  const handleClick = (id: string) => {
    handleDismiss(id);
    onNavigateToInventory();
  };

  return (
    <div className="contents">
      {visibleTransfers.map(transfer => {
        const isDismissing = dismissingIds.has(transfer.id);
        const fromLabel =
          transfer.fromType === 'npc'
            ? `${transfer.fromCharacterName} (NPC)`
            : transfer.fromType === 'dm'
              ? 'DM Magic Item Library'
              : transfer.fromCharacterName;

        return (
          <div
            key={transfer.id}
            className={`border-divider bg-surface-elevated text-body pointer-events-auto rounded-md border p-4 transition-opacity duration-300 ${isDismissing ? 'opacity-0' : 'opacity-100'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <Package size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted text-sm font-semibold">
                    Item received
                  </p>
                  <p className="text-heading mt-1 text-base font-bold">
                    {transfer.item.name}
                    {'quantity' in transfer.item &&
                      transfer.item.quantity > 1 &&
                      ` (x${transfer.item.quantity})`}
                  </p>
                  <p className="text-muted mt-1 text-sm">From {fromLabel}</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(transfer.id)}
                className="text-muted hover:text-heading shrink-0 rounded-sm p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                title="Dismiss"
                aria-label={`Dismiss ${transfer.item.name} transfer`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Package size={14} />}
                onClick={() => handleClick(transfer.id)}
              >
                View in inventory
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
