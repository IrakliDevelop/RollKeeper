'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { Eye, Sword, Wand2 } from 'lucide-react';
import EquipmentModal from '@/components/ui/game/EquipmentModal';

export const WeaponInventory: React.FC = () => {
  const { character } = useCharacterStore();
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  // Calculate equipped items
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  const attunedItems = character.magicItems.filter(item => item.isAttuned).length + 
                      character.weapons.filter(weapon => weapon.isAttuned).length;

  return (
    <>
      <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
            <span className="text-red-600">⚔️</span>
            Equipment & Magic Items
          </h3>
          <button
            onClick={() => setShowEquipmentModal(true)}
            className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
          >
            <Eye size={16} />
            View All
          </button>
        </div>

        {/* Quick Overview */}
        <div className="space-y-3">
          {/* Weapons Summary */}
          <div 
            className="p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sword className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Weapons</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-blue-600">
                  Total: {character.weapons.length}
                </span>
                <span className="text-green-600">
                  Equipped: {equippedWeapons.length}
                </span>
              </div>
            </div>
            {equippedWeapons.length > 0 && (
              <div className="mt-2 text-sm text-blue-700">
                <div className="font-medium">Ready:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {equippedWeapons.slice(0, 3).map((weapon) => (
                    <span 
                      key={weapon.id}
                      className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs"
                    >
                      {weapon.name}
                    </span>
                  ))}
                  {equippedWeapons.length > 3 && (
                    <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">
                      +{equippedWeapons.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Magic Items Summary */}
          <div 
            className="p-3 bg-purple-50 border border-purple-200 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={() => setShowEquipmentModal(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-800">Magic Items</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-purple-600">
                  Total: {character.magicItems.length}
                </span>
                <span className="text-orange-600">
                  Attuned: {attunedItems}/{character.attunementSlots.max}
                </span>
              </div>
            </div>
            {character.magicItems.length > 0 && (
              <div className="mt-2 text-sm text-purple-700">
                <div className="font-medium">Recent:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {character.magicItems.slice(0, 3).map((item) => (
                    <span 
                      key={item.id}
                      className="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs"
                    >
                      {item.name}
                    </span>
                  ))}
                  {character.magicItems.length > 3 && (
                    <span className="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs">
                      +{character.magicItems.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {character.weapons.length === 0 && character.magicItems.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <div className="flex justify-center gap-2 mb-2">
                <Sword className="h-8 w-8 text-gray-300" />
                <Wand2 className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-medium">No equipment added yet</p>
              <p className="text-sm mt-1">Click &quot;View All&quot; to add weapons and magic items</p>
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