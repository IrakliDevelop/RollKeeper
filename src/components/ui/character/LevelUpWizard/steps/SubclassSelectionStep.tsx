'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ProcessedSubclass } from '@/types/classes';

interface SubclassSelectionStepProps {
  className: string;
  subclasses: ProcessedSubclass[];
  selectedSubclass: ProcessedSubclass | undefined;
  onSelect: (subclass: ProcessedSubclass) => void;
}

export default function SubclassSelectionStep({
  className,
  subclasses,
  selectedSubclass,
  onSelect,
}: SubclassSelectionStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">
          Choose your {className} subclass
        </h3>
        <p className="text-muted mt-1 text-sm">
          This choice shapes your character for the rest of the game.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subclasses.map(sc => {
          const isSelected = selectedSubclass?.id === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelect(sc)}
              className={cn(
                'rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-accent-purple-border bg-accent-purple-bg'
                  : 'border-divider bg-surface-raised hover:bg-surface-secondary'
              )}
            >
              <div className="flex items-start gap-3">
                <Sparkles
                  size={18}
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    isSelected ? 'text-accent-purple-text' : 'text-muted'
                  )}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'font-semibold',
                      isSelected ? 'text-accent-purple-text' : 'text-heading'
                    )}
                  >
                    {sc.name}
                  </p>
                  <p className="text-faint mt-0.5 text-xs">{sc.source}</p>
                  {sc.description && (
                    <p className="text-muted mt-2 line-clamp-3 text-xs">
                      {sc.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
