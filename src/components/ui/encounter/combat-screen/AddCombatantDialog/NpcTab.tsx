'use client';

import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { SavedCreaturePicker } from './SavedCreaturePicker';

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
  const storedNpcs = useMemo(
    () => (campaignCode ? getNPCsForCampaign(campaignCode) : []),
    [campaignCode, getNPCsForCampaign]
  );
  const allNpcs = useMemo(
    () =>
      [
        ...npcs,
        ...storedNpcs.filter(sn => !npcs.some(n => n.id === sn.id)),
      ].filter(npc => (npc.kind ?? 'npc') === 'npc'),
    [npcs, storedNpcs]
  );

  const handleCreateNpc = () => {
    if (!npcName.trim() || !campaignCode) return;
    createNPC(campaignCode, {
      name: npcName.trim(),
      kind: 'npc',
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

      {!creatingNpc && (
        <SavedCreaturePicker
          creatures={allNpcs}
          emptyMessage="No NPCs yet. Create one to reuse across encounters."
          onSelect={handleAddNpc}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
