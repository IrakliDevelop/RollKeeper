'use client';

import type { Ref } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { effectSummary } from '@/components/ui/encounter/combat-screen/detail/effectSummary';
import { CONDITION_ICON_REGISTRY } from '@/utils/conditionIconRegistry';
import type { CustomCondition } from '@/types/encounter';

const KIND_LABELS: Record<CustomCondition['kind'], string> = {
  buff: 'Buff',
  debuff: 'Debuff',
  neutral: 'Neutral',
};

interface NpcInflictsRowProps {
  condition: CustomCondition;
  /** Ref to the Remove button, so the editor can move focus to it. */
  removeRef: Ref<HTMLButtonElement>;
  onRemove: () => void;
}

export function NpcInflictsRow({
  condition,
  removeRef,
  onRemove,
}: NpcInflictsRowProps) {
  const Icon = CONDITION_ICON_REGISTRY[condition.icon];
  const summary = effectSummary(condition.description ?? '');
  return (
    <li className="flex items-start gap-2 py-2 pointer-coarse:min-h-11">
      <Icon size={16} aria-hidden className="text-muted mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="type-ui text-heading">{condition.name}</p>
        {summary && (
          <p className="type-small text-muted line-clamp-2">{summary}</p>
        )}
      </div>
      <Badge variant="neutral" size="sm">
        {condition.origin === 'official'
          ? condition.rulesSource || 'Official'
          : KIND_LABELS[condition.kind]}
      </Badge>
      <Button
        ref={removeRef}
        variant="danger"
        size="sm"
        className="px-2"
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${condition.name}`}
      >
        <Trash2 size={16} aria-hidden />
      </Button>
    </li>
  );
}
