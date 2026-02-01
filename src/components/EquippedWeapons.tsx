'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useNavigation } from '@/contexts/NavigationContext';
import {
  Shield,
  Dice6,
  Zap,
  Sparkles,
  Clock,
  Minus,
  Plus,
  Info,
} from 'lucide-react';
import { Weapon, WeaponCharge } from '@/types/character';
import { RollSummary } from '@/types/dice';
import {
  isWeaponProficient,
  getWeaponAttackString,
  getWeaponDamageString,
  calculateWeaponAttackBonus,
  calculateWeaponDamageBonus,
  rollDamage,
  calculateWeaponChargeMax,
} from '@/utils/calculations';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { Modal } from '@/components/ui/feedback/Modal';

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
  const {
    character,
    equipWeapon,
    reorderWeapons,
    expendWeaponCharge,
    restoreWeaponCharge,
    setWeaponChargeUsed,
  } = useCharacterStore();
  const { switchToTab } = useNavigation();

  // State for charge detail modal
  const [selectedCharge, setSelectedCharge] = useState<{
    weaponId: string;
    weaponName: string;
    charge: WeaponCharge;
  } | null>(null);

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

          // Check if weapon has any charges
          const hasCharges = weapon.charges && weapon.charges.length > 0;

          return (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Title and badges */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-gray-900">{weapon.name}</h4>
                  <Badge
                    variant="success"
                    size="sm"
                    leftIcon={<Shield size={12} />}
                  >
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
                    <span className="font-bold text-red-600">
                      {attackString}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">⚔️ Damage:</span>
                    <span className="font-bold text-blue-600">
                      {damageString}
                    </span>
                  </div>
                </div>

                {versatileDamageString && (
                  <div className="mb-3 flex items-center gap-1.5 text-sm">
                    <span className="text-gray-600">🗡️ Versatile:</span>
                    <span className="font-bold text-purple-600">
                      {versatileDamageString}
                    </span>
                  </div>
                )}

                {/* Charges display - compact with +/- controls */}
                {hasCharges && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {weapon.charges!.map(charge => {
                      const maxCharges = calculateWeaponChargeMax(
                        charge,
                        character.level
                      );
                      const usedCharges = charge.usedCharges || 0;
                      const chargesRemaining = maxCharges - usedCharges;
                      const isExhausted = chargesRemaining <= 0;
                      const isFull = usedCharges <= 0;

                      return (
                        <div
                          key={charge.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                            isExhausted
                              ? 'border-red-200 bg-red-50'
                              : 'border-indigo-200 bg-indigo-50'
                          }`}
                        >
                          {/* Clickable name to open details */}
                          <button
                            onClick={() =>
                              setSelectedCharge({
                                weaponId: weapon.id,
                                weaponName: weapon.name,
                                charge,
                              })
                            }
                            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                            title="Click for details"
                          >
                            <Sparkles
                              size={12}
                              className={
                                isExhausted ? 'text-red-500' : 'text-indigo-600'
                              }
                            />
                            <span className="max-w-[120px] truncate text-xs font-medium text-gray-800">
                              {charge.name || 'Ability'}
                            </span>
                          </button>

                          {/* Charges counter with +/- buttons */}
                          <div className="ml-1 flex items-center gap-0.5">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                restoreWeaponCharge(weapon.id, charge.id);
                              }}
                              disabled={isFull}
                              className={`rounded p-0.5 ${
                                isFull
                                  ? 'cursor-not-allowed text-gray-300'
                                  : 'text-green-600 hover:bg-green-100'
                              }`}
                              title="Restore charge"
                            >
                              <Plus size={12} />
                            </button>
                            <span
                              className={`min-w-[28px] text-center text-xs font-bold ${
                                isExhausted
                                  ? 'text-red-600'
                                  : chargesRemaining <= 1
                                    ? 'text-orange-600'
                                    : 'text-indigo-600'
                              }`}
                            >
                              {chargesRemaining}/{maxCharges}
                            </span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                expendWeaponCharge(weapon.id, charge.id);
                              }}
                              disabled={isExhausted}
                              className={`rounded p-0.5 ${
                                isExhausted
                                  ? 'cursor-not-allowed text-gray-300'
                                  : 'text-red-600 hover:bg-red-100'
                              }`}
                              title="Use charge"
                            >
                              <Minus size={12} />
                            </button>
                          </div>

                          {/* Rest type indicator */}
                          <div className="ml-1 flex items-center gap-0.5 text-[10px] text-gray-500">
                            <Clock size={10} />
                            <span className="capitalize">
                              {charge.restType[0]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
              <div className="flex flex-shrink-0 flex-col gap-2">
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
          <strong>💡 Quick Reference:</strong> Manage your full weapon inventory
          in the{' '}
          <button
            onClick={() => switchToTab('equipment')}
            className="font-semibold text-blue-600 underline transition-colors hover:text-blue-800 hover:no-underline"
          >
            Equipment tab
          </button>
          .
        </p>
      </div>

      {/* Charge Detail Modal */}
      {selectedCharge && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCharge(null)}
          title={selectedCharge.charge.name || 'Charge Ability'}
          size="sm"
        >
          <div className="space-y-4">
            {/* Weapon name */}
            <div className="text-sm text-gray-500">
              From:{' '}
              <span className="font-medium text-gray-700">
                {selectedCharge.weaponName}
              </span>
            </div>

            {/* Description */}
            {selectedCharge.charge.description ? (
              <div className="prose prose-sm max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: selectedCharge.charge.description,
                  }}
                  className="text-gray-700"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No description provided.
              </p>
            )}

            {/* Charges info */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Charges
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  <span className="capitalize">
                    Recharges on {selectedCharge.charge.restType} rest
                  </span>
                </div>
              </div>

              {/* Charge adjustment controls */}
              {(() => {
                const maxCharges = calculateWeaponChargeMax(
                  selectedCharge.charge,
                  character.level
                );
                const usedCharges = selectedCharge.charge.usedCharges || 0;
                const chargesRemaining = maxCharges - usedCharges;
                const isExhausted = chargesRemaining <= 0;
                const isFull = usedCharges <= 0;

                return (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      onClick={() => {
                        restoreWeaponCharge(
                          selectedCharge.weaponId,
                          selectedCharge.charge.id
                        );
                        // Update the selected charge state with new used value
                        setSelectedCharge(prev =>
                          prev
                            ? {
                                ...prev,
                                charge: {
                                  ...prev.charge,
                                  usedCharges: Math.max(
                                    0,
                                    (prev.charge.usedCharges || 0) - 1
                                  ),
                                },
                              }
                            : null
                        );
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isFull}
                      leftIcon={<Plus size={14} />}
                      className="border-green-300 text-green-600 hover:bg-green-50"
                    >
                      Restore
                    </Button>

                    <div className="text-center">
                      <span
                        className={`text-2xl font-bold ${
                          isExhausted
                            ? 'text-red-600'
                            : chargesRemaining <= 1
                              ? 'text-orange-600'
                              : 'text-indigo-600'
                        }`}
                      >
                        {chargesRemaining}
                      </span>
                      <span className="text-lg text-gray-500">
                        /{maxCharges}
                      </span>
                    </div>

                    <Button
                      onClick={() => {
                        expendWeaponCharge(
                          selectedCharge.weaponId,
                          selectedCharge.charge.id
                        );
                        // Update the selected charge state with new used value
                        const max = calculateWeaponChargeMax(
                          selectedCharge.charge,
                          character.level
                        );
                        setSelectedCharge(prev =>
                          prev
                            ? {
                                ...prev,
                                charge: {
                                  ...prev.charge,
                                  usedCharges: Math.min(
                                    max,
                                    (prev.charge.usedCharges || 0) + 1
                                  ),
                                },
                              }
                            : null
                        );
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isExhausted}
                      leftIcon={<Minus size={14} />}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Use
                    </Button>
                  </div>
                );
              })()}

              {/* Progress bar */}
              {(() => {
                const maxCharges = calculateWeaponChargeMax(
                  selectedCharge.charge,
                  character.level
                );
                const chargesRemaining =
                  maxCharges - (selectedCharge.charge.usedCharges || 0);
                const isExhausted = chargesRemaining <= 0;

                return maxCharges > 1 ? (
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isExhausted
                          ? 'bg-red-500'
                          : chargesRemaining <= 1
                            ? 'bg-orange-500'
                            : 'bg-indigo-500'
                      }`}
                      style={{
                        width: `${(chargesRemaining / maxCharges) * 100}%`,
                      }}
                    />
                  </div>
                ) : null;
              })()}
            </div>

            {/* Proficiency scaling info */}
            {selectedCharge.charge.scaleWithProficiency && (
              <p className="text-xs text-gray-500">
                <Info size={12} className="mr-1 inline" />
                Scales with proficiency bonus (×
                {selectedCharge.charge.proficiencyMultiplier || 1})
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
