'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Textarea } from '@/components/ui/forms/textarea';
import { Section } from '@/components/ui/layout/section';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';
import {
  parseAttackTokens,
  replaceDamage,
  replaceToHit,
  statBlockHtmlToPlainText,
} from '@/utils/statBlockText';
import type { StatBlockEntry } from '@/types/encounter';

export type { StatBlockEntry };

interface StatBlockEntriesEditorProps {
  title: string;
  entries: StatBlockEntry[];
  onChange: (entries: StatBlockEntry[]) => void;
}

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
        <Input
          key={toHit}
          size="sm"
          aria-label={`${title} entry to hit`}
          defaultValue={toHit}
          onBlur={handleToHitBlur}
          placeholder="+0"
          wrapperClassName="w-20 shrink-0"
        />
      )}
      {damage !== null && (
        <Input
          key={damage}
          size="sm"
          aria-label={`${title} entry damage`}
          defaultValue={damage}
          onBlur={handleDamageBlur}
          placeholder="1d6"
          wrapperClassName="min-w-0 flex-1"
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
    <TooltipProvider>
      <Section heading={title} level={4} contentClassName="space-y-2">
        <ul className="divide-divider divide-y">
          {entries.map((entry, i) => {
            const plainText = statBlockHtmlToPlainText(entry.text);
            const trimmedName = entry.name.trim();
            const deleteLabel = trimmedName
              ? `Delete ${trimmedName}`
              : `Delete unnamed ${title} entry`;

            return (
              // `id` is optional and unset on rows added here until the store
              // normalises them; keying by it would remount a row mid-edit, so
              // the index is the key.
              <li key={i} className="space-y-2 py-3">
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    aria-label={`${title} entry name`}
                    value={entry.name}
                    onChange={e => update(i, { name: e.target.value })}
                    placeholder="Name"
                    wrapperClassName="min-w-0 flex-1"
                  />
                  <NumberInput
                    size="sm"
                    aria-label={`${title} entry uses`}
                    value={entry.uses}
                    onChange={v => update(i, { uses: v })}
                    allowEmpty
                    min={0}
                    placeholder="Uses"
                    wrapperClassName="w-20 shrink-0"
                  />
                  <Tooltip content={deleteLabel}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-9 shrink-0 px-0"
                      aria-label={deleteLabel}
                      onClick={() => remove(i)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  </Tooltip>
                </div>
                <AttackQuickFields
                  title={title}
                  plainText={plainText}
                  onTextChange={text => update(i, { text })}
                />
                <Textarea
                  aria-label={`${title} entry text`}
                  value={plainText}
                  onChange={e => update(i, { text: e.target.value })}
                  placeholder="Description"
                  rows={3}
                />
              </li>
            );
          })}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...entries, { name: '', text: '' }])}
          leftIcon={<Plus size={14} />}
        >
          Add {title} entry
        </Button>
      </Section>
    </TooltipProvider>
  );
}
