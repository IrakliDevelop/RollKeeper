'use client';

import React from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useNavigation } from '@/contexts/NavigationContext';
import { Shield, Dice6, Zap } from 'lucide-react';
import { Weapon } from '@/types/character';
import { RollSummary } from '@/types/dice';
import { 
  isWeaponProficient, 
  getWeaponAttackString, 
  getWeaponDamageString,
  calculateWeaponAttackBonus,
  calculateWeaponDamageBonus,
  rollDamage
} from '@/utils/calculations';
import DragDropList from '@/components/ui/DragDropList';

interface EquippedWeaponsProps {
  showAttackRoll: (weaponName: string, roll: number, bonus: number, isCrit: boolean, damage?: string, damageType?: string) => void;
  showDamageRoll: (weaponName: string, damageRoll: string, damageType?: string, versatile?: boolean) => void;
  animateRoll?: (notation: string) => Promise<unknown> | void;
}

export const EquippedWeapons: React.FC<EquippedWeaponsProps> = ({ showAttackRoll, showDamageRoll, animateRoll }) => {
  const { character, equipWeapon, reorderWeapons } = useCharacterStore();
  const { switchToTab } = useNavigation();
  
  const rollWeaponAttack = async (weapon: Weapon) => {
    const attackBonus = calculateWeaponAttackBonus(character, weapon);
    
    // Handle backward compatibility for damage
    let primaryDice = '1d6';
    let primaryType = 'bludgeoning';
    
    if (Array.isArray(weapon.damage)) {
      // New format: array of damage entries
      const primaryDamage = weapon.damage.length > 0 ? weapon.damage[0] : null;
      primaryDice = primaryDamage?.dice || '1d6';
      primaryType = primaryDamage?.type || 'bludgeoning';
    } else {
      // Old format: single damage object
      const legacyDamage = weapon.damage as { dice: string; type: string; versatiledice?: string };
      if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
        primaryDice = legacyDamage.dice;
        primaryType = legacyDamage.type;
      }
    }
    
    // Animate d20 attack roll and use actual result
    if (animateRoll) {
      try {
        const rollResult = await animateRoll(`1d20${attackBonus > 0 ? `+${attackBonus}` : attackBonus}`);
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;
          
          showAttackRoll(
            weapon.name,
            roll,
            attackBonus,
            isCrit,
            primaryDice,
            primaryType
          );
          return;
        }
      } catch (error) {
        console.warn('Dice animation failed, falling back to random roll:', error);
      }
    }
    
    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;
    
    showAttackRoll(
      weapon.name,
      roll,
      attackBonus,
      isCrit,
      primaryDice,
      primaryType
    );
  };

  const rollWeaponDamage = async (weapon: Weapon, versatile = false) => {
    const damageBonus = calculateWeaponDamageBonus(character, weapon);
    
    if (Array.isArray(weapon.damage)) {
      // New format: array of damage entries
      for (let index = 0; index < weapon.damage.length; index++) {
        const damage = weapon.damage[index];
        const dice = versatile && damage.versatiledice ? damage.versatiledice : damage.dice;
        const weaponBonus = index === 0 ? damageBonus : 0; // Only add weapon damage bonus to first damage
        
        // Animate damage dice and use actual result
        if (animateRoll) {
          try {
            const notationWithBonus = weaponBonus !== 0
              ? `${dice}${weaponBonus > 0 ? `+${weaponBonus}` : `${weaponBonus}`}`
              : dice;
            const rollResult = await animateRoll(notationWithBonus);
            if (rollResult && typeof rollResult === 'object' && 'finalTotal' in rollResult) {
              const summary = rollResult as RollSummary;
              const damageResult = `${summary.total} + ${weaponBonus} = ${summary.finalTotal}`;
              
              showDamageRoll(
                `${weapon.name}${damage.label && damage.label !== 'Weapon Damage' ? ` (${damage.label})` : ''}`,
                damageResult,
                damage.type,
                versatile && index === 0 // Only show versatile for first damage
              );
              continue;
            }
          } catch (error) {
            console.warn('Dice animation failed, falling back to calculated roll:', error);
          }
        }
        
        // Fallback to calculated damage if animation fails
        const damageResult = rollDamage(dice, weaponBonus);
        showDamageRoll(
          `${weapon.name}${damage.label && damage.label !== 'Weapon Damage' ? ` (${damage.label})` : ''}`,
          damageResult,
          damage.type,
          versatile && index === 0 // Only show versatile for first damage
        );
      }
    } else {
      // Old format: single damage object
      const legacyDamage = weapon.damage as { dice: string; type: string; versatiledice?: string };
      if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
        const dice = versatile && legacyDamage.versatiledice ? legacyDamage.versatiledice : legacyDamage.dice;
        
        // Animate damage dice and use actual result
        if (animateRoll) {
          try {
            const notationWithBonus = damageBonus !== 0
              ? `${dice}${damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`}`
              : dice;
            const rollResult = await animateRoll(notationWithBonus);
            if (rollResult && typeof rollResult === 'object' && 'finalTotal' in rollResult) {
              const summary = rollResult as RollSummary;
              const damageResult = `${summary.total} + ${damageBonus} = ${summary.finalTotal}`;
              
              showDamageRoll(
                weapon.name,
                damageResult,
                legacyDamage.type,
                versatile
              );
              return;
            }
          } catch (error) {
            console.warn('Dice animation failed, falling back to calculated roll:', error);
          }
        }
        
        // Fallback to calculated damage if animation fails
        const damageResult = rollDamage(dice, damageBonus);
        showDamageRoll(
          weapon.name,
          damageResult,
          legacyDamage.type,
          versatile
        );
      }
    }
  };
  
  // Filter to only equipped weapons
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);

  // Custom reorder handler for equipped weapons only
  const handleReorderEquippedWeapons = (sourceIndex: number, destinationIndex: number) => {
    // Get the weapon IDs being reordered
    const sourceWeaponId = equippedWeapons[sourceIndex].id;
    const destinationWeaponId = equippedWeapons[destinationIndex].id;
    
    // Find the indices in the main weapons array
    const sourceGlobalIndex = character.weapons.findIndex(weapon => weapon.id === sourceWeaponId);
    const destinationGlobalIndex = character.weapons.findIndex(weapon => weapon.id === destinationWeaponId);
    
    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderWeapons(sourceGlobalIndex, destinationGlobalIndex);
    }
  };
  
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
      
      <DragDropList
        items={equippedWeapons}
        onReorder={handleReorderEquippedWeapons}
        keyExtractor={(weapon) => weapon.id}
        className="space-y-3"
        itemClassName="p-3 rounded-lg border-2 border-green-300 bg-green-50 transition-all hover:shadow-md hover:border-green-400"
        showDragHandle={true}
        dragHandlePosition="left"
        renderItem={(weapon) => {
          const isProficient = isWeaponProficient(character, weapon);
          const attackString = getWeaponAttackString(character, weapon);
          const damageString = getWeaponDamageString(character, weapon);
          const versatileDamageString = (() => {
            if (Array.isArray(weapon.damage)) {
              return weapon.damage.some(dmg => dmg.versatiledice)
                ? getWeaponDamageString(character, weapon, true)
                : null;
            } else {
              // Old format
              const legacyDamage = weapon.damage as { dice: string; type: string; versatiledice?: string };
              return legacyDamage && legacyDamage.versatiledice
                ? getWeaponDamageString(character, weapon, true)
                : null;
            }
          })();

                    return (
            <>
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
                
                <div className="flex flex-col items-center gap-2 ml-3">
                  <button
                    onClick={() => rollWeaponAttack(weapon)}
                    className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg shadow-md hover:from-slate-700 hover:to-slate-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    title="Roll attack"
                  >
                    <Dice6 size={14} className="group-hover:rotate-12 transition-transform" />
                    Attack
                  </button>
                  <button
                    onClick={() => rollWeaponDamage(weapon)}
                    className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow-md hover:from-amber-600 hover:to-orange-700 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    title="Roll damage"
                  >
                    <Zap size={14} className="group-hover:animate-pulse" />
                    Damage
                  </button>
                  {(() => {
                    if (Array.isArray(weapon.damage)) {
                      return weapon.damage.some(dmg => dmg.versatiledice);
                    } else {
                      const legacyDamage = weapon.damage as { dice: string; type: string; versatiledice?: string };
                      return legacyDamage && legacyDamage.versatiledice;
                    }
                  })() && (
                    <button
                      onClick={() => rollWeaponDamage(weapon, true)}
                      className="group flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-lg shadow-md hover:from-purple-700 hover:to-violet-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                      title="Roll versatile damage"
                    >
                      <Zap size={14} className="group-hover:animate-pulse" />
                      Versatile
                    </button>
                  )}
                  <button
                    onClick={() => equipWeapon(weapon.id, false)}
                    className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 hover:from-orange-200 hover:to-orange-300 border border-orange-300 rounded-lg shadow-sm hover:shadow-md transform hover:scale-105 transition-all duration-200"
                    title="Unequip weapon"
                  >
                    Unequip
                  </button>
                </div>
              </div>
            </>
          );
        }}
      />
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 text-center">
          <strong>💡 Quick Reference:</strong> Manage your full weapon inventory in the{' '}
          <button
            onClick={() => switchToTab('equipment')}
            className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors font-semibold"
          >
            Equipment tab
          </button>.
        </p>
      </div>
    </div>
  );
}; 