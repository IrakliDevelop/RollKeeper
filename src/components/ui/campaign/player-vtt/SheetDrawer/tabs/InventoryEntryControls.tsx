'use client';

import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { useCharacterStore } from '@/store/characterStore';

import type { ToastData } from '@/components/ui/feedback/Toast';

import type {
  InventoryEntryView,
  InventorySummaryView,
} from '../SheetDrawer.types';
import { ChargePipsRow } from './ChargePipsRow';
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
        {kind === 'item' && (
          <div className="flex items-center gap-1">
            <Tooltip content={`Decrease ${name}`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-9 px-0"
                aria-label={`Decrease ${name}`}
                disabled={quantity <= 0}
                onClick={() => adjustItemQuantity(id, -1)}
              >
                <Minus size={16} aria-hidden />
              </Button>
            </Tooltip>
            <span className="type-ui text-body min-w-6 text-center tabular-nums">
              {quantity}
            </span>
            <Tooltip content={`Increase ${name}`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-9 px-0"
                aria-label={`Increase ${name}`}
                onClick={() => adjustItemQuantity(id, 1)}
              >
                <Plus size={16} aria-hidden />
              </Button>
            </Tooltip>
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
            variant="outline"
            selected={entry.equipped}
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
            variant="outline"
            selected={entry.attuned}
            size="sm"
            aria-label={`${entry.attuned ? 'End attunement' : 'Attune'} ${name}`}
            aria-pressed={entry.attuned}
            disabled={attuneDisabled}
            onClick={handleAttuneToggle}
          >
            {entry.attuned ? 'Attuned' : 'Attune'}
          </Button>
        )}
      </div>

      {entry.charges.map(charge => (
        <ChargePipsRow
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
