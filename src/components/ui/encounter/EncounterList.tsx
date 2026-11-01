'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Swords,
  Trash2,
  Clock,
  Users,
  Play,
  Square,
  Map as MapIcon,
  Settings,
} from 'lucide-react';
import { useEncounterStore } from '@/store/encounterStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import { Card } from '@/components/ui/layout/card';
import { CombatConfigDialog } from '@/components/ui/encounter/CombatConfigDialog';
import { findLinkedBattleMap } from '@/utils/battleMapLinks';
import { Encounter } from '@/types/encounter';
import type { BattleMap } from '@/types/battlemap';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

interface EncounterListProps {
  campaignCode: string;
}

export function EncounterList({ campaignCode }: EncounterListProps) {
  const { encounters, createEncounter, deleteEncounter } = useEncounterStore();
  const battleMaps = useBattleMapStore(s => s.getBattleMaps)(campaignCode);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!isCreating && returnFocus.current) {
      createButtonRef.current?.focus();
      returnFocus.current = false;
    }
  }, [isCreating]);

  const handleCloseCreate = () => {
    returnFocus.current = true;
    setIsCreating(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createEncounter(newName.trim(), campaignCode);
    setNewName('');
    handleCloseCreate();
  };

  const filtered = encounters.filter(e => e.campaignCode === campaignCode);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-2">
        {isCreating ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
            onSubmit={event => {
              event.preventDefault();
              handleCreate();
            }}
          >
            <Input
              label="Encounter name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Goblin ambush"
              onKeyDown={e => {
                if (e.key === 'Escape') handleCloseCreate();
              }}
              autoFocus
              wrapperClassName="min-w-48 flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!newName.trim()}
            >
              Create encounter
            </Button>
            <Button size="sm" type="button" onClick={handleCloseCreate}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            ref={createButtonRef}
            variant="primary"
            onClick={() => setIsCreating(true)}
            leftIcon={<Plus size={18} />}
          >
            Create encounter
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfigOpen(true)}
          aria-label="Open combat configuration"
        >
          <Settings size={16} className="text-muted" />
        </Button>
      </div>

      <CombatConfigDialog open={configOpen} onOpenChange={setConfigOpen} />

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <h2 className="type-subheading text-heading">
            Create your first encounter
          </h2>
          <p className="type-body text-muted mt-2">
            Add combatants and track initiative here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map(encounter => (
            <EncounterCard
              key={encounter.id}
              encounter={encounter}
              campaignCode={campaignCode}
              linkedBattleMap={findLinkedBattleMap(battleMaps, encounter.id)}
              onDelete={async () => {
                const confirmed = await confirmDialog({
                  title: `Delete ${encounter.name}?`,
                  message: "This can't be undone.",
                  confirmLabel: 'Delete encounter',
                  tone: 'danger',
                });
                if (confirmed) deleteEncounter(encounter.id);
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
  linkedBattleMap,
  onDelete,
}: {
  encounter: Encounter;
  campaignCode: string;
  linkedBattleMap?: BattleMap;
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
    <Card className="flex h-full flex-col">
      <div className="flex flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="type-subheading text-heading min-w-0 break-words">
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

        <div className="text-muted mb-3 flex items-center gap-1 text-xs">
          <Clock size={10} />
          {new Date(encounter.updatedAt).toLocaleDateString()}
        </div>

        {linkedBattleMap && (
          <Link
            href={`/dm/campaign/${campaignCode}/battlemaps/${linkedBattleMap.id}`}
            onClick={e => e.stopPropagation()}
            className="text-body hover:text-heading mb-3 flex items-center gap-1.5 text-xs underline underline-offset-2"
          >
            <MapIcon size={12} />
            Map: {linkedBattleMap.name}
          </Link>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Button asChild variant="secondary" size="sm" className="flex-1">
            <Link
              href={`/dm/campaign/${campaignCode}/encounters/${encounter.id}`}
            >
              Open <span className="sr-only">{encounter.name}</span>
            </Link>
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={14} />
            Delete <span className="sr-only">{encounter.name}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
