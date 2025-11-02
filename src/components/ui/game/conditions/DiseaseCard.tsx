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
    <div className="group rounded-lg border-2 border-purple-200 bg-white p-4 transition-all hover:shadow-md hover:border-purple-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <Shield className="h-4 w-4 shrink-0 text-purple-600" />
            <h4 className="font-bold text-gray-800 truncate">{disease.name}</h4>
            {disease.notes && (
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
                Applied: {new Date(disease.appliedAt).toLocaleDateString()}
              </span>
            </div>
            {disease.onsetTime && (
              <div className="flex items-center gap-1.5 text-gray-500">
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
            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Remove */}
          <Button
            onClick={() => onRemove(disease.id)}
            variant="ghost"
            size="xs"
            title="Remove disease"
            className="h-8 w-8 p-0 text-purple-600 hover:bg-purple-100 hover:text-purple-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

