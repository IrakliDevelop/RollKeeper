'use client';

import React, { useState } from 'react';
import {
  Grid3X3,
  List,
  Plus,
  StopCircle,
  Scroll,
  Users,
  Wifi,
  WifiOff,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { CompactPlayerCard } from './CompactPlayerCard';
import { CombatLog } from './CombatLog';
import { AddParticipantModal } from './AddParticipantModal';
import { useRealtimeCombatStore } from '@/store/realtimeCombatStore';
import { useCombatStore } from '@/store/combatStore';
import { CombatLayoutMode } from '@/types/combat';

interface RealtimeCombatCanvasProps {
  campaignId: string;
  className?: string;
}

export function RealtimeCombatCanvas({
  campaignId,
  className = '',
}: RealtimeCombatCanvasProps) {
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [layoutMode, setLayoutMode] = useState<CombatLayoutMode>('grid');

  // Real-time combat store
  const {
    activeEncounter,
    isConnected,
    connectionError,
    connectedPlayers,
    startRealtimeCombat,
    endRealtimeCombat,
    updateParticipant,
    updateCharacterHP,
    updateCharacterAC,
    getCharacterData,
    isPlayerConnected,
  } = useRealtimeCombatStore();

  // Legacy combat store for encounter management
  const {
    combatLog,
    clearCombatLog,
  } = useCombatStore();

  // Start real-time combat when encounter begins
  const handleStartCombat = async () => {
    // Create a new encounter
    const newEncounter = {
      id: `encounter-${Date.now()}`,
      name: 'New Combat Encounter',
      campaignId,
      participants: [],
      currentRound: 1,
      currentTurn: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await startRealtimeCombat(campaignId, newEncounter);
  };

  const handleEndCombat = async () => {
    if (window.confirm('Are you sure you want to end this combat encounter?')) {
      await endRealtimeCombat();
    }
  };

  const handleParticipantHPChange = async (participantId: string, newHP: number) => {
    const participant = activeEncounter?.participants.find(p => p.id === participantId);
    if (!participant) return;

    // Update participant
    await updateParticipant(participantId, {
      hitPoints: {
        ...participant.hitPoints,
        current: newHP,
      },
    });

    // If it's a player character, also update the character data
    if (participant.characterReference?.characterId) {
      await updateCharacterHP(participant.characterReference.characterId, newHP, participant.hitPoints.temporary);
    }
  };

  const handleParticipantACChange = async (participantId: string, newAC: number) => {
    const participant = activeEncounter?.participants.find(p => p.id === participantId);
    if (!participant) return;

    await updateParticipant(participantId, { armorClass: newAC });

    if (participant.characterReference?.characterId) {
      await updateCharacterAC(participant.characterReference.characterId, newAC);
    }
  };

  const handleActionUse = async (participantId: string, actionType: 'action' | 'bonus' | 'reaction' | 'movement') => {
    // For now, just log the action
    console.log('Action used:', { participantId, actionType });
  };

  const handleNewTurn = async () => {
    if (!activeEncounter) return;

    // Advance turn/round
    const nextTurn = (activeEncounter.currentTurn + 1) % activeEncounter.participants.length;
    const nextRound = nextTurn === 0 ? activeEncounter.currentRound + 1 : activeEncounter.currentRound;

    // Update the encounter
    const updatedEncounter = {
      ...activeEncounter,
      currentTurn: nextTurn,
      currentRound: nextRound,
    };

    // For now, just update locally
    // In a real implementation, this would sync with the server
    console.log('New turn:', { nextTurn, nextRound });
    
    // Suppress unused variable warning
    void updatedEncounter;
  };

  const getLayoutClasses = () => {
    switch (layoutMode) {
      case 'grid':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
      case 'initiative':
        return 'flex flex-col gap-2';
      case 'free':
        return 'relative min-h-[600px]';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
    }
  };

  if (!activeEncounter) {
    return (
      <div className={`flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 ${className}`}>
        <div className="text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            No Active Combat
          </h3>
          <p className="mb-4 text-gray-600">
            Start a new real-time combat encounter
          </p>
          <button
            onClick={handleStartCombat}
            className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
          >
            <Play size={16} className="mr-2 inline" />
            Start Real-time Combat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg bg-white shadow-lg ${className}`}>
      {/* Combat Toolbar */}
      <div className="rounded-t-lg border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          {/* Combat Info */}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeEncounter.name || 'Real-time Combat'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{activeEncounter.participants.length} participants</span>
                <span>Round {activeEncounter.currentRound}</span>
                <div className="flex items-center gap-1">
                  {isConnected ? (
                    <>
                      <Wifi size={14} className="text-green-600" />
                      <span className="text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={14} className="text-red-600" />
                      <span className="text-red-600">Disconnected</span>
                    </>
                  )}
                </div>
                <span>{connectedPlayers.size} players online</span>
              </div>
            </div>

            {connectionError && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
                <AlertCircle size={14} />
                {connectionError}
              </div>
            )}
          </div>

          {/* Combat Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewTurn}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <RotateCcw size={14} />
              Next Turn
            </button>

            <button
              onClick={() => setShowAddParticipant(true)}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Plus size={14} />
              Add Participant
            </button>

            <button
              onClick={handleEndCombat}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <StopCircle size={14} />
              End Combat
            </button>
          </div>
        </div>

        {/* Layout Controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Layout:</span>
            <div className="flex items-center rounded-lg border border-gray-300 bg-white">
              <button
                onClick={() => setLayoutMode('grid')}
                className={`rounded-l-lg px-3 py-2 text-sm font-medium transition-colors ${
                  layoutMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Grid3X3 size={14} />
              </button>
              <button
                onClick={() => setLayoutMode('initiative')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  layoutMode === 'initiative'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <List size={14} />
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Scroll size={14} />
            Combat Log
          </button>
        </div>
      </div>

      {/* Combat Content */}
      <div className="p-4">
        <div className={getLayoutClasses()}>
          {activeEncounter.participants.map((participant, index) => (
            <CompactPlayerCard
              key={participant.id}
              participant={participant}
              characterData={participant.characterReference?.characterId ? getCharacterData(participant.characterReference.characterId) || undefined : undefined}
              isCurrentTurn={index === activeEncounter.currentTurn}
              isOnline={participant.type === 'player' ? isPlayerConnected('') : true}
              onHPChange={(newHP) => handleParticipantHPChange(participant.id, newHP)}
              onACChange={(newAC) => handleParticipantACChange(participant.id, newAC)}
              onActionUse={(actionType) => handleActionUse(participant.id, actionType)}
            />
          ))}
        </div>
      </div>

      {/* Combat Log Sidebar */}
      {showLog && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Combat Log</h3>
            <button
              onClick={clearCombatLog}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Log
            </button>
          </div>
          <CombatLog 
            entries={combatLog} 
            currentRound={activeEncounter?.currentRound || 1}
            onClear={clearCombatLog}
          />
        </div>
      )}

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
