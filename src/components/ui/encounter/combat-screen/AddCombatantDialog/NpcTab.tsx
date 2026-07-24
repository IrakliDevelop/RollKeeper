'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CircleUserRound } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import type {
  CampaignNPC,
  EncounterEntity,
  PlayerDisposition,
} from '@/types/encounter';
import { useNPCStore } from '@/store/npcStore';
import { buildNpcEntity } from './buildEntity';
import { SharedOptions } from './SharedOptions';

interface NpcTabProps {
  npcs: CampaignNPC[];
  campaignCode?: string;
  onAdd: (entity: Omit<EncounterEntity, 'id'>) => void;
}

export function NpcTab({ npcs, campaignCode, onAdd }: NpcTabProps) {
  const [creatingNpc, setCreatingNpc] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcHp, setNpcHp] = useState('10');
  const [npcAc, setNpcAc] = useState('10');
  const [npcSpeed, setNpcSpeed] = useState('30 ft.');
  const [npcDescription, setNpcDescription] = useState('');
  const [hideName, setHideName] = useState(false);
  const [playerAlias, setPlayerAlias] = useState('');
  const [disposition, setDisposition] = useState<PlayerDisposition>('enemy');

  const { getNPCsForCampaign, createNPC, deleteNPC } = useNPCStore();
  const storedNpcs = campaignCode ? getNPCsForCampaign(campaignCode) : [];
  const allNpcs = [
    ...npcs,
    ...storedNpcs.filter(sn => !npcs.some(n => n.id === sn.id)),
  ];

  const handleCreateNpc = () => {
    if (!npcName.trim() || !campaignCode) return;
    createNPC(campaignCode, {
      name: npcName.trim(),
      maxHp: parseInt(npcHp) || 10,
      armorClass: npcAc.trim() || '10',
      speed: npcSpeed.trim() || '30 ft.',
      description: npcDescription.trim() || undefined,
    });
    setNpcName('');
    setNpcHp('10');
    setNpcAc('10');
    setNpcSpeed('30 ft.');
    setNpcDescription('');
    setCreatingNpc(false);
  };

  const handleAddNpc = (npc: CampaignNPC) => {
    onAdd(
      buildNpcEntity(npc, {
        isHidden: hideName,
        playerAlias: playerAlias || undefined,
        playerDisposition: disposition,
        campaignCode,
      })
    );
  };

  const handleDelete = (npc: CampaignNPC) => {
    if (confirm(`Delete "${npc.name}"?`) && campaignCode) {
      deleteNPC(campaignCode, npc.id);
    }
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Create NPC toggle / form */}
      {creatingNpc ? (
        <div className="border-accent-amber-border bg-surface-raised space-y-3 rounded-[13px] border-[1.5px] p-3">
          <p className="text-heading text-sm font-semibold">
            Create Permanent NPC
          </p>
          <Input
            value={npcName}
            onChange={e => setNpcName(e.target.value)}
            placeholder="NPC name"
            label="Name"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              value={npcHp}
              onChange={e => setNpcHp(e.target.value)}
              label="HP"
              type="number"
            />
            <Input
              value={npcAc}
              onChange={e => setNpcAc(e.target.value)}
              label="AC"
              placeholder="16 (natural armor)"
            />
            <Input
              value={npcSpeed}
              onChange={e => setNpcSpeed(e.target.value)}
              label="Speed"
            />
          </div>
          <Input
            value={npcDescription}
            onChange={e => setNpcDescription(e.target.value)}
            placeholder="Brief description (optional)"
            label="Description"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNpc}
              disabled={!npcName.trim()}
              leftIcon={<Plus size={14} />}
            >
              Save NPC
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreatingNpc(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreatingNpc(true)}
          className="border-accent-amber-border-strong bg-accent-amber-bg text-accent-amber-text flex w-full items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed py-3 text-sm font-extrabold"
        >
          <Plus size={14} />
          Create New NPC
        </button>
      )}

      {/* SharedOptions (when not creating) */}
      {!creatingNpc && (
        <SharedOptions
          hideName={hideName}
          onHideNameChange={setHideName}
          playerAlias={playerAlias}
          onPlayerAliasChange={setPlayerAlias}
          disposition={disposition}
          onDispositionChange={setDisposition}
        />
      )}

      {/* NPC rows */}
      {!creatingNpc && allNpcs.length === 0 && (
        <p className="text-muted py-8 text-center text-sm">
          No NPCs yet. Create one to reuse across encounters.
        </p>
      )}
      {allNpcs.map(npc => (
        <div
          key={npc.id}
          className="border-divider bg-surface-raised hover:border-accent-amber-border flex items-center rounded-[14px] border-[1.5px] text-sm transition-all"
        >
          <button
            onClick={() => handleAddNpc(npc)}
            className="flex flex-1 items-center gap-2 px-[14px] py-3 text-left"
          >
            <div className="bg-accent-amber-bg text-accent-amber-text flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]">
              <CircleUserRound size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-heading truncate text-[14.5px] font-bold">
                {npc.name}
              </div>
              {npc.description && (
                <div className="text-muted truncate text-xs">
                  {npc.description}
                </div>
              )}
            </div>
            <div className="text-muted shrink-0 text-right text-[12.5px] font-bold tabular-nums">
              {npc.maxHp} HP · AC {npc.armorClass}
            </div>
          </button>
          <button
            onClick={() => handleDelete(npc)}
            className="text-muted hover:text-accent-red-text shrink-0 p-2.5 transition-colors"
            title="Delete NPC"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
