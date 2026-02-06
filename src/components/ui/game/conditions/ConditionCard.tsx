'use client';

import React from 'react';
import { ActiveCondition } from '@/types/character';
import {
  AlertTriangle,
  Eye,
  Minus,
  Plus,
  X,
  Calendar,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';

interface ConditionCardProps {
  condition: ActiveCondition;
  onView: (condition: ActiveCondition) => void;
  onRemove: (id: string) => void;
  onUpdateCount: (id: string, count: number) => void;
}

export function ConditionCard({
  condition,
  onView,
  onRemove,
  onUpdateCount,
}: ConditionCardProps) {
  const fullSourceName =
    SPELL_SOURCE_BOOKS[condition.source] || condition.source;

  return (
    <div className="group border-accent-red-border bg-surface-raised hover:border-accent-red-border-strong rounded-lg border-2 p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <AlertTriangle className="text-accent-red-text-muted h-4 w-4 shrink-0" />
            <h4 className="text-heading truncate font-bold">
              {condition.name}
            </h4>
            {condition.stackable && condition.count > 1 && (
              <Badge variant="danger" size="sm">
                Level {condition.count}
              </Badge>
            )}
            {condition.notes && (
              <Badge variant="info" size="sm" leftIcon={<FileText size={12} />}>
                Notes
              </Badge>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-1 text-sm">
            <div className="text-muted flex items-center gap-2">
              <span className="text-body font-medium">{fullSourceName}</span>
            </div>
            <div className="text-muted flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">
                Applied: {new Date(condition.appliedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1">
          {/* Stackable controls */}
          {condition.stackable && (
            <div className="border-divider bg-surface-secondary flex items-center gap-1 rounded-lg border-2 p-1">
              <Button
                onClick={() =>
                  onUpdateCount(condition.id, Math.max(1, condition.count - 1))
                }
                variant="ghost"
                size="xs"
                disabled={condition.count <= 1}
                title="Decrease level"
                className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text h-6 w-6 p-0 disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-heading min-w-[1.5rem] text-center text-sm font-bold">
                {condition.count}
              </span>
              <Button
                onClick={() =>
                  onUpdateCount(condition.id, Math.min(6, condition.count + 1))
                }
                variant="ghost"
                size="xs"
                disabled={condition.count >= 6}
                title="Increase level"
                className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text h-6 w-6 p-0 disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* View details */}
          <Button
            onClick={() => onView(condition)}
            variant="ghost"
            size="xs"
            title="View details"
            className="text-accent-blue-text-muted hover:bg-surface-hover hover:text-accent-blue-text h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Remove */}
          <Button
            onClick={() => onRemove(condition.id)}
            variant="ghost"
            size="xs"
            title="Remove condition"
            className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
