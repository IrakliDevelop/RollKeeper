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
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
          >
            View All Equipment
          </Button>
        </div>

        {/* Quick Overview */}
        <div className="space-y-3">
          {/* Weapons Summary */}
          <div
            className="cursor-pointer rounded-lg border-2 border-blue-200 bg-white p-4 transition-all hover:shadow-md hover:border-blue-300"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-gray-800">Weapons</span>
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
              <div className="mt-3 pt-3 border-t-2 border-gray-100">
                <div className="text-sm font-medium text-gray-700 mb-2">Ready:</div>
                <div className="flex flex-wrap gap-2">
                  {equippedWeapons.slice(0, 3).map(weapon => (
                    <Badge
                      key={weapon.id}
                      variant="info"
                      size="sm"
                      className="bg-blue-100 text-blue-800"
                    >
                      {weapon.name}
                    </Badge>
                  ))}
                  {equippedWeapons.length > 3 && (
                    <Badge variant="info" size="sm" className="bg-blue-100 text-blue-800">
                      +{equippedWeapons.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Magic Items Summary */}
          <div
            className="cursor-pointer rounded-lg border-2 border-purple-200 bg-white p-4 transition-all hover:shadow-md hover:border-purple-300"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-purple-600" />
                <span className="font-bold text-gray-800">Magic Items</span>
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
              <div className="mt-3 pt-3 border-t-2 border-gray-100">
                <div className="text-sm font-medium text-gray-700 mb-2">Recent:</div>
                <div className="flex flex-wrap gap-2">
                  {character.magicItems.slice(0, 3).map(item => (
                    <Badge
                      key={item.id}
                      variant="primary"
                      size="sm"
                      className="bg-purple-100 text-purple-800"
                    >
                      {item.name}
                    </Badge>
                  ))}
                  {character.magicItems.length > 3 && (
                    <Badge variant="primary" size="sm" className="bg-purple-100 text-purple-800">
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
                  <Sword className="h-12 w-12 text-gray-300" />
                  <Wand2 className="h-12 w-12 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-700 text-lg">No equipment added yet</p>
                <p className="mt-2 text-sm text-gray-500">
                  Click &quot;View All Equipment&quot; to add weapons and magic items
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
