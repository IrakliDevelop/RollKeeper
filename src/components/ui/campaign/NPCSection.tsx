'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Edit3, Trash2, Shield, Heart, Footprints } from 'lucide-react';
import { useNPCStore } from '@/store/npcStore';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { CampaignNPC } from '@/types/encounter';
import { NPCFormDialog } from './NPCFormDialog';
import { NPCDetailDialog } from './NPCDetailDialog';

interface NPCSectionProps {
  campaignCode: string;
}

export function NPCSection({ campaignCode }: NPCSectionProps) {
  const { getNPCsForCampaign, createNPC, updateNPC, deleteNPC } = useNPCStore();
  const npcs = getNPCsForCampaign(campaignCode);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<CampaignNPC | null>(null);
  const [selectedNpc, setSelectedNpc] = useState<CampaignNPC | null>(null);

  const handleCreate = () => {
    setEditingNpc(null);
    setDialogOpen(true);
  };

  const handleEdit = (npc: CampaignNPC) => {
    setEditingNpc(npc);
    setDialogOpen(true);
  };

  const handleSave = (
    data: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingNpc) {
      updateNPC(campaignCode, editingNpc.id, data);
    } else {
      createNPC(campaignCode, data);
    }
  };

  const handleDelete = (npc: CampaignNPC) => {
    if (confirm(`Delete "${npc.name}"? This cannot be undone.`)) {
      deleteNPC(campaignCode, npc.id);
      setSelectedNpc(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-muted" />
          <h2 className="text-heading text-lg font-semibold">
            NPCs ({npcs.length})
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCreate}
          leftIcon={<Plus size={16} />}
        >
          Create NPC
        </Button>
      </div>

      {npcs.length === 0 ? (
        <div className="border-divider bg-surface-secondary rounded-lg border-2 border-dashed p-8 text-center">
          <Shield size={40} className="text-faint mx-auto mb-3" />
          <p className="text-muted mb-1 text-sm">No NPCs yet</p>
          <p className="text-faint text-xs">
            Create persistent NPCs to quickly add them to any encounter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {npcs.map(npc => (
            <NPCCard
              key={npc.id}
              npc={npc}
              onEdit={() => handleEdit(npc)}
              onDelete={() => handleDelete(npc)}
              onClick={() => setSelectedNpc(npc)}
            />
          ))}
        </div>
      )}

      <NPCFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editingNpc={editingNpc}
      />

      <NPCDetailDialog
        npc={selectedNpc}
        open={!!selectedNpc}
        onOpenChange={open => {
          if (!open) setSelectedNpc(null);
        }}
        onEdit={npc => {
          setSelectedNpc(null);
          handleEdit(npc);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}

function NPCCard({
  npc,
  onEdit,
  onDelete,
  onClick,
}: {
  npc: CampaignNPC;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const stats = npc.monsterStatBlock;

  return (
    <div
      className="border-accent-purple-border bg-surface-raised cursor-pointer rounded-lg border-2 p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {npc.avatarUrl && (
            <Image
              src={npc.avatarUrl}
              alt={npc.name}
              width={40}
              height={40}
              className="shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-heading truncate text-base font-semibold">
              {npc.name}
            </h3>
            {stats && (
              <p className="text-faint truncate text-xs">
                {stats.size} {stats.type}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {stats?.cr != null && (
            <Badge variant="outline" className="mr-1 text-[10px]">
              CR {stats.cr}
            </Badge>
          )}
          <button
            onClick={e => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-muted hover:text-body rounded p-1 transition-colors"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {npc.description && (
        <p className="text-muted mb-3 line-clamp-2 text-sm">
          {npc.description}
        </p>
      )}

      <div className="text-body flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-1">
          <Heart size={12} className="text-accent-red-text" />
          {npc.maxHp} HP
        </span>
        <span className="flex items-center gap-1">
          <Shield size={12} className="text-accent-blue-text" />
          AC {npc.armorClass}
        </span>
        <span className="flex items-center gap-1">
          <Footprints size={12} className="text-muted" />
          {npc.speed}
        </span>
      </div>

      {npc.abilityScores && (
        <div className="mt-3 grid grid-cols-6 gap-1">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(
            ability => (
              <div key={ability} className="text-center">
                <span className="text-faint block text-[9px] font-medium uppercase">
                  {ability}
                </span>
                <span className="text-body text-xs font-medium">
                  {npc.abilityScores![ability]}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
