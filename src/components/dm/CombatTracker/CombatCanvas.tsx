'use client';

import React, { useState } from 'react';
import {
  Grid3X3,
  List,
  Move,
  Plus,
  StopCircle,
  Scroll,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { CombatParticipantCard } from './CombatParticipantCard';
import { InitiativeTracker } from './InitiativeTracker';
import { CombatLog } from './CombatLog';
import { AddParticipantModal } from './AddParticipantModal';
import { useCombatStore } from '@/store/combatStore';
import { CombatLayoutMode } from '@/types/combat';

interface CombatCanvasProps {
  campaignId: string;
  className?: string;
}

export function CombatCanvas({
  campaignId,
  className = '',
}: CombatCanvasProps) {
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const {
    activeEncounter,
    combatLog,
    canvasState,
    setLayoutMode,
    selectParticipant,
    removeParticipant,
    endEncounter,
    pauseEncounter,
    resumeEncounter,
    clearCombatLog,
    startEncounter,
  } = useCombatStore();

  if (!activeEncounter) {
    return (
      <div
        className={`flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 ${className}`}
      >
        <div className="text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            No Active Combat
          </h3>
          <p className="mb-4 text-gray-600">
            Start a new encounter to begin combat tracking
          </p>
          <button
            onClick={() => {
              // Start a new encounter with no participants initially
              startEncounter(campaignId, [], 'New Combat Encounter');
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} className="mr-2 inline" />
            Start Combat
          </button>
        </div>
      </div>
    );
  }

  const handleLayoutChange = (mode: CombatLayoutMode) => {
    setLayoutMode(mode);
  };

  const handleParticipantSelect = (
    participantId: string,
    multiSelect: boolean = false
  ) => {
    selectParticipant(participantId, multiSelect);
  };

  const handleParticipantRemove = (participantId: string) => {
    removeParticipant(participantId);
  };

  const handleEndCombat = () => {
    if (
      window.confirm(
        'Are you sure you want to end this combat encounter? This will save the final state to the encounter history.'
      )
    ) {
      endEncounter();
    }
  };

  const getLayoutClasses = () => {
    switch (canvasState.layoutMode) {
      case 'grid':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
      case 'initiative':
        return 'flex flex-wrap gap-4';
      case 'free':
        return 'relative min-h-[600px]'; // For drag-and-drop positioning
      default:
        return 'flex flex-wrap gap-4';
    }
  };

  return (
    <div className={`rounded-lg bg-white shadow-lg ${className}`}>
      {/* Combat Toolbar */}
      <div className="rounded-t-lg border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          {/* Combat Info */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeEncounter.name || 'Combat Encounter'}
              </h2>
              <div className="text-sm text-gray-600">
                {activeEncounter.participants.length} participants • Round{' '}
                {activeEncounter.currentRound}
              </div>
            </div>

            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                activeEncounter.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {activeEncounter.isActive ? 'Active' : 'Paused'}
            </div>
          </div>

          {/* Layout Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-300 bg-white">
              <button
                onClick={() => handleLayoutChange('initiative')}
                className={`rounded-l-lg px-3 py-2 text-sm font-medium transition-colors ${
                  canvasState.layoutMode === 'initiative'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title="Initiative Order"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => handleLayoutChange('grid')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  canvasState.layoutMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title="Grid Layout"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => handleLayoutChange('free')}
                className={`rounded-r-lg px-3 py-2 text-sm font-medium transition-colors ${
                  canvasState.layoutMode === 'free'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title="Free Arrangement"
              >
                <Move size={16} />
              </button>
            </div>

            {/* Action Buttons */}
            <Button
              onClick={() => setShowAddParticipant(true)}
              variant="success"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              title="Add Participant"
            />

            <Button
              onClick={() => setShowLog(!showLog)}
              variant={showLog ? 'secondary' : 'outline'}
              size="sm"
              leftIcon={<Scroll className="h-4 w-4" />}
              title="Combat Log"
            />

            <Button
              onClick={() =>
                activeEncounter.isActive ? pauseEncounter() : resumeEncounter()
              }
              variant="warning"
              size="sm"
              leftIcon={
                activeEncounter.isActive ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )
              }
              title={
                activeEncounter.isActive ? 'Pause Combat' : 'Resume Combat'
              }
            />

            <Button
              onClick={handleEndCombat}
              variant="danger"
              size="sm"
              leftIcon={<StopCircle className="h-4 w-4" />}
              title="End Combat"
            />
          </div>
        </div>
      </div>

      {/* Main Combat Area */}
      <div className="flex">
        {/* Left Sidebar - Initiative Tracker */}
        <div className="w-80 border-r border-gray-200 bg-gray-50 p-4">
          <InitiativeTracker
            participants={activeEncounter.participants}
            currentTurn={activeEncounter.currentTurn}
            currentRound={activeEncounter.currentRound}
            isActive={activeEncounter.isActive}
          />
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-6">
          <div className={getLayoutClasses()}>
            {activeEncounter.participants.map((participant, index) => (
              <CombatParticipantCard
                key={participant.id}
                participant={participant}
                isCurrentTurn={index === activeEncounter.currentTurn}
                isSelected={canvasState.selectedParticipants.includes(
                  participant.id
                )}
                compact={canvasState.compactCards}
                onSelect={() => handleParticipantSelect(participant.id)}
                onRemove={() => handleParticipantRemove(participant.id)}
                className={canvasState.layoutMode === 'free' ? 'absolute' : ''}
                style={
                  canvasState.layoutMode === 'free'
                    ? {
                        left: participant.position.x,
                        top: participant.position.y,
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* Empty state when no participants */}
          {activeEncounter.participants.length === 0 && (
            <div className="py-12 text-center">
              <Users size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                No Participants
              </h3>
              <p className="mb-4 text-gray-600">
                Add players and monsters to start combat
              </p>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2 inline" />
                Add Participants
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar - Combat Log (conditionally shown) */}
        {showLog && (
          <div className="w-80 border-l border-gray-200 bg-gray-50">
            <CombatLog
              entries={combatLog}
              currentRound={activeEncounter.currentRound}
              onClear={clearCombatLog}
            />
          </div>
        )}
      </div>

      {/* Add Participant Modal */}
      {showAddParticipant && (
        <AddParticipantModal
          campaignId={campaignId}
          onClose={() => setShowAddParticipant(false)}
        />
      )}
    </div>
  );
}
