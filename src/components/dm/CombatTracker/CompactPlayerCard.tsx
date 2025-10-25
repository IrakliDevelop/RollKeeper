'use client';

import React, { useState } from 'react';
import { 
  Heart, 
  Clock, 
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  User,
  Skull
} from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { CharacterState } from '@/types/character';
import { SyncStatusIcon } from '@/components/ui/sync/SyncIndicator';

interface CompactPlayerCardProps {
  participant: CombatParticipant;
  characterData?: CharacterState;
  isCurrentTurn?: boolean;
  isOnline?: boolean;
  onHPChange?: (newHP: number) => void;
  onACChange?: (newAC: number) => void;
  onActionUse?: (actionType: 'action' | 'bonus' | 'reaction' | 'movement') => void;
  className?: string;
}

export function CompactPlayerCard({
  participant,
  characterData,
  isCurrentTurn = false,
  isOnline = true,
  onHPChange,
  onACChange,
  onActionUse,
  className = '',
}: CompactPlayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingHP, setEditingHP] = useState(false);
  const [editingAC, setEditingAC] = useState(false);
  const [hpInput, setHpInput] = useState(participant.hitPoints.current.toString());
  const [acInput, setAcInput] = useState(participant.armorClass.toString());

  const isCharacterDead = participant.hitPoints.current <= 0 && 
    ((participant.hitPoints.deathSaves?.failures || 0) >= 3 || participant.hitPoints.current < -participant.hitPoints.max);
  const isCharacterDying = participant.hitPoints.current === 0 && !isCharacterDead;
  const isUnconscious = participant.hitPoints.current === 0;

  const hpPercentage = Math.max(0, (participant.hitPoints.current / participant.hitPoints.max) * 100);
  
  const getHPColor = () => {
    if (isCharacterDead) return 'bg-gray-500';
    if (isCharacterDying) return 'bg-red-600';
    if (hpPercentage <= 25) return 'bg-red-500';
    if (hpPercentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (isCharacterDead) return <Skull size={14} className="text-gray-600" />;
    if (isCharacterDying) return <Heart size={14} className="text-red-600" />;
    if (isUnconscious) return <Clock size={14} className="text-orange-600" />;
    return null;
  };

  const handleHPSubmit = () => {
    const newHP = parseInt(hpInput);
    if (!isNaN(newHP) && onHPChange) {
      onHPChange(Math.max(0, Math.min(newHP, participant.hitPoints.max + participant.hitPoints.temporary)));
    }
    setEditingHP(false);
  };

  const handleACSubmit = () => {
    const newAC = parseInt(acInput);
    if (!isNaN(newAC) && onACChange) {
      onACChange(Math.max(0, newAC));
    }
    setEditingAC(false);
  };

  return (
    <div className={`
      compact-player-card relative rounded-lg border-2 bg-white shadow-md transition-all duration-200
      ${isCurrentTurn ? 'border-blue-500 bg-blue-50 shadow-lg' : 'border-gray-200'}
      ${isCharacterDead ? 'opacity-60' : ''}
      ${className}
    `}>
      {/* Current Turn Indicator */}
      {isCurrentTurn && (
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
          {participant.turnOrder || 1}
        </div>
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Character Avatar/Icon */}
          <div className={`
            flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white
            ${participant.type === 'player' ? 'bg-blue-600' : 'bg-red-600'}
          `}>
            {participant.type === 'player' ? (
              <User size={16} />
            ) : (
              participant.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Name and Class/Type */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {participant.name}
            </h3>
            <p className="truncate text-xs text-gray-600">
              {participant.type === 'player' 
                ? `${characterData?.class?.name || 'Unknown'} ${characterData?.level || participant.level || 1}`
                : `CR ${participant.challengeRating || '?'}`
              }
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1">
          {getStatusIcon()}
          {isOnline ? (
            <Wifi size={12} className="text-green-600" />
          ) : (
            <WifiOff size={12} className="text-gray-400" />
          )}
          <SyncStatusIcon size={12} />
          
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1 hover:bg-gray-100"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Combat Stats Row */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-3">
          {/* HP Bar */}
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">HP</span>
              <button
                onClick={() => setEditingHP(true)}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                {editingHP ? (
                  <input
                    type="number"
                    value={hpInput}
                    onChange={(e) => setHpInput(e.target.value)}
                    onBlur={handleHPSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleHPSubmit()}
                    className="w-12 rounded border px-1 text-center text-xs"
                    autoFocus
                  />
                ) : (
                  `${participant.hitPoints.current}/${participant.hitPoints.max}`
                )}
              </button>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all duration-300 ${getHPColor()}`}
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
            {participant.hitPoints.temporary > 0 && (
              <div className="mt-1 text-xs text-blue-600">
                +{participant.hitPoints.temporary} temp
              </div>
            )}
          </div>

          {/* AC */}
          <div className="text-center">
            <div className="text-xs text-gray-600">AC</div>
            {editingAC ? (
              <input
                type="number"
                value={acInput}
                onChange={(e) => setAcInput(e.target.value)}
                onBlur={handleACSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleACSubmit()}
                className="w-8 rounded border px-1 text-center text-sm"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingAC(true)}
                className="text-sm font-semibold text-gray-900 hover:text-blue-600"
              >
                {participant.armorClass}
              </button>
            )}
          </div>

          {/* Initiative */}
          <div className="text-center">
            <div className="text-xs text-gray-600">Init</div>
            <div className="text-sm font-semibold text-gray-900">
              {participant.initiative}
            </div>
          </div>
        </div>
      </div>

      {/* Action Economy (Always Visible) */}
      <div className="flex items-center justify-center gap-1 px-3 pb-2">
        <ActionIndicator 
          type="action" 
          available={true}
          onClick={() => onActionUse?.('action')}
        />
        <ActionIndicator 
          type="bonus" 
          available={true}
          onClick={() => onActionUse?.('bonus')}
        />
        <ActionIndicator 
          type="reaction" 
          available={true}
          onClick={() => onActionUse?.('reaction')}
        />
        <ActionIndicator 
          type="movement" 
          available={true}
          onClick={() => onActionUse?.('movement')}
        />
      </div>

      {/* Expandable Resources Section */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-3">
          <div className="space-y-2">
            {/* Spell Slots */}
            {characterData?.spellSlots && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1">Spell Slots</h4>
                <div className="flex gap-1">
                  {Object.entries(characterData.spellSlots).map(([level, slots]) => {
                    if (slots.max === 0) return null;
                    return (
                      <div key={level} className="text-xs">
                        <span className="text-gray-600">{level}:</span>
                        <span className={slots.current === 0 ? 'text-red-600' : 'text-gray-900'}>
                          {slots.current}/{slots.max}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conditions */}
            {participant.conditions && participant.conditions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1">Conditions</h4>
                <div className="flex flex-wrap gap-1">
                  {participant.conditions.map((condition, index) => (
                    <span
                      key={index}
                      className="rounded bg-red-100 px-2 py-1 text-xs text-red-800"
                    >
                      {condition.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Death Saves (if dying) */}
            {isCharacterDying && participant.hitPoints.deathSaves && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1">Death Saves</h4>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">
                    Successes: {participant.hitPoints.deathSaves.successes}/3
                  </span>
                  <span className="text-red-600">
                    Failures: {participant.hitPoints.deathSaves.failures}/3
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionIndicatorProps {
  type: 'action' | 'bonus' | 'reaction' | 'movement';
  available: boolean;
  onClick?: () => void;
}

function ActionIndicator({ type, available, onClick }: ActionIndicatorProps) {
  const getLabel = () => {
    switch (type) {
      case 'action': return 'A';
      case 'bonus': return 'B';
      case 'reaction': return 'R';
      case 'movement': return 'M';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={!available}
      className={`
        flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-all
        ${available 
          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }
      `}
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} ${available ? 'available' : 'used'}`}
    >
      {getLabel()}
    </button>
  );
}
