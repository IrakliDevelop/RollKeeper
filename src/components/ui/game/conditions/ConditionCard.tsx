'use client';

import React from 'react';
import { ActiveCondition } from '@/types/character';
import { AlertTriangle, Eye, Minus, Plus, X, Calendar, FileText } from 'lucide-react';
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
    <div className="group rounded-lg border-2 border-red-200 bg-white p-4 transition-all hover:shadow-md hover:border-red-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <h4 className="font-bold text-gray-800 truncate">
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
            <div className="flex items-center gap-2 text-gray-600">
              <span className="font-medium text-gray-700">{fullSourceName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
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
            <div className="flex items-center gap-1 rounded-lg border-2 border-gray-200 bg-gray-50 p-1">
              <Button
                onClick={() =>
                  onUpdateCount(condition.id, Math.max(1, condition.count - 1))
                }
                variant="ghost"
                size="xs"
                disabled={condition.count <= 1}
                title="Decrease level"
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-100 hover:text-red-800 disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[1.5rem] text-center text-sm font-bold text-gray-800">
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
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-100 hover:text-red-800 disabled:opacity-30"
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
            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Remove */}
          <Button
            onClick={() => onRemove(condition.id)}
            variant="ghost"
            size="xs"
            title="Remove condition"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-100 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

