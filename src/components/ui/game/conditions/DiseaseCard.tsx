'use client';

import React from 'react';
import { ActiveDisease } from '@/types/character';
import { Shield, Eye, X, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';

interface DiseaseCardProps {
  disease: ActiveDisease;
  onView: (disease: ActiveDisease) => void;
  onRemove: (id: string) => void;
}

export function DiseaseCard({ disease, onView, onRemove }: DiseaseCardProps) {
  const fullSourceName = SPELL_SOURCE_BOOKS[disease.source] || disease.source;

  return (
    <div className="group border-accent-purple-border bg-surface-raised hover:border-accent-purple-border-strong rounded-lg border-2 p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Shield className="text-accent-purple-text-muted h-4 w-4 shrink-0" />
            <h4 className="text-heading truncate font-bold">{disease.name}</h4>
            {disease.notes && (
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
                Applied: {new Date(disease.appliedAt).toLocaleDateString()}
              </span>
            </div>
            {disease.onsetTime && (
              <div className="text-muted flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">
                  Onset: {new Date(disease.onsetTime).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1">
          {/* View details */}
          <Button
            onClick={() => onView(disease)}
            variant="ghost"
            size="xs"
            title="View details"
            className="text-accent-blue-text-muted hover:bg-surface-hover hover:text-accent-blue-text h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Remove */}
          <Button
            onClick={() => onRemove(disease.id)}
            variant="ghost"
            size="xs"
            title="Remove disease"
            className="text-accent-purple-text-muted hover:bg-accent-purple-bg hover:text-accent-purple-text h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
