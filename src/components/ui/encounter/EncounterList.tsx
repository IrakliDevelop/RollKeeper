'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Swords, Trash2, Clock, Users, Play, Square } from 'lucide-react';
import { useEncounterStore } from '@/store/encounterStore';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { Encounter } from '@/types/encounter';

interface EncounterListProps {
  campaignCode: string;
}

export function EncounterList({ campaignCode }: EncounterListProps) {
  const { encounters, createEncounter, deleteEncounter } = useEncounterStore();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createEncounter(newName.trim(), campaignCode);
    setNewName('');
    setIsCreating(false);
    // Navigate programmatically handled by parent page
  };

  const filtered = encounters.filter(e => e.campaignCode === campaignCode);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Create button / form */}
      {isCreating ? (
        <div className="bg-surface-raised border-divider flex items-center gap-3 rounded-lg border p-4">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Encounter name..."
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            autoFocus
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim()}
          >
            Create
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsCreating(true)}
          leftIcon={<Plus size={18} />}
        >
          New Encounter
        </Button>
      )}

      {/* Encounter list */}
      {sorted.length === 0 ? (
        <div className="border-divider bg-surface-secondary rounded-lg border-2 border-dashed p-12 text-center">
          <Swords size={48} className="text-faint mx-auto mb-4" />
          <h3 className="text-heading mb-2 text-lg font-semibold">
            No Encounters Yet
          </h3>
          <p className="text-muted mb-4">
            Create your first encounter to start tracking combat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map(encounter => (
            <EncounterCard
              key={encounter.id}
              encounter={encounter}
              campaignCode={campaignCode}
              onDelete={() => {
                if (
                  confirm(`Delete "${encounter.name}"? This cannot be undone.`)
                ) {
                  deleteEncounter(encounter.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterCard({
  encounter,
  campaignCode,
  onDelete,
}: {
  encounter: Encounter;
  campaignCode: string;
  onDelete: () => void;
}) {
  const monsterCount = encounter.entities.filter(
    e => e.type === 'monster'
  ).length;
  const playerCount = encounter.entities.filter(
    e => e.type === 'player'
  ).length;
  const npcCount = encounter.entities.filter(e => e.type === 'npc').length;

  return (
    <div className="border-divider bg-surface-raised hover:bg-surface-secondary rounded-lg border shadow-sm transition-all hover:shadow-md">
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-heading truncate text-lg font-semibold">
            {encounter.name}
          </h3>
          {encounter.isActive ? (
            <Badge variant="success">
              <Play size={10} className="mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="neutral">
              <Square size={10} className="mr-1" />
              Idle
            </Badge>
          )}
        </div>

        {encounter.isActive && (
          <div className="text-body mb-2 text-sm">
            Round {encounter.round} · Turn{' '}
            {encounter.entities[encounter.currentTurn]?.name ?? '—'}
          </div>
        )}

        <div className="text-muted mb-4 flex flex-wrap gap-3 text-sm">
          {playerCount > 0 && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {playerCount} player{playerCount !== 1 ? 's' : ''}
            </span>
          )}
          {monsterCount > 0 && (
            <span className="flex items-center gap-1">
              <Swords size={12} />
              {monsterCount} monster{monsterCount !== 1 ? 's' : ''}
            </span>
          )}
          {npcCount > 0 && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {npcCount} NPC{npcCount !== 1 ? 's' : ''}
            </span>
          )}
          {encounter.entities.length === 0 && <span>Empty</span>}
        </div>

        <div className="text-faint mb-3 flex items-center gap-1 text-xs">
          <Clock size={10} />
          {new Date(encounter.updatedAt).toLocaleDateString()}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dm/campaign/${campaignCode}/encounters/${encounter.id}`}
            className="flex-1"
          >
            <Button variant="secondary" size="sm" fullWidth>
              Open
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
