'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { Shield, Dice6 } from 'lucide-react';
import { Weapon } from '@/types/character';
import { 
  isWeaponProficient, 
  getWeaponAttackString, 
  getWeaponDamageString,
  calculateWeaponAttackBonus
} from '@/utils/calculations';

interface EquippedWeaponsProps {
  showAttackRoll: (weaponName: string, roll: number, bonus: number, isCrit: boolean, damage?: string, damageType?: string) => void;
}

export const EquippedWeapons: React.FC<EquippedWeaponsProps> = ({ showAttackRoll }) => {
  const { character, equipWeapon } = useCharacterStore();
  
  const rollWeaponAttack = (weapon: Weapon) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const attackBonus = calculateWeaponAttackBonus(character, weapon);
    const isCrit = roll === 20;
    
    showAttackRoll(
      weapon.name,
      roll,
      attackBonus,
      isCrit,
      weapon.damage.dice,
      weapon.damage.type
    );
  };
  
  // Filter to only equipped weapons
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);
  
  if (equippedWeapons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-blue-200 p-4">
        <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
          <span className="text-red-600">⚔️</span>
          Ready Weapons
        </h3>
        <div className="text-center py-6 text-gray-500">
          <div className="text-4xl mb-2">🗡️</div>
          <p className="font-medium">No weapons equipped</p>
          <p className="text-sm mt-1">Equip weapons in the Equipment section below to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-blue-200 p-4">
      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
        <span className="text-red-600">⚔️</span>
        Ready Weapons
        <span className="text-sm font-normal text-gray-600 ml-2">
          ({equippedWeapons.length} equipped)
        </span>
      </h3>
      
      <div className="space-y-3">
        {equippedWeapons.map((weapon) => {
          const isProficient = isWeaponProficient(character, weapon);
          const attackString = getWeaponAttackString(character, weapon);
          const damageString = getWeaponDamageString(character, weapon);
          const versatileDamageString = weapon.damage.versatiledice 
            ? getWeaponDamageString(character, weapon, true)
            : null;

          return (
            <div
              key={weapon.id}
              className="p-3 rounded-lg border-2 border-green-300 bg-green-50 transition-all hover:shadow-md hover:border-green-400"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-800">{weapon.name}</h4>
                    <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded flex items-center gap-1">
                      <Shield size={12} />
                      Equipped
                    </span>
                    {weapon.enhancementBonus > 0 && (
                      <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded font-semibold">
                        +{weapon.enhancementBonus}
                      </span>
                    )}
                    {!isProficient && (
                      <span className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded">
                        Not Proficient
                        {weapon.manualProficiency !== undefined && ' (Manual)'}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">🎯 Attack: </span>
                      <span className="font-bold text-red-600">{attackString}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">⚔️ Damage: </span>
                      <span className="font-bold text-blue-600">{damageString}</span>
                    </div>
                  </div>
                  
                  {versatileDamageString && (
                    <div className="mt-1 text-sm">
                      <span className="text-gray-600">🗡️ Versatile: </span>
                      <span className="font-bold text-purple-600">{versatileDamageString}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded capitalize">
                      {weapon.category}
                    </span>
                    {weapon.weaponType.map((type, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded capitalize"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-1 ml-3">
                  <button
                    onClick={() => rollWeaponAttack(weapon)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                    title="Roll attack"
                  >
                    <Dice6 size={12} />
                    Attack
                  </button>
                  <button
                    onClick={() => equipWeapon(weapon.id, false)}
                    className="px-2 py-1 text-xs bg-orange-200 text-orange-800 hover:bg-orange-300 rounded transition-colors"
                    title="Unequip weapon"
                  >
                    Unequip
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>💡 Quick Reference:</strong> Manage your full weapon inventory in the{' '}
          <button
            onClick={() => {
              const equipmentSection = document.getElementById('equipment-section');
              if (equipmentSection) {
                equipmentSection.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors font-semibold"
          >
            Equipment section below
          </button>.
        </p>
      </div>
    </div>
  );
}; 