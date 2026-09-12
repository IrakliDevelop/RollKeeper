'use client';

import React, { useMemo, useState } from 'react';
import { CircleUserRound, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import type { CampaignNPC } from '@/types/encounter';

interface SavedCreaturePickerProps {
  creatures: CampaignNPC[];
  emptyMessage: string;
  onSelect: (creature: CampaignNPC) => void;
  onDelete?: (creature: CampaignNPC) => void;
}

const ALL_GROUPS = '__all__';
const UNGROUPED = '__ungrouped__';

export function SavedCreaturePicker({
  creatures,
  emptyMessage,
  onSelect,
  onDelete,
}: SavedCreaturePickerProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(ALL_GROUPS);

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          creatures
            .map(creature => creature.group?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [creatures]
  );
  const hasUngrouped = creatures.some(creature => !creature.group?.trim());

  const filteredCreatures = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return creatures.filter(creature => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        creature.name.toLocaleLowerCase().includes(normalizedQuery) ||
        creature.group?.toLocaleLowerCase().includes(normalizedQuery) ||
        creature.tags?.some(tag =>
          tag.toLocaleLowerCase().includes(normalizedQuery)
        );
      const matchesGroup =
        group === ALL_GROUPS ||
        (group === UNGROUPED
          ? !creature.group?.trim()
          : creature.group === group);
      return matchesQuery && matchesGroup;
    });
  }, [creatures, group, query]);

  if (creatures.length === 0) {
    return (
      <p className="text-muted py-6 text-center text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search by name, group, or tag…"
          aria-label="Search saved creatures by name, group, or tag"
          leftIcon={<Search size={14} />}
          clearable
          onClear={() => setQuery('')}
          size="sm"
        />
        <SelectField
          value={group}
          onValueChange={setGroup}
          triggerProps={{
            size: 'sm',
            'aria-label': 'Filter saved creatures by group',
          }}
        >
          <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
          {hasUngrouped && <SelectItem value={UNGROUPED}>Ungrouped</SelectItem>}
          {groups.map(groupName => (
            <SelectItem key={groupName} value={groupName}>
              {groupName}
            </SelectItem>
          ))}
        </SelectField>
      </div>

      {filteredCreatures.length === 0 ? (
        <p className="text-muted py-6 text-center text-sm">
          No saved creatures match these filters.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredCreatures.map(creature => (
            <div
              key={creature.id}
              className="border-divider bg-surface-raised hover:border-accent-amber-border flex items-center rounded-[14px] border-[1.5px] text-sm transition-all"
            >
              <button
                type="button"
                onClick={() => onSelect(creature)}
                className="flex min-w-0 flex-1 items-center gap-2 px-[14px] py-3 text-left"
              >
                <div className="bg-accent-amber-bg text-accent-amber-text flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]">
                  <CircleUserRound size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-heading truncate text-[14.5px] font-bold">
                    {creature.name}
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    {creature.group && (
                      <Badge variant="neutral" size="sm">
                        {creature.group}
                      </Badge>
                    )}
                    {creature.description && (
                      <span className="text-muted truncate text-xs">
                        {creature.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-muted shrink-0 text-right text-[12.5px] font-bold tabular-nums">
                  {creature.maxHp} HP · AC {creature.armorClass}
                </div>
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(creature)}
                  className="text-muted hover:text-accent-red-text shrink-0 p-2.5 transition-colors"
                  title={`Delete ${creature.name}`}
                  aria-label={`Delete ${creature.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
