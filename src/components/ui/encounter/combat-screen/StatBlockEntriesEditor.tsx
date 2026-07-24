'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { NumberField } from '@/components/ui/forms/NumberInput';
import {
  parseAttackTokens,
  replaceDamage,
  replaceToHit,
  statBlockHtmlToPlainText,
} from '@/utils/statBlockText';

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

const FIELD_BASE =
  'border-divider bg-surface-secondary rounded-[10px] border-[1.5px] px-3 py-2 text-sm focus:outline-none';

const TO_HIT_PATTERN = /^[+-]?\d+$/;
const DAMAGE_PATTERN = /^\d+d\d+(\s*[+-]\s*\d+)?$/;

interface AttackQuickFieldsProps {
  title: string;
  plainText: string;
  onTextChange: (text: string) => void;
}

/**
 * Small structured to-hit/damage editor rendered above the freeform textarea
 * when the entry's plain text contains an attack roll and/or damage dice
 * expression. Inputs are uncontrolled and keyed off the parsed value so an
 * external edit (e.g. undo, or another field committing) reseeds them, but a
 * commit only happens on blur — committing per keystroke would remount the
 * input via its key and drop focus mid-typing.
 */
function AttackQuickFields({
  title,
  plainText,
  onTextChange,
}: AttackQuickFieldsProps) {
  const { toHit, damage } = parseAttackTokens(plainText);

  if (toHit === null && damage === null) {
    return null;
  }

  const handleToHitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (toHit === null) return;

    if (!TO_HIT_PATTERN.test(raw)) {
      e.target.value = toHit;
      return;
    }

    const normalized =
      raw.startsWith('+') || raw.startsWith('-') ? raw : `+${raw}`;
    if (normalized !== toHit) {
      onTextChange(replaceToHit(plainText, normalized));
    } else {
      e.target.value = toHit;
    }
  };

  const handleDamageBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (damage === null) return;

    if (!DAMAGE_PATTERN.test(raw)) {
      e.target.value = damage;
      return;
    }

    if (raw !== damage) {
      onTextChange(replaceDamage(plainText, raw));
    } else {
      e.target.value = damage;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {toHit !== null && (
        <input
          key={toHit}
          aria-label={`${title} entry to hit`}
          defaultValue={toHit}
          onBlur={handleToHitBlur}
          placeholder="+0"
          className={`${FIELD_BASE} w-20 shrink-0`}
        />
      )}
      {damage !== null && (
        <input
          key={damage}
          aria-label={`${title} entry damage`}
          defaultValue={damage}
          onBlur={handleDamageBlur}
          placeholder="1d6"
          className={`${FIELD_BASE} min-w-0 flex-1`}
        />
      )}
    </div>
  );
}

/**
 * Editable list of stat-block entries (traits / actions / bonus actions /
 * reactions). Entry text may contain legacy badge-span HTML from bestiary
 * data; it is round-tripped to plain text for editing (via
 * `statBlockHtmlToPlainText`) and re-badged for display elsewhere (via
 * `renderStatBlockEntryText`). Untouched entries keep their stored HTML —
 * conversion happens at display time until the first edit commits plain
 * text.
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
      {entries.map((entry, i) => {
        const plainText = statBlockHtmlToPlainText(entry.text);

        return (
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
                className={`${FIELD_BASE} min-w-0 flex-1 font-semibold`}
              />
              <NumberField
                aria-label={`${title} entry uses`}
                value={entry.uses}
                onChange={v => update(i, { uses: v })}
                allowEmpty
                min={0}
                placeholder="Uses"
                className={`${FIELD_BASE} w-20 shrink-0`}
              />
              <button
                aria-label="Delete entry"
                onClick={() => remove(i)}
                className="text-muted hover:text-accent-red-text shrink-0 p-1.5 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <AttackQuickFields
              title={title}
              plainText={plainText}
              onTextChange={text => update(i, { text })}
            />
            <textarea
              aria-label={`${title} entry text`}
              value={plainText}
              onChange={e => update(i, { text: e.target.value })}
              placeholder="Description"
              rows={3}
              className={`${FIELD_BASE} w-full resize-y`}
            />
          </div>
        );
      })}
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
