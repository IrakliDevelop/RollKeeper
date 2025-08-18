'use client';

import React, { useState } from 'react';
import { 
  ChevronRight, 
  RotateCcw, 
  Play, 
  Pause, 
  SkipForward,
  Dice6,
  Crown,
  Skull,
  Clock
} from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { useCombatStore } from '@/store/combatStore';
import { isDying, isDead, isStabilized } from '@/utils/hpCalculations';

interface InitiativeTrackerProps {
  participants: CombatParticipant[];
  currentTurn: number;
  currentRound: number;
  isActive?: boolean;
  compact?: boolean;
  className?: string;
}

export function InitiativeTracker({
  participants,
  currentTurn,
  currentRound,
  isActive = true,
  compact = false,
  className = ''
}: InitiativeTrackerProps) {
  const [showRollDialog, setShowRollDialog] = useState(false);
  const { 
    advanceTurn, 
    setCurrentTurn, 
    rollInitiative, 
    pauseEncounter, 
    resumeEncounter 
  } = useCombatStore();

  const sortedParticipants = [...participants].sort((a, b) => b.initiative - a.initiative);
  const currentParticipant = sortedParticipants[currentTurn];

  const getParticipantStatusIcon = (participant: CombatParticipant) => {
    if (isDead(participant.hitPoints)) return '💀';
    if (isDying(participant.hitPoints)) return '💔';
    if (isStabilized(participant.hitPoints)) return '😵';
    if (participant.hitPoints.current === 0) return '😵';
    if (participant.hitPoints.current <= participant.hitPoints.max * 0.25) return '🩸';
    return '❤️';
  };

  const getParticipantStatusColor = (participant: CombatParticipant) => {
    if (isDead(participant.hitPoints)) return 'text-gray-500 bg-gray-100';
    if (isDying(participant.hitPoints)) return 'text-red-600 bg-red-50';
    if (isStabilized(participant.hitPoints)) return 'text-yellow-600 bg-yellow-50';
    if (participant.hitPoints.current === 0) return 'text-orange-600 bg-orange-50';
    if (participant.hitPoints.current <= participant.hitPoints.max * 0.25) return 'text-red-500 bg-red-50';
    return 'text-green-600 bg-green-50';
  };

  const handleAdvanceTurn = () => {
    advanceTurn();
  };

  const handleSetTurn = (participantIndex: number) => {
    setCurrentTurn(participantIndex);
  };

  const handleRollInitiative = (participantId?: string) => {
    rollInitiative(participantId);
    setShowRollDialog(false);
  };

  const containerClasses = compact
    ? `bg-white rounded-lg shadow border border-gray-200 p-3 ${className}`
    : `bg-white rounded-lg shadow-lg border border-gray-200 p-4 ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={compact ? 16 : 20} className="text-purple-600" />
          <h3 className={`font-bold text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}>
            Initiative
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-medium ${
            compact ? 'text-xs' : 'text-sm'
          }`}>
            Round {currentRound}
          </div>
        </div>
      </div>

      {/* Current Turn Display */}
      {currentParticipant && (
        <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 ${
          compact ? 'p-2 mb-3' : ''
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {currentParticipant.type === 'player' ? (
                  <Crown size={16} className="text-blue-600" />
                ) : (
                  <Skull size={16} className="text-red-600" />
                )}
                <span className={`font-bold text-blue-900 ${compact ? 'text-sm' : 'text-base'}`}>
                  {currentParticipant.name}
                </span>
              </div>
              <span className="text-xs text-blue-700">
                {getParticipantStatusIcon(currentParticipant)}
              </span>
            </div>
            <div className="text-xs text-blue-700">
              Initiative: {currentParticipant.initiative}
            </div>
          </div>
          {!compact && (
            <div className="text-xs text-blue-600 mt-1">
              {currentParticipant.type === 'player' ? (
                `Level ${currentParticipant.level} ${currentParticipant.class}`
              ) : (
                `CR ${currentParticipant.challengeRating}`
              )}
            </div>
          )}
        </div>
      )}

      {/* Turn Controls */}
      <div className={`flex gap-2 mb-4 ${compact ? 'mb-3' : ''}`}>
        <button
          onClick={handleAdvanceTurn}
          className={`flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium ${
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          }`}
        >
          <SkipForward size={16} />
          Next Turn
        </button>
        
        <button
          onClick={() => isActive ? pauseEncounter() : resumeEncounter()}
          className={`px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
            compact ? 'text-sm' : ''
          }`}
          title={isActive ? 'Pause Combat' : 'Resume Combat'}
        >
          {isActive ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      {/* Initiative Order */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className={`font-medium text-gray-700 ${compact ? 'text-sm' : 'text-base'}`}>
            Turn Order
          </h4>
          <button
            onClick={() => setShowRollDialog(true)}
            className={`text-purple-600 hover:text-purple-800 transition-colors ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            <Dice6 size={14} className="inline mr-1" />
            Reroll
          </button>
        </div>

        <div className={`space-y-1 max-h-60 overflow-y-auto ${compact ? 'max-h-48' : ''}`}>
          {sortedParticipants.map((participant, index) => {
            const isCurrent = index === currentTurn;
            
            return (
              <div
                key={participant.id}
                onClick={() => handleSetTurn(index)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  isCurrent 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'hover:bg-gray-50 border border-transparent'
                } ${compact ? 'p-1.5' : ''}`}
              >
                {/* Turn indicator */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {isCurrent ? <ChevronRight size={12} /> : index + 1}
                </div>

                {/* Participant info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {participant.type === 'player' ? (
                      <Crown size={12} className="text-blue-500 flex-shrink-0" />
                    ) : (
                      <Skull size={12} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className={`font-medium text-gray-900 truncate ${
                      compact ? 'text-sm' : 'text-base'
                    }`}>
                      {participant.name}
                    </span>
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-500">
                      {participant.type === 'player' ? (
                        `${participant.class} ${participant.level}`
                      ) : (
                        `CR ${participant.challengeRating}`
                      )}
                    </div>
                  )}
                </div>

                {/* Initiative score */}
                <div className="text-right">
                  <div className={`font-bold text-purple-800 ${compact ? 'text-sm' : 'text-base'}`}>
                    {participant.initiative}
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-500">
                      DEX {participant.dexterityModifier >= 0 ? '+' : ''}{participant.dexterityModifier}
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                  getParticipantStatusColor(participant)
                }`}>
                  {getParticipantStatusIcon(participant)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reroll Initiative Dialog */}
      {showRollDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reroll Initiative</h3>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleRollInitiative()}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                <Dice6 className="inline mr-2" size={16} />
                Reroll All Participants
              </button>
              
              <div className="text-center text-sm text-gray-500">or</div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Reroll Individual:</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {participants.map(participant => (
                    <button
                      key={participant.id}
                      onClick={() => handleRollInitiative(participant.id)}
                      className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                    >
                      {participant.name} ({participant.initiative})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRollDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
