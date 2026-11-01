'use client';

import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import type { ActiveDisease } from '@/types/character';

interface DiseaseCardProps {
  disease: ActiveDisease;
  onView: (disease: ActiveDisease) => void;
  onRemove: (id: string) => void;
}

/** A disease row with full metadata and separate details/remove controls. */
export function DiseaseCard({ disease, onView, onRemove }: DiseaseCardProps) {
  const source = SPELL_SOURCE_BOOKS[disease.source] || disease.source;
  return (
    <div
      role="listitem"
      data-effect-row={disease.id}
      className="border-divider flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b py-3 pointer-coarse:min-h-11"
    >
      <div className="min-w-0 flex-[1_1_12rem]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-ui text-heading font-semibold break-words">
            {disease.name}
          </span>
          {disease.notes && (
            <Badge variant="neutral" size="sm">
              Notes
            </Badge>
          )}
        </div>
        <p className="type-small text-muted mt-1 break-words">
          {source} · Applied {new Date(disease.appliedAt).toLocaleDateString()}
        </p>
        {disease.onsetTime && (
          <p className="type-small text-muted mt-1">
            Onset {new Date(disease.onsetTime).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          data-effect-action="details"
          aria-label={`Show ${disease.name} details`}
          onClick={() => onView(disease)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <Eye aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          aria-label={`Remove ${disease.name}`}
          onClick={() => onRemove(disease.id)}
          className="min-w-6 px-2 pointer-coarse:min-w-11"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
