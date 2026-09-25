'use client';

import { Button } from '@/components/ui/forms/button';
import { useCharacterStore } from '@/store/characterStore';

import type { ToastData } from '@/components/ui/feedback/Toast';

import type {
  InventoryEntryView,
  InventorySummaryView,
} from '../SheetDrawer.types';
import { SpellSlotPipsRow } from './SpellSlotPipsRow';
import { useConsumableUse } from './useConsumableUse';

export interface InventoryEntryControlsProps {
  entry: InventoryEntryView;
  summary: InventorySummaryView;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

/**
 * Quantity/Use, equip, attune and charge-pip controls for one inventory
 * entry — split out of `InventoryEntryRow` so both files stay under the
 * repo's ~150-line component convention.
 */
export function InventoryEntryControls({
  entry,
  summary,
  addToast,
}: InventoryEntryControlsProps) {
  const adjustItemQuantity = useCharacterStore(s => s.adjustItemQuantity);
  const equipWeapon = useCharacterStore(s => s.equipWeapon);
  const equipArmorItem = useCharacterStore(s => s.equipArmorItem);
  const updateMagicItem = useCharacterStore(s => s.updateMagicItem);
  const attuneMagicItem = useCharacterStore(s => s.attuneMagicItem);
  const updateWeapon = useCharacterStore(s => s.updateWeapon);
  const updateArmorItem = useCharacterStore(s => s.updateArmorItem);
  const expendWeaponCharge = useCharacterStore(s => s.expendWeaponCharge);
  const restoreWeaponCharge = useCharacterStore(s => s.restoreWeaponCharge);
  const expendMagicItemCharge = useCharacterStore(s => s.expendMagicItemCharge);
  const restoreMagicItemCharge = useCharacterStore(
    s => s.restoreMagicItemCharge
  );
  const consumeItem = useConsumableUse(addToast);

  const { id, name, kind } = entry;
  const quantity = entry.quantity ?? 0;

  const handleEquipToggle = () => {
    const next = !entry.equipped;
    if (kind === 'weapon') equipWeapon(id, next);
    else if (kind === 'armor') equipArmorItem(id, next);
    else if (kind === 'magic') updateMagicItem(id, { isEquipped: next });
  };

  const handleAttuneToggle = () => {
    const next = !entry.attuned;
    if (kind === 'magic') attuneMagicItem(id, next);
    else if (kind === 'weapon') updateWeapon(id, { isAttuned: next });
    else if (kind === 'armor') updateArmorItem(id, { isAttuned: next });
  };

  const attuneDisabled =
    !entry.attuned && summary.attuned >= summary.attunementMax;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {kind === 'item' && !entry.consumable && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Decrease ${name}`}
              disabled={quantity <= 0}
              onClick={() => adjustItemQuantity(id, -1)}
            >
              −
            </Button>
            <span className="text-body min-w-[1.5rem] text-center text-sm">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Increase ${name}`}
              onClick={() => adjustItemQuantity(id, 1)}
            >
              +
            </Button>
          </div>
        )}

        {kind === 'item' && entry.consumable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Use ${name}`}
            disabled={quantity <= 0}
            onClick={() => consumeItem(id, name, quantity)}
          >
            Use
          </Button>
        )}

        {entry.equippable && (
          <Button
            type="button"
            variant={entry.equipped ? 'secondary' : 'outline'}
            size="sm"
            aria-label={`${entry.equipped ? 'Unequip' : 'Equip'} ${name}`}
            aria-pressed={entry.equipped}
            onClick={handleEquipToggle}
          >
            {entry.equipped ? 'Equipped' : 'Equip'}
          </Button>
        )}

        {entry.attunable && (
          <Button
            type="button"
            variant={entry.attuned ? 'secondary' : 'outline'}
            size="sm"
            aria-label={`${entry.attuned ? 'End attunement' : 'Attune'} ${name}`}
            aria-pressed={entry.attuned}
            disabled={attuneDisabled}
            title={
              attuneDisabled ? 'All attunement slots are in use' : undefined
            }
            onClick={handleAttuneToggle}
          >
            {entry.attuned ? 'Attuned' : 'Attune'}
          </Button>
        )}
      </div>

      {entry.charges.map(charge => (
        <SpellSlotPipsRow
          key={charge.chargeId}
          groupLabel={`${charge.name} charges`}
          max={charge.max}
          used={charge.used}
          spendLabel={`Use charge of ${charge.name}`}
          restoreLabel={`Restore charge of ${charge.name}`}
          onSpend={() =>
            kind === 'weapon'
              ? expendWeaponCharge(id, charge.chargeId)
              : expendMagicItemCharge(id, charge.chargeId)
          }
          onRestore={() =>
            kind === 'weapon'
              ? restoreWeaponCharge(id, charge.chargeId)
              : restoreMagicItemCharge(id, charge.chargeId)
          }
        />
      ))}
    </>
  );
}
