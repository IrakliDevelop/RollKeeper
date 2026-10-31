'use client';

import { Eye, Minus, Plus, X } from 'lucide-react';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import {
  CONDITION_ICON_REGISTRY,
  isConditionIconName,
} from '@/utils/conditionIconRegistry';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import type { ActiveCondition } from '@/types/character';

interface ConditionCardProps {
  condition: ActiveCondition;
  onView: (condition: ActiveCondition) => void;
  onRemove: (id: string) => void;
  onUpdateCount: (id: string, count: number) => void;
}

/** A condition row; the saved name and source are never truncated. */
export function ConditionCard({
  condition,
  onView,
  onRemove,
  onUpdateCount,
}: ConditionCardProps) {
  const isBuff = condition.kind === 'buff';
  const SourceIcon = isConditionIconName(condition.icon)
    ? CONDITION_ICON_REGISTRY[condition.icon]
    : null;
  const source = SPELL_SOURCE_BOOKS[condition.source] || condition.source;

  return (
    <div
      role="listitem"
      data-effect-row={condition.id}
      className="border-divider flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b py-3 pointer-coarse:min-h-11"
    >
      <div className="min-w-0 flex-[1_1_12rem]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {SourceIcon && (
            <SourceIcon
              aria-hidden="true"
              className="text-muted size-4 shrink-0"
            />
          )}
          {isBuff ? (
            <Badge
              variant="neutral"
              size="sm"
              className="max-w-full break-words"
            >
              {condition.name}
            </Badge>
          ) : (
            <ConditionChip name={condition.name} />
          )}
          {condition.stackable && condition.count > 1 && (
            <Badge variant="neutral" size="sm">
              Level {condition.count}
            </Badge>
          )}
          {condition.notes && (
            <Badge variant="neutral" size="sm">
              Notes
            </Badge>
          )}
        </div>
        <p className="type-small text-muted mt-1 break-words">
          {source} · Applied{' '}
          {new Date(condition.appliedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {condition.stackable && (
          <div
            role="group"
            aria-label={`${condition.name} level`}
            className="flex items-center"
          >
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Lower ${condition.name} level`}
              disabled={condition.count <= 1}
              onClick={() =>
                onUpdateCount(condition.id, Math.max(1, condition.count - 1))
              }
              className="min-w-6 px-2 pointer-coarse:min-w-11"
            >
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <span className="type-ui text-heading min-w-6 text-center tabular-nums">
              {condition.count}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Raise ${condition.name} level`}
              disabled={condition.count >= 6}
              onClick={() =>
                onUpdateCount(condition.id, Math.min(6, condition.count + 1))
              }
              className="min-w-6 px-2 pointer-coarse:min-w-11"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          data-effect-action="details"
          aria-label={`Show ${condition.name} details`}
          onClick={() => onView(condition)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <Eye aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={`Remove ${condition.name}`}
          onClick={() => onRemove(condition.id)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
