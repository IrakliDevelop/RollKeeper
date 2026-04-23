'use client';

import { BookOpen } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ProcessedClass } from '@/types/classes';

interface EditionPickerStepProps {
  editionOptions: ProcessedClass[];
  selectedEdition: string | undefined;
  onSelect: (source: string) => void;
}

const EDITION_INFO: Record<string, { label: string; description: string }> = {
  PHB: {
    label: '2014 Rules (PHB)',
    description: "Original Player's Handbook — classic 5th Edition rules",
  },
  PHB2024: {
    label: '2024 Rules (PHB 2024)',
    description: "Revised Player's Handbook — updated 5.5e rules",
  },
};

function getEditionKey(source: string): string {
  const upper = source.toUpperCase();
  if (upper === 'PHB2024' || upper === 'XPHB') return 'PHB2024';
  return 'PHB';
}

function getSourceValue(source: string): string {
  const upper = source.toUpperCase();
  if (upper === 'PHB2024') return 'XPHB';
  return upper;
}

export default function EditionPickerStep({
  editionOptions,
  selectedEdition,
  onSelect,
}: EditionPickerStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">
          Which edition are you playing?
        </h3>
        <p className="text-muted mt-1 text-sm">
          This determines which class features and subclasses are available.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {editionOptions.map(option => {
          const key = getEditionKey(option.source);
          const info = EDITION_INFO[key] || {
            label: option.source,
            description: '',
          };
          const sourceValue = getSourceValue(option.source);
          const isSelected = selectedEdition === sourceValue;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(sourceValue)}
              className={cn(
                'rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-accent-blue-border bg-accent-blue-bg'
                  : 'border-divider bg-surface-raised hover:bg-surface-secondary'
              )}
            >
              <div className="flex items-start gap-3">
                <BookOpen
                  size={20}
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    isSelected ? 'text-accent-blue-text' : 'text-muted'
                  )}
                />
                <div>
                  <p
                    className={cn(
                      'font-semibold',
                      isSelected ? 'text-accent-blue-text' : 'text-heading'
                    )}
                  >
                    {info.label}
                  </p>
                  <p className="text-muted mt-1 text-xs">{info.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
