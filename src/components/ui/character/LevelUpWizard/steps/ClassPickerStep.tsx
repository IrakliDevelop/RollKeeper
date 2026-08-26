'use client';

import { Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { MulticlassInfo } from '@/types/character';

interface ClassPickerStepProps {
  classes: MulticlassInfo[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function ClassPickerStep({
  classes,
  selectedIndex,
  onSelect,
}: ClassPickerStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-heading text-lg font-semibold">
          Which class gains a level?
        </h3>
        <p className="text-muted mt-1 text-sm">
          Select the class you want to advance.
        </p>
      </div>

      <div className="space-y-2">
        {classes.map((cls, index) => {
          const isSelected = selectedIndex === index;
          return (
            <button
              key={cls.className + index}
              onClick={() => onSelect(index)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-accent-blue-border bg-accent-blue-bg'
                  : 'border-divider bg-surface-raised hover:bg-surface-secondary'
              )}
            >
              <Shield
                size={20}
                className={cn(
                  'flex-shrink-0',
                  isSelected ? 'text-accent-blue-text' : 'text-muted'
                )}
              />
              <div className="flex-1">
                <span
                  className={cn(
                    'font-semibold',
                    isSelected ? 'text-accent-blue-text' : 'text-heading'
                  )}
                >
                  {cls.className}
                </span>
                {cls.subclass && (
                  <span className="text-muted ml-1 text-sm">
                    ({cls.subclass})
                  </span>
                )}
              </div>
              <div className="text-muted text-sm">
                Level {cls.level} → {cls.level + 1}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
