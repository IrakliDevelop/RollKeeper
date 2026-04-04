'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Plus,
  Edit3,
  Trash2,
  Shield,
  Heart,
  Footprints,
  Drama,
  ChevronDown,
  ChevronRight,
  Search,
  Tag,
  Eye,
  Lightbulb,
} from 'lucide-react';
import { useNPCStore } from '@/store/npcStore';
import { useDmStore } from '@/store/dmStore';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Input } from '@/components/ui/forms/input';
import { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import { NPCFormDialog } from './NPCFormDialog';
import { NPCDetailDialog } from './NPCDetailDialog';

interface NPCSectionProps {
  campaignCode: string;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
}

export function NPCSection({
  campaignCode,
  onSendItemToPlayer,
}: NPCSectionProps) {
  const {
    getNPCsForCampaign,
    createNPC,
    updateNPC,
    deleteNPC,
    reorderNPCsSubset,
  } = useNPCStore();
  const { getCampaign, setDmDashboardUi } = useDmStore();
  const campaign = getCampaign(campaignCode);
  const npcSectionOpen = campaign?.dmDashboardUi?.npcSectionOpen ?? true;
  const collapsedGroups = useMemo(() => {
    const names = campaign?.dmDashboardUi?.npcCollapsedGroupNames;
    return new Set(names ?? []);
  }, [campaign?.dmDashboardUi?.npcCollapsedGroupNames]);
  const npcs = getNPCsForCampaign(campaignCode);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<CampaignNPC | null>(null);
  const [selectedNpc, setSelectedNpc] = useState<CampaignNPC | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
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

  const handleUpdateInventory = (
    npcId: string,
    inventory: NPCInventoryItem[]
  ) => {
    updateNPC(campaignCode, npcId, { inventory });
    // Update selectedNpc snapshot so the detail dialog reflects the change
    setSelectedNpc(prev =>
      prev && prev.id === npcId ? { ...prev, inventory } : prev
    );
  };

  const handleTagToggle = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleGroupToggle = (groupName: string) => {
    const current =
      getCampaign(campaignCode)?.dmDashboardUi?.npcCollapsedGroupNames ?? [];
    const next = new Set(current);
    if (next.has(groupName)) next.delete(groupName);
    else next.add(groupName);
    setDmDashboardUi(campaignCode, {
      npcCollapsedGroupNames: Array.from(next),
    });
  };

  // Collect all unique tags across all NPCs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    npcs.forEach(npc => {
      npc.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [npcs]);

  // Filter NPCs by search query and active tags
  const filteredNpcs = useMemo(() => {
    return npcs.filter(npc => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        npc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags =
        activeTags.size === 0 ||
        Array.from(activeTags).every(tag => npc.tags?.includes(tag));
      return matchesSearch && matchesTags;
    });
  }, [npcs, searchQuery, activeTags]);

  // Group filtered NPCs
  const groups = useMemo(() => {
    const groupMap = new Map<string, CampaignNPC[]>();
    const ungrouped: CampaignNPC[] = [];

    filteredNpcs.forEach(npc => {
      if (npc.group) {
        const existing = groupMap.get(npc.group) ?? [];
        existing.push(npc);
        groupMap.set(npc.group, existing);
      } else {
        ungrouped.push(npc);
      }
    });

    const result: Array<{
      name: string;
      npcs: CampaignNPC[];
      isUngrouped?: boolean;
    }> = [];
    groupMap.forEach((groupNpcs, name) => {
      result.push({ name, npcs: groupNpcs });
    });
    result.sort((a, b) => a.name.localeCompare(b.name));

    if (ungrouped.length > 0) {
      result.push({ name: 'Ungrouped', npcs: ungrouped, isUngrouped: true });
    }

    return result;
  }, [filteredNpcs]);

  // Determine if we should show groups (any NPC has a group)
  const hasAnyGroup = npcs.some(npc => !!npc.group);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDmDashboardUi(campaignCode, {
                npcSectionOpen: !npcSectionOpen,
              })
            }
            className="text-muted hover:text-body hover:bg-surface-secondary shrink-0 rounded-md p-1 transition-colors"
            aria-expanded={npcSectionOpen}
            aria-controls="dm-campaign-npc-section"
            title={npcSectionOpen ? 'Collapse NPCs' : 'Expand NPCs'}
          >
            {npcSectionOpen ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <Drama size={20} className="text-muted shrink-0" />
            <h2 className="text-heading text-lg font-semibold">
              NPCs ({npcs.length})
            </h2>
          </div>
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

      {!npcSectionOpen ? null : npcs.length === 0 ? (
        <div className="border-divider bg-surface-secondary rounded-lg border-2 border-dashed p-8 text-center">
          <Drama size={40} className="text-faint mx-auto mb-3" />
          <p className="text-muted mb-1 text-sm">No NPCs yet</p>
          <p className="text-faint text-xs">
            Create persistent NPCs to quickly add them to any encounter.
          </p>
        </div>
      ) : (
        <div id="dm-campaign-npc-section">
          {/* Search bar */}
          <div className="mb-3">
            <Input
              placeholder="Search NPCs…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search size={14} />}
              clearable
              onClear={() => setSearchQuery('')}
              size="sm"
            />
          </div>

          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <Tag size={13} className="text-faint shrink-0" />
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={[
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    activeTags.has(tag)
                      ? 'bg-accent-purple-bg text-accent-purple-text border-accent-purple-border'
                      : 'bg-surface-secondary text-muted border-divider hover:text-body hover:border-divider-strong',
                  ].join(' ')}
                >
                  {tag}
                </button>
              ))}
              {activeTags.size > 0 && (
                <button
                  onClick={() => setActiveTags(new Set())}
                  className="text-faint hover:text-muted ml-1 text-xs underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filteredNpcs.length === 0 ? (
            <p className="text-faint py-6 text-center text-sm">
              No NPCs match your filters.
            </p>
          ) : hasAnyGroup ? (
            /* Grouped layout */
            <div className="space-y-4">
              {groups.map(group => (
                <div key={group.name}>
                  {/* Group header */}
                  <button
                    onClick={() => handleGroupToggle(group.name)}
                    className="border-divider bg-surface-secondary hover:bg-surface-raised mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
                  >
                    {collapsedGroups.has(group.name) ? (
                      <ChevronRight size={15} className="text-muted shrink-0" />
                    ) : (
                      <ChevronDown size={15} className="text-muted shrink-0" />
                    )}
                    <span className="text-heading text-sm font-semibold">
                      {group.isUngrouped ? 'Ungrouped' : group.name}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {group.npcs.length}
                    </Badge>
                  </button>

                  {/* Group NPCs */}
                  {!collapsedGroups.has(group.name) && (
                    <DragDropList
                      items={group.npcs}
                      keyExtractor={npc => npc.id}
                      onReorder={(from, to) =>
                        reorderNPCsSubset(
                          campaignCode,
                          group.npcs.map(n => n.id),
                          from,
                          to
                        )
                      }
                      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
                      itemClassName="group min-w-0"
                      dragHandlePosition="right"
                      renderItem={npc => (
                        <NPCCard
                          npc={npc}
                          onEdit={() => handleEdit(npc)}
                          onDelete={() => handleDelete(npc)}
                          onClick={() => setSelectedNpc(npc)}
                        />
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Flat layout (no groups defined) */
            <DragDropList
              items={filteredNpcs}
              keyExtractor={npc => npc.id}
              onReorder={(from, to) =>
                reorderNPCsSubset(
                  campaignCode,
                  filteredNpcs.map(n => n.id),
                  from,
                  to
                )
              }
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              itemClassName="group min-w-0"
              dragHandlePosition="right"
              renderItem={npc => (
                <NPCCard
                  npc={npc}
                  onEdit={() => handleEdit(npc)}
                  onDelete={() => handleDelete(npc)}
                  onClick={() => setSelectedNpc(npc)}
                />
              )}
            />
          )}
        </div>
      )}

      <NPCFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editingNpc={editingNpc}
        existingGroups={[
          ...new Set(npcs.map(n => n.group).filter((g): g is string => !!g)),
        ]}
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
        onUpdateInventory={handleUpdateInventory}
        onSendItemToPlayer={onSendItemToPlayer}
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
  const hasPortrait = !!npc.avatarUrl;

  return (
    <div
      className="border-accent-purple-border bg-surface-raised h-[210px] cursor-pointer overflow-hidden rounded-lg border-2 shadow-sm transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {hasPortrait ? (
        /* Horizontal layout with tall portrait on the left */
        <div className="flex h-full">
          {/* Portrait column */}
          <div className="border-divider relative w-28 shrink-0 self-stretch border-r-2 sm:w-32">
            <Image
              src={npc.avatarUrl!}
              alt={npc.name}
              fill
              className="object-cover object-top"
            />
          </div>

          {/* Content column */}
          <div className="flex min-w-0 flex-1 flex-col p-3">
            {/* Header row */}
            <div className="mb-2 flex items-start justify-between gap-1">
              <div className="min-w-0">
                <h3 className="text-heading truncate text-sm leading-tight font-semibold">
                  {npc.name}
                </h3>
                {stats && (
                  <p className="text-faint truncate text-[10px]">
                    {stats.size} {stats.type}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-muted hover:text-body rounded p-1 transition-colors"
                  title="Edit"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p
              className="text-muted mb-2 line-clamp-2 min-h-[28px] text-xs leading-snug"
              title={npc.description?.trim() || undefined}
            >
              {npc.description?.trim() || '\u00A0'}
            </p>

            {/* CR + Prof badges */}
            <div className="mb-2 flex flex-wrap gap-1">
              {stats?.cr != null && (
                <Badge variant="outline" size="sm" className="text-[10px]">
                  CR {stats.cr}
                </Badge>
              )}
              {npc.proficiencyBonus != null && (
                <Badge variant="neutral" size="sm" className="text-[10px]">
                  Prof +{npc.proficiencyBonus}
                </Badge>
              )}
            </div>

            {/* HP / AC / Speed / PP */}
            <div className="text-body mb-1 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-0.5">
                <Heart size={11} className="text-accent-red-text shrink-0" />
                {npc.maxHp}
              </span>
              {npc.hitDice && (
                <span className="text-faint text-[10px]">
                  HD {npc.hitDice.max}
                  {npc.hitDice.dieType}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Shield size={11} className="text-accent-blue-text shrink-0" />
                {npc.armorClass}
              </span>
              <span className="flex items-center gap-0.5">
                <Footprints size={11} className="text-muted shrink-0" />
                {npc.speed}
              </span>
            </div>

            {/* Passive scores */}
            {(npc.passivePerception != null ||
              npc.passiveInsight != null ||
              npc.passiveInvestigation != null) && (
              <div className="bg-surface-secondary mb-1 flex items-center justify-between rounded-md px-2 py-1.5">
                {npc.passivePerception != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Perception"
                  >
                    <Eye size={11} className="text-accent-emerald-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PP
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passivePerception}
                    </span>
                  </div>
                )}
                {npc.passivePerception != null &&
                  npc.passiveInsight != null && (
                    <div className="bg-divider mx-1 h-3 w-px" />
                  )}
                {npc.passiveInsight != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Insight"
                  >
                    <Lightbulb size={11} className="text-accent-amber-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PI
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passiveInsight}
                    </span>
                  </div>
                )}
                {(npc.passivePerception != null ||
                  npc.passiveInsight != null) &&
                  npc.passiveInvestigation != null && (
                    <div className="bg-divider mx-1 h-3 w-px" />
                  )}
                {npc.passiveInvestigation != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Investigation"
                  >
                    <Search size={11} className="text-accent-blue-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PIv
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passiveInvestigation}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="mt-auto min-h-[18px]">
              {npc.tags && npc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {npc.tags.map(tag => (
                    <span
                      key={tag}
                      className="bg-surface-secondary border-divider text-faint rounded-full border px-1.5 py-px text-[9px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Vertical layout (no portrait) */
        <div className="flex h-full flex-col p-4">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between">
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
            <div className="flex shrink-0 items-center gap-1">
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

          <p
            className="text-muted mb-2 line-clamp-2 min-h-[34px] text-sm leading-snug"
            title={npc.description?.trim() || undefined}
          >
            {npc.description?.trim() || '\u00A0'}
          </p>

          {/* CR + Prof badges */}
          <div className="mb-2 flex flex-wrap gap-1">
            {stats?.cr != null && (
              <Badge variant="outline" size="sm" className="text-[10px]">
                CR {stats.cr}
              </Badge>
            )}
            {npc.proficiencyBonus != null && (
              <Badge variant="neutral" size="sm" className="text-[10px]">
                Prof +{npc.proficiencyBonus}
              </Badge>
            )}
          </div>

          {/* HP / AC / Speed */}
          <div className="text-body flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-accent-red-text" />
              {npc.maxHp} HP
            </span>
            {npc.hitDice && (
              <span className="text-faint text-xs">
                HD {npc.hitDice.max}
                {npc.hitDice.dieType}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Shield size={12} className="text-accent-blue-text" />
              AC {npc.armorClass}
            </span>
            <span className="flex items-center gap-1">
              <Footprints size={12} className="text-muted" />
              {npc.speed}
            </span>
          </div>

          {/* Passive scores */}
          {(npc.passivePerception != null ||
            npc.passiveInsight != null ||
            npc.passiveInvestigation != null) && (
            <div className="bg-surface-secondary mt-2 flex items-center justify-between rounded-lg px-3 py-2">
              {npc.passivePerception != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Perception"
                >
                  <Eye size={13} className="text-accent-emerald-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Perception
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passivePerception}
                  </span>
                </div>
              )}
              {npc.passivePerception != null && npc.passiveInsight != null && (
                <div className="bg-divider h-4 w-px" />
              )}
              {npc.passiveInsight != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Insight"
                >
                  <Lightbulb size={13} className="text-accent-amber-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Insight
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passiveInsight}
                  </span>
                </div>
              )}
              {(npc.passivePerception != null || npc.passiveInsight != null) &&
                npc.passiveInvestigation != null && (
                  <div className="bg-divider h-4 w-px" />
                )}
              {npc.passiveInvestigation != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Investigation"
                >
                  <Search size={13} className="text-accent-blue-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Investigation
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passiveInvestigation}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ability scores */}
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

          {/* Tags */}
          <div className="mt-auto min-h-[18px]">
            {npc.tags && npc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {npc.tags.map(tag => (
                  <span
                    key={tag}
                    className="bg-surface-secondary border-divider text-faint rounded-full border px-1.5 py-px text-[9px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
