'use client';

import { useCharacterStore } from '@/store/characterStore';

import type { ToastData } from '@/components/ui/feedback/Toast';

/**
 * Shared "Use" handler for a quantity-tracked consumable inventory item
 * (`entry.kind === 'item' && entry.consumable`): decrements quantity by one
 * and toasts how many are left. Used by the Inventory tab's list/grid views
 * and by the Overview tab's pinned favorites.
 */
export function useConsumableUse(addToast: (t: Omit<ToastData, 'id'>) => void) {
  const adjustItemQuantity = useCharacterStore(s => s.adjustItemQuantity);

  return (id: string, name: string, quantity: number) => {
    if (quantity <= 0) return;
    adjustItemQuantity(id, -1);
    addToast({
      type: 'info',
      title: `Used ${name}`,
      message: `${quantity - 1} left`,
    });
  };
}
