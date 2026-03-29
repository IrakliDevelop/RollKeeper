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
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex max-h-[80vh] w-80 flex-col gap-2 overflow-y-auto sm:w-96">
      {visibleTransfers.map(transfer => {
        const isDismissing = dismissingIds.has(transfer.id);
        const fromLabel =
          transfer.fromType === 'npc'
            ? `${transfer.fromCharacterName} (NPC)`
            : transfer.fromCharacterName;

        return (
          <div
            key={transfer.id}
            className={`pointer-events-auto rounded-lg border-2 border-amber-400 bg-amber-900 p-4 text-amber-50 shadow-2xl shadow-amber-900/50 transition-all duration-300 ${
              isDismissing
                ? 'translate-x-full opacity-0'
                : 'animate-in slide-in-from-right-full translate-x-0 opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-full bg-amber-700 p-1.5 text-amber-200">
                  <Package size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    Item Received
                  </p>
                  <p className="mt-1 text-base font-bold text-white">
                    {transfer.item.name}
                    {transfer.item.quantity > 1 &&
                      ` (x${transfer.item.quantity})`}
                  </p>
                  <p className="mt-1 text-sm text-amber-200">
                    From {fromLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(transfer.id)}
                className="shrink-0 rounded p-1 text-amber-400 transition-colors hover:bg-amber-800 hover:text-amber-100"
                title="Dismiss"
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
                className="border-amber-500 bg-amber-600 text-white hover:bg-amber-500"
              >
                View in Inventory
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
