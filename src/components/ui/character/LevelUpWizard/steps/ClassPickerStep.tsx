'use client';

import type { MulticlassInfo } from '@/types/character';
import { WizardChoiceRow } from '../WizardChoiceRow';
import { RadioGroup } from '@/components/ui/forms/radio-group';

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
      <div>
        <h3
          id="level-up-class-heading"
          className="type-subheading text-heading"
        >
          Choose the class that gains a level
        </h3>
      </div>
      <RadioGroup
        value={selectedIndex >= 0 ? String(selectedIndex) : undefined}
        onValueChange={value => onSelect(Number(value))}
        aria-labelledby="level-up-class-heading"
        className="border-divider gap-0 border-t"
      >
        {classes.map((cls, index) => (
          <WizardChoiceRow
            key={cls.className}
            value={String(index)}
            title={cls.className}
            description={cls.subclass || undefined}
            meta={`Level ${cls.level} → ${cls.level + 1}`}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
