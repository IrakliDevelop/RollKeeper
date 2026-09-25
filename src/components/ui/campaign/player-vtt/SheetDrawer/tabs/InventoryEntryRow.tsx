'use client';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';

import type { ToastData } from '@/components/ui/feedback/Toast';

import { rarityBadgeVariant } from '../InventoryTabs.utils';
import type {
  InventoryEntryView,
  InventorySummaryView,
} from '../SheetDrawer.types';
import { FavoriteStar } from './FavoriteStar';
import { SpellSlotPipsRow } from './SpellSlotPipsRow';

export interface InventoryEntryRowProps {
  entry: InventoryEntryView;
  summary: InventorySummaryView;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

/** One weapon/armor/magic-item/gear row in the Inventory tab's list view. */
export function InventoryEntryRow({
  entry,
  summary,
  addToast,
}: InventoryEntryRowProps) {
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

  const handleUse = () => {
    if (kind !== 'item' || quantity <= 0) return;
    adjustItemQuantity(id, -1);
    addToast({
      type: 'info',
      title: `Used ${name}`,
      message: `${quantity - 1} left`,
    });
  };

  const attuneDisabled =
    !entry.attuned && summary.attuned >= summary.attunementMax;

  return (
    <div className="border-divider rounded-lg border p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-heading text-sm font-semibold">{name}</span>
            {entry.rarity && entry.rarity !== 'common' && (
              <Badge variant={rarityBadgeVariant(entry.rarity)}>
                {entry.rarity}
              </Badge>
            )}
          </div>
          <div className="text-muted text-xs">
            {entry.meta}
            {entry.weightText ? ` · ${entry.weightText}` : ''}
          </div>
          {entry.attackText && (
            <div className="text-body mt-0.5 text-xs">{entry.attackText}</div>
          )}
          {entry.poolText && (
            <div className="text-muted mt-0.5 text-xs">{entry.poolText}</div>
          )}
        </div>
        <FavoriteStar kind="item" id={id} name={name} />
      </div>

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
            onClick={handleUse}
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
    </div>
  );
}
