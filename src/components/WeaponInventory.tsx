'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { Eye, Sword, Wand2 } from 'lucide-react';
import EquipmentModal from '@/components/ui/game/EquipmentModal';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

export const WeaponInventory: React.FC = () => {
  const { character } = useCharacterStore();
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  // Calculate equipped items
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  const attunedItems =
    character.magicItems.filter(item => item.isAttuned).length +
    character.weapons.filter(weapon => weapon.isAttuned).length;

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-end">
          <Button
            onClick={() => setShowEquipmentModal(true)}
            variant="primary"
            size="sm"
            leftIcon={<Eye size={16} />}
            className="bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
          >
            View All Equipment
          </Button>
        </div>

        {/* Quick Overview */}
        <div className="space-y-3">
          {/* Weapons Summary */}
          <div
            className="border-accent-blue-border bg-surface-raised hover:border-accent-blue-border-strong cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sword className="text-accent-blue-text-muted h-5 w-5" />
                <span className="text-heading font-bold">Weapons</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info" size="sm">
                  {character.weapons.length} total
                </Badge>
                <Badge variant="success" size="sm">
                  {equippedWeapons.length} equipped
                </Badge>
              </div>
            </div>
            {equippedWeapons.length > 0 && (
              <div className="border-divider mt-3 border-t-2 pt-3">
                <div className="text-body mb-2 text-sm font-medium">Ready:</div>
                <div className="flex flex-wrap gap-2">
                  {equippedWeapons.slice(0, 3).map(weapon => (
                    <Badge key={weapon.id} variant="info" size="sm">
                      {weapon.name}
                    </Badge>
                  ))}
                  {equippedWeapons.length > 3 && (
                    <Badge variant="info" size="sm">
                      +{equippedWeapons.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Magic Items Summary */}
          <div
            className="border-accent-purple-border bg-surface-raised hover:border-accent-purple-border-strong cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="text-accent-purple-text-muted h-5 w-5" />
                <span className="text-heading font-bold">Magic Items</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {character.magicItems.length} total
                </Badge>
                <Badge variant="warning" size="sm">
                  {attunedItems}/{character.attunementSlots.max} attuned
                </Badge>
              </div>
            </div>
            {character.magicItems.length > 0 && (
              <div className="border-divider mt-3 border-t-2 pt-3">
                <div className="text-body mb-2 text-sm font-medium">
                  Recent:
                </div>
                <div className="flex flex-wrap gap-2">
                  {character.magicItems.slice(0, 3).map(item => (
                    <Badge key={item.id} variant="primary" size="sm">
                      {item.name}
                    </Badge>
                  ))}
                  {character.magicItems.length > 3 && (
                    <Badge variant="primary" size="sm">
                      +{character.magicItems.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {character.weapons.length === 0 &&
            character.magicItems.length === 0 && (
              <div className="py-8 text-center">
                <div className="mb-3 flex justify-center gap-3">
                  <Sword className="text-faint h-12 w-12" />
                  <Wand2 className="text-faint h-12 w-12" />
                </div>
                <p className="text-body text-lg font-semibold">
                  No equipment added yet
                </p>
                <p className="text-muted mt-2 text-sm">
                  Click &quot;View All Equipment&quot; to add weapons and magic
                  items
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Equipment Modal */}
      <EquipmentModal
        isOpen={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
      />
    </>
  );
};
