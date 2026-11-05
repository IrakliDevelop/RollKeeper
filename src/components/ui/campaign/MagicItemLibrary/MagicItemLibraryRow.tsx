'use client';

import { useId } from 'react';
import { Copy, Edit3, Gift, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { formatRarity } from '@/utils/formatRarity';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

export interface MagicItemLibraryRowProps {
  item: CustomMagicItem;
  onGive: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  giveRef?: (el: HTMLButtonElement | null) => void;
}

const CATEGORY_LABELS: Partial<Record<CustomMagicItem['category'], string>> = {
  wondrous: 'wondrous item',
  other: 'item',
};

/** "Rare wondrous item", "Common item"; an artifact artifact reads "Artifact". */
function rarityAndCategory(item: CustomMagicItem): string {
  const rarity = formatRarity(item.rarity);
  if (item.rarity === 'artifact' && item.category === 'artifact') return rarity;
  return `${rarity} ${CATEGORY_LABELS[item.category] ?? item.category}`;
}

/** One magic item template, as an `li`. */
export function MagicItemLibraryRow({
  item,
  onGive,
  onEdit,
  onDuplicate,
  onDelete,
  giveRef,
}: MagicItemLibraryRowProps) {
  const headingId = useId();
  const meta = `${rarityAndCategory(item)}${
    item.group ? ` · ${item.group}` : ''
  }`;

  return (
    <li className="py-4 pointer-coarse:min-h-11">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_14rem]">
          <h3
            id={headingId}
            className="type-label-heading text-heading break-words"
          >
            {item.name}
          </h3>
          <p className="type-small text-muted">{meta}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            ref={giveRef}
            aria-describedby={headingId}
            leftIcon={<Gift size={16} aria-hidden="true" />}
            onClick={onGive}
          >
            Give copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Edit ${item.name}`}
            onClick={onEdit}
          >
            <Edit3 size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Duplicate ${item.name}`}
            onClick={onDuplicate}
          >
            <Copy size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-2"
            aria-label={`Delete ${item.name}`}
            onClick={onDelete}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {item.tags.length > 0 && (
        <ul aria-label="Tags" className="mt-1 flex flex-wrap gap-1">
          {item.tags.map(tag => (
            <li key={tag}>
              <Badge variant="neutral" size="sm">
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
