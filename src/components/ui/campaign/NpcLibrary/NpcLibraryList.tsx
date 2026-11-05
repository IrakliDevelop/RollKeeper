'use client';

import DragDropList from '@/components/ui/layout/DragDropList';
import { Section } from '@/components/ui/layout/section';
import { NpcLibraryRow, type NpcLibraryRowProps } from './NpcLibraryRow';
import type { NpcGroup } from './NpcLibrary.hooks';
import type { CampaignNPC } from '@/types/encounter';

export interface NpcLibraryListProps {
  flat: CampaignNPC[];
  groups: NpcGroup[] | null;
  collapsedGroups: ReadonlySet<string>;
  onGroupCollapsedChange: (groupName: string, collapsed: boolean) => void;
  reordering: boolean;
  onReorder: (subsetIds: string[], fromIndex: number, toIndex: number) => void;
  rowProps: (
    npc: CampaignNPC
  ) => Omit<NpcLibraryRowProps, 'npc' | 'headingLevel' | 'reorder'>;
}

/** The library's rows: one list, or one level-3 section per group. */
export function NpcLibraryList({
  flat,
  groups,
  collapsedGroups,
  onGroupCollapsedChange,
  reordering,
  onReorder,
  rowProps,
}: NpcLibraryListProps) {
  const renderList = (npcs: CampaignNPC[], headingLevel: 3 | 4) => {
    const subsetIds = npcs.map(npc => npc.id);
    return (
      <DragDropList
        as="ul"
        itemAs="li"
        items={npcs}
        keyExtractor={npc => npc.id}
        onReorder={(from, to) => onReorder(subsetIds, from, to)}
        className="divide-divider divide-y"
        itemClassName="group py-4 pointer-coarse:min-h-11"
        dragHandlePosition="right"
        renderItem={(npc, index) => (
          <NpcLibraryRow
            npc={npc}
            headingLevel={headingLevel}
            {...rowProps(npc)}
            reorder={
              reordering
                ? {
                    index,
                    count: subsetIds.length,
                    onMove: to => onReorder(subsetIds, index, to),
                  }
                : undefined
            }
          />
        )}
      />
    );
  };

  if (!groups) return renderList(flat, 3);

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <Section
          key={group.name}
          level={3}
          heading={`${group.name} (${group.npcs.length})`}
          collapsed={collapsedGroups.has(group.name)}
          onCollapsedChange={collapsed =>
            onGroupCollapsedChange(group.name, collapsed)
          }
        >
          {renderList(group.npcs, 4)}
        </Section>
      ))}
    </div>
  );
}
