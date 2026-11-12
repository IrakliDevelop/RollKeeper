'use client';

import { useId } from 'react';
import { ArrowLeftRight, Copy, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { EquipmentReorderControls } from '@/components/ui/character/equipment/EquipmentReorderControls';
import { RowAvatar } from '../RowAvatar';
import {
  creatureMetaLine,
  creaturePassives,
  creatureVitals,
} from './NpcLibrary.utils';
import type { CampaignNPC } from '@/types/encounter';

export interface NpcLibraryRowProps {
  npc: CampaignNPC;
  headingLevel: 3 | 4;
  moveLabel: string;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  viewRef?: (el: HTMLButtonElement | null) => void;
  reorder?: {
    index: number;
    count: number;
    onMove: (destinationIndex: number) => void;
  };
}

/** The content of one library entry's `li`; the list supplies the `li`. */
export function NpcLibraryRow({
  npc,
  headingLevel,
  moveLabel,
  onView,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  viewRef,
  reorder,
}: NpcLibraryRowProps) {
  const headingId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const meta = creatureMetaLine(npc);
  const description = npc.description?.trim();
  const passives = creaturePassives(npc);
  // A repeated tag would print twice, so show each once.
  const tags = [...new Set(npc.tags)];

  return (
    <>
      <div className="flex gap-3 [@media(hover:hover)]:pr-7">
        <RowAvatar src={npc.avatarUrl?.trim()} name={npc.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="min-w-0 flex-[1_1_14rem]">
              <Heading
                id={headingId}
                className="type-label-heading text-heading break-words"
              >
                {npc.name}
              </Heading>
              {meta && <p className="type-small text-muted">{meta}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                ref={viewRef}
                aria-describedby={headingId}
                onClick={onView}
              >
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={`Edit ${npc.name}`}
                onClick={onEdit}
              >
                <Edit3 size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={`Duplicate ${npc.name}`}
                onClick={onDuplicate}
              >
                <Copy size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={moveLabel}
                onClick={onMove}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="px-2"
                aria-label={`Delete ${npc.name}`}
                onClick={onDelete}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          {description && (
            <p className="type-small text-body line-clamp-2">{description}</p>
          )}
          <p className="type-ui text-heading tabular-nums">
            {creatureVitals(npc).join(' · ')}
          </p>
          {passives.length > 0 && (
            <p className="type-small text-muted">
              {passives.map(({ label, value }, i) =>
                i === 0 ? (
                  <span key={label}>
                    Passive {label}{' '}
                    <span className="text-heading tabular-nums">{value}</span>
                  </span>
                ) : (
                  <span key={label} className="hidden md:inline">
                    {' · '}
                    {label}{' '}
                    <span className="text-heading tabular-nums">{value}</span>
                  </span>
                )
              )}
            </p>
          )}
          {tags.length > 0 && (
            <ul aria-label="Tags" className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <li key={tag}>
                  <Badge variant="neutral" size="sm">
                    {tag}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {reorder && (
        <EquipmentReorderControls
          name={npc.name}
          index={reorder.index}
          count={reorder.count}
          onMove={reorder.onMove}
        />
      )}
    </>
  );
}
