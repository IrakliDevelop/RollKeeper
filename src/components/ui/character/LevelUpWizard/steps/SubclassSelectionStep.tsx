'use client';

import type { ProcessedSubclass } from '@/types/classes';
import { WizardChoiceRow } from '../WizardChoiceRow';
import { RadioGroup } from '@/components/ui/forms/radio-group';

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
      <h3 className="type-subheading text-heading">
        Choose your {className} subclass
      </h3>
      <RadioGroup
        value={selectedSubclass?.id}
        onValueChange={value => {
          const subclass = subclasses.find(item => item.id === value);
          if (subclass) onSelect(subclass);
        }}
        aria-label="Subclass"
        className="border-divider gap-0 border-t"
      >
        {subclasses.map(sc => (
          <WizardChoiceRow
            key={sc.id}
            value={sc.id}
            title={sc.name}
            description={sc.description}
            meta={sc.source}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
