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
  Users
} from 'lucide-react';
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
  className = ''
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
    startEncounter
  } = useCombatStore();

  if (!activeEncounter) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}>
        <div className="text-center">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Combat</h3>
          <p className="text-gray-600 mb-4">Start a new encounter to begin combat tracking</p>
          <button
            onClick={() => {
              // Start a new encounter with no participants initially
              startEncounter(campaignId, [], 'New Combat Encounter');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} className="inline mr-2" />
            Start Combat
          </button>
        </div>
      </div>
    );
  }

  const handleLayoutChange = (mode: CombatLayoutMode) => {
    setLayoutMode(mode);
  };

  const handleParticipantSelect = (participantId: string, multiSelect: boolean = false) => {
    selectParticipant(participantId, multiSelect);
  };

  const handleParticipantRemove = (participantId: string) => {
    removeParticipant(participantId);
  };

  const handleEndCombat = () => {
    if (window.confirm('Are you sure you want to end this combat encounter? This will save the final state to the encounter history.')) {
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
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Combat Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          {/* Combat Info */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeEncounter.name || 'Combat Encounter'}
              </h2>
              <div className="text-sm text-gray-600">
                {activeEncounter.participants.length} participants • Round {activeEncounter.currentRound}
              </div>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              activeEncounter.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {activeEncounter.isActive ? 'Active' : 'Paused'}
            </div>
          </div>

          {/* Layout Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-gray-300 rounded-lg">
              <button
                onClick={() => handleLayoutChange('initiative')}
                className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
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
                className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
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
            <button
              onClick={() => setShowAddParticipant(true)}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              title="Add Participant"
            >
              <Plus size={16} />
            </button>

            <button
              onClick={() => setShowLog(!showLog)}
              className={`px-3 py-2 rounded-lg transition-colors ${
                showLog 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Combat Log"
            >
              <Scroll size={16} />
            </button>

            <button
              onClick={() => activeEncounter.isActive ? pauseEncounter() : resumeEncounter()}
              className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              title={activeEncounter.isActive ? 'Pause Combat' : 'Resume Combat'}
            >
              {activeEncounter.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            <button
              onClick={handleEndCombat}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="End Combat"
            >
              <StopCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Combat Area */}
      <div className="flex">
        {/* Left Sidebar - Initiative Tracker */}
        <div className="w-80 border-r border-gray-200 p-4 bg-gray-50">
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
                isSelected={canvasState.selectedParticipants.includes(participant.id)}
                compact={canvasState.compactCards}
                onSelect={() => handleParticipantSelect(participant.id)}
                onRemove={() => handleParticipantRemove(participant.id)}
                className={canvasState.layoutMode === 'free' ? 'absolute' : ''}
                style={canvasState.layoutMode === 'free' ? {
                  left: participant.position.x,
                  top: participant.position.y
                } : undefined}
              />
            ))}
          </div>

          {/* Empty state when no participants */}
          {activeEncounter.participants.length === 0 && (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Participants</h3>
              <p className="text-gray-600 mb-4">Add players and monsters to start combat</p>
              <button
                onClick={() => setShowAddParticipant(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} className="inline mr-2" />
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




