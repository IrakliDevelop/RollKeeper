'use client';

import React, { useState } from 'react';
import {
  Crown,
  Skull,
  Shield,
  Zap,
  MoreVertical,
  Trash2,
  Edit3,
} from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { HitPointTracker } from '@/components/shared/combat/HitPointTracker';
import { useCombatStore } from '@/store/combatStore';
import { isDying, isDead } from '@/utils/hpCalculations';

interface CombatParticipantCardProps {
  participant: CombatParticipant;
  isCurrentTurn?: boolean;
  isSelected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CombatParticipantCard({
  participant,
  isCurrentTurn = false,
  isSelected = false,
  compact = false,
  onSelect,
  onRemove,
  className = '',
  style,
}: CombatParticipantCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const {
    updateParticipant,
    applyDamage,
    applyHealing,
    addTemporaryHP,
    makeDeathSave,
    resetDeathSaves,
  } = useCombatStore();

  const isCharacterDying = isDying(participant.hitPoints);
  const isCharacterDead = isDead(participant.hitPoints);
  const isUnconscious = participant.hitPoints.current === 0;

  // Calculate AC including temporary AC
  const totalAC = participant.armorClass + (participant.tempArmorClass || 0);

  const getCardStatusClasses = () => {
    let classes = 'combat-participant-card transition-all duration-200 ';

    // Base styling
    classes += 'bg-white rounded-xl shadow-lg border-2 p-4 ';

    // Size classes
    if (compact) {
      classes += 'min-w-[260px] max-w-[280px] ';
    } else {
      classes += 'min-w-[300px] max-w-[320px] ';
    }

    // Turn status
    if (isCurrentTurn) {
      classes +=
        'border-blue-500 shadow-blue-200 shadow-xl ring-2 ring-blue-300 ';
    } else {
      classes += 'border-gray-200 ';
    }

    // Selection status
    if (isSelected) {
      classes += 'ring-2 ring-purple-300 ';
    }

    // Participant type
    if (participant.type === 'player') {
      classes += 'border-l-4 border-l-blue-500 ';
    } else {
      classes += 'border-l-4 border-l-red-500 ';
    }

    // Health status
    if (isCharacterDead) {
      classes += 'opacity-60 border-red-400 ';
    } else if (isCharacterDying || isUnconscious) {
      classes += 'border-red-300 ';
    }

    return classes + className;
  };

  const handleUpdateHitPoints = (
    updates: Partial<typeof participant.hitPoints>
  ) => {
    updateParticipant(participant.id, {
      hitPoints: { ...participant.hitPoints, ...updates },
    });
  };

  const handleUpdateAC = (newAC: number) => {
    updateParticipant(participant.id, { armorClass: newAC });
  };

  const handleUpdateTempAC = (newTempAC: number) => {
    updateParticipant(participant.id, { tempArmorClass: newTempAC });
  };

  const handleToggleReaction = () => {
    updateParticipant(participant.id, {
      hasReaction: !participant.hasReaction,
    });
  };

  const handleToggleBonusAction = () => {
    updateParticipant(participant.id, {
      hasBonusAction: !participant.hasBonusAction,
    });
  };

  return (
    <div className={getCardStatusClasses()} style={style} onClick={onSelect}>
      {/* Initiative Badge */}
      <div className="absolute -top-2 -right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white shadow-lg">
        {participant.initiative}
      </div>

      {/* Card Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {participant.type === 'player' ? (
              <Crown size={16} className="flex-shrink-0 text-blue-600" />
            ) : (
              <Skull size={16} className="flex-shrink-0 text-red-600" />
            )}
            <h3 className="truncate font-bold text-gray-900">
              {participant.name}
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            {participant.type === 'player' ? (
              <span>
                {participant.class && participant.level
                  ? `Level ${participant.level} ${participant.class}`
                  : 'Player Character'}
              </span>
            ) : (
              <span>CR {participant.challengeRating || '?'}</span>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={e => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded p-1 hover:bg-gray-100"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 z-20 mt-1 min-w-[150px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowMenu(false);
                  // Add edit functionality here
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <Edit3 size={14} />
                Edit Details
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onRemove?.();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Armor Class */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Shield size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Armor Class</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={participant.armorClass}
                onChange={e => handleUpdateAC(parseInt(e.target.value) || 0)}
                className="w-16 rounded border border-gray-300 p-1 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                min="0"
              />
              {participant.tempArmorClass ? (
                <>
                  <span className="text-gray-500">+</span>
                  <input
                    type="number"
                    value={participant.tempArmorClass}
                    onChange={e =>
                      handleUpdateTempAC(parseInt(e.target.value) || 0)
                    }
                    className="w-12 rounded border border-blue-300 bg-blue-50 p-1 text-center focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </>
              ) : (
                <button
                  onClick={() => handleUpdateTempAC(1)}
                  className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                >
                  +Temp
                </button>
              )}
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900">= {totalAC}</div>
        </div>
      </div>

      {/* Hit Points - Reusing existing component */}
      <div className="mb-4">
        <HitPointTracker
          hitPoints={participant.hitPoints}
          onApplyDamage={damage => applyDamage(participant.id, damage, 'DM')}
          onApplyHealing={healing =>
            applyHealing(participant.id, healing, 'DM')
          }
          onAddTemporaryHP={tempHP =>
            addTemporaryHP(participant.id, tempHP, 'DM')
          }
          onMakeDeathSave={(isSuccess, isCritical) => {
            // Convert back to d20 roll for logging
            const roll = isCritical ? 20 : isSuccess ? 15 : 5;
            makeDeathSave(participant.id, roll);
          }}
          onResetDeathSaves={() => resetDeathSaves(participant.id)}
          onUpdateHitPoints={handleUpdateHitPoints}
          compact={compact}
          showControls={true}
          showDeathSaves={true}
          showCalculationInfo={false}
          hideLabels={true}
          className="border-0 bg-transparent p-0 shadow-none"
        />
      </div>

      {/* Action Economy */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Actions</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleReaction}
            className={`flex-1 rounded px-3 py-2 text-xs transition-colors ${
              participant.hasReaction
                ? 'border border-green-300 bg-green-100 text-green-800'
                : 'border border-gray-300 bg-gray-100 text-gray-600'
            }`}
          >
            Reaction
          </button>
          <button
            onClick={handleToggleBonusAction}
            className={`flex-1 rounded px-3 py-2 text-xs transition-colors ${
              participant.hasBonusAction
                ? 'border border-green-300 bg-green-100 text-green-800'
                : 'border border-gray-300 bg-gray-100 text-gray-600'
            }`}
          >
            Bonus
          </button>
          {participant.hasLegendaryActions && (
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-600">LA</div>
              <div className="text-sm font-bold">
                {participant.usedLegendaryActions || 0}/
                {participant.hasLegendaryActions}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ability Scores (Quick Reference) */}
      {participant.characterReference && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-gray-600">
            Quick Stats
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {[
              {
                label: 'STR',
                value:
                  participant.characterReference.characterData.abilities
                    ?.strength || 10,
              },
              {
                label: 'DEX',
                value:
                  participant.characterReference.characterData.abilities
                    ?.dexterity || 10,
              },
              {
                label: 'CON',
                value:
                  participant.characterReference.characterData.abilities
                    ?.constitution || 10,
              },
            ].map(ability => (
              <div
                key={ability.label}
                className="rounded bg-gray-50 p-1 text-center"
              >
                <div className="font-medium">{ability.label}</div>
                <div className="text-gray-600">
                  {Math.floor((ability.value - 10) / 2) >= 0 ? '+' : ''}
                  {Math.floor((ability.value - 10) / 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {participant.conditions && participant.conditions.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              Conditions
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {participant.conditions.slice(0, 3).map((condition, index) => (
              <span
                key={index}
                className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800"
              >
                {condition.name}
              </span>
            ))}
            {participant.conditions.length > 3 && (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                +{participant.conditions.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Turn Indicator */}
      {isCurrentTurn && (
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 transform">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg">
            <span className="text-xs">▶</span>
          </div>
        </div>
      )}
    </div>
  );
}
