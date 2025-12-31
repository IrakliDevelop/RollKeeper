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
  rollDamage,
} from '@/utils/calculations';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';

interface EquippedWeaponsProps {
  showAttackRoll: (
    weaponName: string,
    roll: number,
    bonus: number,
    isCrit: boolean,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown> | void;
}

export const EquippedWeapons: React.FC<EquippedWeaponsProps> = ({
  showAttackRoll,
  showDamageRoll,
  animateRoll,
}) => {
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
      const legacyDamage = weapon.damage as {
        dice: string;
        type: string;
        versatiledice?: string;
      };
      if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
        primaryDice = legacyDamage.dice;
        primaryType = legacyDamage.type;
      }
    }

    // Animate d20 attack roll and use actual result
    if (animateRoll) {
      try {
        const rollResult = await animateRoll(
          `1d20${attackBonus > 0 ? `+${attackBonus}` : attackBonus}`
        );
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
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
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
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
        const dice =
          versatile && damage.versatiledice
            ? damage.versatiledice
            : damage.dice;
        const weaponBonus = index === 0 ? damageBonus : 0; // Only add weapon damage bonus to first damage

        // Animate damage dice and use actual result
        if (animateRoll) {
          try {
            const notationWithBonus =
              weaponBonus !== 0
                ? `${dice}${weaponBonus > 0 ? `+${weaponBonus}` : `${weaponBonus}`}`
                : dice;
            const rollResult = await animateRoll(notationWithBonus);
            if (
              rollResult &&
              typeof rollResult === 'object' &&
              'finalTotal' in rollResult
            ) {
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
            console.warn(
              'Dice animation failed, falling back to calculated roll:',
              error
            );
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
      const legacyDamage = weapon.damage as {
        dice: string;
        type: string;
        versatiledice?: string;
      };
      if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
        const dice =
          versatile && legacyDamage.versatiledice
            ? legacyDamage.versatiledice
            : legacyDamage.dice;

        // Animate damage dice and use actual result
        if (animateRoll) {
          try {
            const notationWithBonus =
              damageBonus !== 0
                ? `${dice}${damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`}`
                : dice;
            const rollResult = await animateRoll(notationWithBonus);
            if (
              rollResult &&
              typeof rollResult === 'object' &&
              'finalTotal' in rollResult
            ) {
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
            console.warn(
              'Dice animation failed, falling back to calculated roll:',
              error
            );
          }
        }

        // Fallback to calculated damage if animation fails
        const damageResult = rollDamage(dice, damageBonus);
        showDamageRoll(weapon.name, damageResult, legacyDamage.type, versatile);
      }
    }
  };

  // Filter to only equipped weapons
  const equippedWeapons = character.weapons.filter(weapon => weapon.isEquipped);

  // Custom reorder handler for equipped weapons only
  const handleReorderEquippedWeapons = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    // Get the weapon IDs being reordered
    const sourceWeaponId = equippedWeapons[sourceIndex].id;
    const destinationWeaponId = equippedWeapons[destinationIndex].id;

    // Find the indices in the main weapons array
    const sourceGlobalIndex = character.weapons.findIndex(
      weapon => weapon.id === sourceWeaponId
    );
    const destinationGlobalIndex = character.weapons.findIndex(
      weapon => weapon.id === destinationWeaponId
    );

    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderWeapons(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  if (equippedWeapons.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <div className="mb-3 text-5xl">🗡️</div>
        <p className="font-semibold text-gray-700">No weapons equipped</p>
        <p className="mt-1 text-sm text-gray-500">
          Equip weapons in the Equipment section to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DragDropList
        items={equippedWeapons}
        onReorder={handleReorderEquippedWeapons}
        keyExtractor={weapon => weapon.id}
        className="space-y-3"
        itemClassName="p-4 rounded-lg border-2 border-gray-200 bg-white transition-all hover:shadow-md hover:border-gray-300"
        showDragHandle={true}
        dragHandlePosition="left"
        renderItem={weapon => {
          const isProficient = isWeaponProficient(character, weapon);
          const attackString = getWeaponAttackString(character, weapon);
          const damageString = getWeaponDamageString(character, weapon);
          const versatileDamageString = (() => {
            if (Array.isArray(weapon.damage)) {
              return weapon.damage.some(dmg => dmg.versatiledice)
                ? getWeaponDamageString(character, weapon, true)
                : null;
            } else {
              const legacyDamage = weapon.damage as {
                dice: string;
                type: string;
                versatiledice?: string;
              };
              return legacyDamage && legacyDamage.versatiledice
                ? getWeaponDamageString(character, weapon, true)
                : null;
            }
          })();

          return (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title and badges */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-gray-900">{weapon.name}</h4>
                  <Badge variant="success" size="sm" leftIcon={<Shield size={12} />}>
                    Equipped
                  </Badge>
                  {weapon.enhancementBonus > 0 && (
                    <Badge variant="warning" size="sm">
                      +{weapon.enhancementBonus}
                    </Badge>
                  )}
                  {!isProficient && (
                    <Badge variant="danger" size="sm">
                      Not Proficient
                      {weapon.manualProficiency !== undefined && ' (Manual)'}
                    </Badge>
                  )}
                </div>

                {/* Attack and Damage stats */}
                <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">🎯 Attack:</span>
                    <span className="font-bold text-red-600">{attackString}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">⚔️ Damage:</span>
                    <span className="font-bold text-blue-600">{damageString}</span>
                  </div>
                </div>

                {versatileDamageString && (
                  <div className="mb-3 flex items-center gap-1.5 text-sm">
                    <span className="text-gray-600">🗡️ Versatile:</span>
                    <span className="font-bold text-purple-600">{versatileDamageString}</span>
                  </div>
                )}

                {/* Weapon properties */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" size="sm">
                    {weapon.category}
                  </Badge>
                  {weapon.weaponType.map((type, index) => (
                    <Badge key={index} variant="neutral" size="sm">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  onClick={() => rollWeaponAttack(weapon)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Dice6 size={14} />}
                  className="min-w-[110px]"
                  title="Roll attack"
                >
                  Attack
                </Button>
                <Button
                  onClick={() => rollWeaponDamage(weapon)}
                  variant="warning"
                  size="sm"
                  leftIcon={<Zap size={14} />}
                  className="min-w-[110px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                  title="Roll damage"
                >
                  Damage
                </Button>
                {(() => {
                  if (Array.isArray(weapon.damage)) {
                    return weapon.damage.some(dmg => dmg.versatiledice);
                  } else {
                    const legacyDamage = weapon.damage as {
                      dice: string;
                      type: string;
                      versatiledice?: string;
                    };
                    return legacyDamage && legacyDamage.versatiledice;
                  }
                })() && (
                  <Button
                    onClick={() => rollWeaponDamage(weapon, true)}
                    variant="primary"
                    size="sm"
                    leftIcon={<Zap size={14} />}
                    className="min-w-[110px] bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800"
                    title="Roll versatile damage"
                  >
                    Versatile
                  </Button>
                )}
                <Button
                  onClick={() => equipWeapon(weapon.id, false)}
                  variant="outline"
                  size="sm"
                  className="min-w-[110px] border-orange-300 text-orange-700 hover:bg-orange-50"
                  title="Unequip weapon"
                >
                  Unequip
                </Button>
              </div>
            </div>
          );
        }}
      />

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-center text-sm text-blue-800">
          <strong>💡 Quick Reference:</strong> Manage your full weapon inventory in the{' '}
          <button
            onClick={() => switchToTab('equipment')}
            className="font-semibold text-blue-600 underline transition-colors hover:text-blue-800 hover:no-underline"
          >
            Equipment tab
          </button>
          .
        </p>
      </div>
    </div>
  );
};
