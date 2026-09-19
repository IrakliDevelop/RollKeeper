'use client';

import { ConditionIconPicker } from '@/components/ui/forms/ConditionIconPicker';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Textarea } from '@/components/ui/forms/textarea';
import { DEFAULT_CONDITION_ICON_BY_KIND } from '@/utils/conditionIconRegistry';
import {
  CUSTOM_CONDITION_DESCRIPTION_MAX,
  CUSTOM_CONDITION_NAME_MAX,
  type CustomConditionDraft,
} from '@/utils/customConditions';

import type { CustomCondition } from '@/types/encounter';

export interface CustomConditionFieldsProps {
  value: CustomConditionDraft;
  onChange: (patch: Partial<CustomConditionDraft>) => void;
}

/** Controlled name / description / icon / kind fields for one condition. */
export function CustomConditionFields({
  value,
  onChange,
}: CustomConditionFieldsProps) {
  const handleKindChange = (next: string) => {
    const kind = next as CustomCondition['kind'];
    // Follow the kind with the icon only while the DM has not chosen one.
    const iconUntouched =
      value.icon === DEFAULT_CONDITION_ICON_BY_KIND[value.kind];
    onChange(
      iconUntouched
        ? { kind, icon: DEFAULT_CONDITION_ICON_BY_KIND[kind] }
        : { kind }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ConditionIconPicker
          value={value.icon}
          onChange={icon => onChange({ icon })}
        />
        <Input
          value={value.name}
          onChange={e => onChange({ name: e.target.value })}
          aria-label="Condition name"
          placeholder="Condition name"
          maxLength={CUSTOM_CONDITION_NAME_MAX}
          wrapperClassName="flex-1"
        />
        <SelectField
          value={value.kind}
          onValueChange={handleKindChange}
          triggerProps={{ 'aria-label': 'Condition kind' }}
          wrapperClassName="w-32 shrink-0"
        >
          <SelectItem value="debuff">Debuff</SelectItem>
          <SelectItem value="buff">Buff</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
        </SelectField>
      </div>
      <Textarea
        value={value.description}
        onChange={e => onChange({ description: e.target.value })}
        aria-label="Condition description"
        placeholder="What it does — players read this on hover."
        maxLength={CUSTOM_CONDITION_DESCRIPTION_MAX}
        size="sm"
      />
    </div>
  );
}
