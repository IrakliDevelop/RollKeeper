'use client';

import type { ProcessedClass } from '@/types/classes';
import { WizardChoiceRow } from '../WizardChoiceRow';
import { RadioGroup } from '@/components/ui/forms/radio-group';

interface EditionPickerStepProps {
  editionOptions: ProcessedClass[];
  selectedEdition: string | undefined;
  onSelect: (source: string) => void;
}

const EDITION_INFO: Record<string, { label: string; description: string }> = {
  PHB: {
    label: '2014 rules (PHB)',
    description: "Original Player's Handbook — classic 5th Edition rules",
  },
  PHB2024: {
    label: '2024 rules (PHB 2024)',
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
      <div>
        <h3 className="type-subheading text-heading">
          Choose your rules edition
        </h3>
        <p className="type-body text-muted mt-1">
          This determines which class features and subclasses are available.
        </p>
      </div>
      <RadioGroup
        value={selectedEdition}
        onValueChange={onSelect}
        aria-label="Edition"
        className="border-divider gap-0 border-t"
      >
        {editionOptions.map(option => {
          const info = EDITION_INFO[getEditionKey(option.source)] || {
            label: option.source,
            description: '',
          };
          const sourceValue = getSourceValue(option.source);
          return (
            <WizardChoiceRow
              key={option.id}
              value={sourceValue}
              title={info.label}
              description={info.description}
            />
          );
        })}
      </RadioGroup>
    </div>
  );
}
