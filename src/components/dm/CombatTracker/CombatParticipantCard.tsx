'use client';

import React, { useState } from 'react';
import { 
  Crown, 
  Skull, 
  Shield, 
  Zap, 
  MoreVertical,
  Trash2,
  Edit3
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
  style
}: CombatParticipantCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { 
    updateParticipant, 
    applyDamage, 
    applyHealing, 
    addTemporaryHP,
    makeDeathSave,
    resetDeathSaves
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
      classes += 'border-blue-500 shadow-blue-200 shadow-xl ring-2 ring-blue-300 ';
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

  const handleUpdateHitPoints = (updates: Partial<typeof participant.hitPoints>) => {
    updateParticipant(participant.id, {
      hitPoints: { ...participant.hitPoints, ...updates }
    });
  };

  const handleUpdateAC = (newAC: number) => {
    updateParticipant(participant.id, { armorClass: newAC });
  };

  const handleUpdateTempAC = (newTempAC: number) => {
    updateParticipant(participant.id, { tempArmorClass: newTempAC });
  };

  const handleToggleReaction = () => {
    updateParticipant(participant.id, { hasReaction: !participant.hasReaction });
  };

  const handleToggleBonusAction = () => {
    updateParticipant(participant.id, { hasBonusAction: !participant.hasBonusAction });
  };

  return (
    <div 
      className={getCardStatusClasses()}
      style={style}
      onClick={onSelect}
    >
      {/* Initiative Badge */}
      <div className="absolute -top-2 -right-2 w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg z-10">
        {participant.initiative}
      </div>

      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {participant.type === 'player' ? (
              <Crown size={16} className="text-blue-600 flex-shrink-0" />
            ) : (
              <Skull size={16} className="text-red-600 flex-shrink-0" />
            )}
            <h3 className="font-bold text-gray-900 truncate">
              {participant.name}
            </h3>
          </div>
          <div className="text-sm text-gray-600">
            {participant.type === 'player' ? (
              <span>
                {participant.class && participant.level 
                  ? `Level ${participant.level} ${participant.class}`
                  : 'Player Character'
                }
              </span>
            ) : (
              <span>CR {participant.challengeRating || '?'}</span>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[150px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  // Add edit functionality here
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit3 size={14} />
                Edit Details
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onRemove?.();
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
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
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Armor Class</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={participant.armorClass}
                onChange={(e) => handleUpdateAC(parseInt(e.target.value) || 0)}
                className="w-16 p-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
              {participant.tempArmorClass ? (
                <>
                  <span className="text-gray-500">+</span>
                  <input
                    type="number"
                    value={participant.tempArmorClass}
                    onChange={(e) => handleUpdateTempAC(parseInt(e.target.value) || 0)}
                    className="w-12 p-1 text-center border border-blue-300 rounded bg-blue-50 focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </>
              ) : (
                <button
                  onClick={() => handleUpdateTempAC(1)}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  +Temp
                </button>
              )}
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900">
            = {totalAC}
          </div>
        </div>
      </div>

      {/* Hit Points - Reusing existing component */}
      <div className="mb-4">
        <HitPointTracker
          hitPoints={participant.hitPoints}
          onApplyDamage={(damage) => applyDamage(participant.id, damage, 'DM')}
          onApplyHealing={(healing) => applyHealing(participant.id, healing, 'DM')}
          onAddTemporaryHP={(tempHP) => addTemporaryHP(participant.id, tempHP, 'DM')}
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
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </div>

      {/* Action Economy */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Actions</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleReaction}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              participant.hasReaction
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}
          >
            Reaction
          </button>
          <button
            onClick={handleToggleBonusAction}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              participant.hasBonusAction
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}
          >
            Bonus
          </button>
          {participant.hasLegendaryActions && (
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-600">LA</div>
              <div className="text-sm font-bold">
                {(participant.usedLegendaryActions || 0)}/{participant.hasLegendaryActions}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ability Scores (Quick Reference) */}
      {participant.characterReference && (
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-600 mb-2">Quick Stats</div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {[
              { label: 'STR', value: participant.characterReference.characterData.abilities?.strength || 10 },
              { label: 'DEX', value: participant.characterReference.characterData.abilities?.dexterity || 10 },
              { label: 'CON', value: participant.characterReference.characterData.abilities?.constitution || 10 }
            ].map(ability => (
              <div key={ability.label} className="text-center bg-gray-50 rounded p-1">
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
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-600">Conditions</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {participant.conditions.slice(0, 3).map((condition, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full"
              >
                {condition.name}
              </span>
            ))}
            {participant.conditions.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                +{participant.conditions.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Turn Indicator */}
      {isCurrentTurn && (
        <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg">
            <span className="text-xs">▶</span>
          </div>
        </div>
      )}
    </div>
  );
}
