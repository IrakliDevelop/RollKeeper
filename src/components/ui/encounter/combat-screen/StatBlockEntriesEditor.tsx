'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

export interface StatBlockEntry {
  name: string;
  text: string;
  uses?: number;
}

interface StatBlockEntriesEditorProps {
  title: string;
  entries: StatBlockEntry[];
  onChange: (entries: StatBlockEntry[]) => void;
}

const FIELD_CLASSES =
  'border-divider bg-surface-secondary w-full rounded-[10px] border-[1.5px] px-3 py-2 text-sm focus:outline-none';

/**
 * Editable list of stat-block entries (traits / actions / bonus actions /
 * reactions). Entry text may contain HTML from bestiary data; it is edited
 * raw and rendered downstream with dangerouslySetInnerHTML.
 */
export function StatBlockEntriesEditor({
  title,
  entries,
  onChange,
}: StatBlockEntriesEditorProps) {
  const update = (i: number, patch: Partial<StatBlockEntry>) => {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const remove = (i: number) => {
    onChange(entries.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <h5 className="text-muted text-[11px] font-extrabold tracking-wider uppercase">
        {title}
      </h5>
      {/* Controlled list, never reordered — index key is safe here. */}
      {entries.map((entry, i) => (
        <div
          key={i}
          className="border-divider bg-surface-raised space-y-2 rounded-[12px] border-[1.5px] p-3"
        >
          <div className="flex items-center gap-2">
            <input
              aria-label={`${title} entry name`}
              value={entry.name}
              onChange={e => update(i, { name: e.target.value })}
              placeholder="Name"
              className={`${FIELD_CLASSES} font-semibold`}
            />
            <input
              aria-label={`${title} entry uses`}
              type="number"
              value={entry.uses ?? ''}
              onChange={e =>
                update(i, {
                  uses:
                    e.target.value === ''
                      ? undefined
                      : parseInt(e.target.value, 10) || undefined,
                })
              }
              placeholder="Uses"
              className={`${FIELD_CLASSES} w-20 shrink-0`}
            />
            <button
              aria-label="Delete entry"
              onClick={() => remove(i)}
              className="text-muted hover:text-accent-red-text shrink-0 p-1.5 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <textarea
            aria-label={`${title} entry text`}
            value={entry.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder="Description"
            rows={3}
            className={`${FIELD_CLASSES} resize-y`}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...entries, { name: '', text: '' }])}
        leftIcon={<Plus size={14} />}
      >
        Add {title} entry
      </Button>
    </div>
  );
}
