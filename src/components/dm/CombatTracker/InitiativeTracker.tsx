'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  Play,
  Pause,
  SkipForward,
  Dice6,
  Crown,
  Skull,
  Clock,
} from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { useCombatStore } from '@/store/combatStore';
import { Modal } from '@/components/ui/feedback/Modal';
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
  className = '',
}: InitiativeTrackerProps) {
  const [showRollDialog, setShowRollDialog] = useState(false);
  const {
    advanceTurn,
    setCurrentTurn,
    rollInitiative,
    pauseEncounter,
    resumeEncounter,
  } = useCombatStore();

  const sortedParticipants = [...participants].sort(
    (a, b) => b.initiative - a.initiative
  );
  const currentParticipant = sortedParticipants[currentTurn];

  const getParticipantStatusIcon = (participant: CombatParticipant) => {
    if (isDead(participant.hitPoints)) return '💀';
    if (isDying(participant.hitPoints)) return '💔';
    if (isStabilized(participant.hitPoints)) return '😵';
    if (participant.hitPoints.current === 0) return '😵';
    if (participant.hitPoints.current <= participant.hitPoints.max * 0.25)
      return '🩸';
    return '❤️';
  };

  const getParticipantStatusColor = (participant: CombatParticipant) => {
    if (isDead(participant.hitPoints)) return 'text-gray-500 bg-gray-100';
    if (isDying(participant.hitPoints)) return 'text-red-600 bg-red-50';
    if (isStabilized(participant.hitPoints))
      return 'text-yellow-600 bg-yellow-50';
    if (participant.hitPoints.current === 0)
      return 'text-orange-600 bg-orange-50';
    if (participant.hitPoints.current <= participant.hitPoints.max * 0.25)
      return 'text-red-500 bg-red-50';
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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={compact ? 16 : 20} className="text-purple-600" />
          <h3
            className={`font-bold text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}
          >
            Initiative
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-800 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            Round {currentRound}
          </div>
        </div>
      </div>

      {/* Current Turn Display */}
      {currentParticipant && (
        <div
          className={`mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 ${
            compact ? 'mb-3 p-2' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {currentParticipant.type === 'player' ? (
                  <Crown size={16} className="text-blue-600" />
                ) : (
                  <Skull size={16} className="text-red-600" />
                )}
                <span
                  className={`font-bold text-blue-900 ${compact ? 'text-sm' : 'text-base'}`}
                >
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
            <div className="mt-1 text-xs text-blue-600">
              {currentParticipant.type === 'player'
                ? `Level ${currentParticipant.level} ${currentParticipant.class}`
                : `CR ${currentParticipant.challengeRating}`}
            </div>
          )}
        </div>
      )}

      {/* Turn Controls */}
      <div className={`mb-4 flex gap-2 ${compact ? 'mb-3' : ''}`}>
        <button
          onClick={handleAdvanceTurn}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 font-medium text-white transition-colors hover:bg-blue-700 ${
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          }`}
        >
          <SkipForward size={16} />
          Next Turn
        </button>

        <button
          onClick={() => (isActive ? pauseEncounter() : resumeEncounter())}
          className={`rounded-lg border border-gray-300 px-3 py-2 transition-colors hover:bg-gray-50 ${
            compact ? 'text-sm' : ''
          }`}
          title={isActive ? 'Pause Combat' : 'Resume Combat'}
        >
          {isActive ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      {/* Initiative Order */}
      <div className="space-y-1">
        <div className="mb-2 flex items-center justify-between">
          <h4
            className={`font-medium text-gray-700 ${compact ? 'text-sm' : 'text-base'}`}
          >
            Turn Order
          </h4>
          <button
            onClick={() => setShowRollDialog(true)}
            className={`text-purple-600 transition-colors hover:text-purple-800 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            <Dice6 size={14} className="mr-1 inline" />
            Reroll
          </button>
        </div>

        <div
          className={`max-h-60 space-y-1 overflow-y-auto ${compact ? 'max-h-48' : ''}`}
        >
          {sortedParticipants.map((participant, index) => {
            const isCurrent = index === currentTurn;

            return (
              <div
                key={participant.id}
                onClick={() => handleSetTurn(index)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors ${
                  isCurrent
                    ? 'border border-blue-300 bg-blue-100'
                    : 'border border-transparent hover:bg-gray-50'
                } ${compact ? 'p-1.5' : ''}`}
              >
                {/* Turn indicator */}
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isCurrent ? <ChevronRight size={12} /> : index + 1}
                </div>

                {/* Participant info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {participant.type === 'player' ? (
                      <Crown
                        size={12}
                        className="flex-shrink-0 text-blue-500"
                      />
                    ) : (
                      <Skull size={12} className="flex-shrink-0 text-red-500" />
                    )}
                    <span
                      className={`truncate font-medium text-gray-900 ${
                        compact ? 'text-sm' : 'text-base'
                      }`}
                    >
                      {participant.name}
                    </span>
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-500">
                      {participant.type === 'player'
                        ? `${participant.class} ${participant.level}`
                        : `CR ${participant.challengeRating}`}
                    </div>
                  )}
                </div>

                {/* Initiative score */}
                <div className="text-right">
                  <div
                    className={`font-bold text-purple-800 ${compact ? 'text-sm' : 'text-base'}`}
                  >
                    {participant.initiative}
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-500">
                      DEX {participant.dexterityModifier >= 0 ? '+' : ''}
                      {participant.dexterityModifier}
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${getParticipantStatusColor(
                    participant
                  )}`}
                >
                  {getParticipantStatusIcon(participant)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reroll Initiative Dialog */}
      <Modal
        isOpen={showRollDialog}
        onClose={() => setShowRollDialog(false)}
        title="Reroll Initiative"
        size="sm"
      >
        <div className="p-6">
          <div className="mb-6 space-y-3">
            <button
              onClick={() => handleRollInitiative()}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white transition-colors hover:bg-purple-700"
            >
              <Dice6 className="mr-2 inline" size={16} />
              Reroll All Participants
            </button>

            <div className="text-center text-sm text-gray-500">or</div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Reroll Individual:
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {participants.map(participant => (
                  <button
                    key={participant.id}
                    onClick={() => handleRollInitiative(participant.id)}
                    className="w-full rounded bg-gray-50 px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-blue-100"
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
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
