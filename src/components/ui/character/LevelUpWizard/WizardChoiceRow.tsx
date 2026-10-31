'use client';

import { RadioGroupItem } from '@/components/ui/forms/radio-group';

interface WizardChoiceRowProps {
  value: string;
  title: string;
  description?: string;
  meta?: string;
}

export function WizardChoiceRow({
  value,
  title,
  description,
  meta,
}: WizardChoiceRowProps) {
  return (
    <RadioGroupItem
      value={value}
      label={title}
      description={[description, meta].filter(Boolean).join(' · ') || undefined}
      wrapperClassName="border-divider border-b px-3 py-3"
    />
  );
}
