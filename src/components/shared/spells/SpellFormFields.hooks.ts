import { useState } from 'react';

import { detectSpellAoe, aoeEquals } from '@/utils/spellAoeDetection';

import type { SpellFormData } from '@/utils/spellConversion';
import type { SpellAoe } from '@/types/spellAoe';

/**
 * Silent-until-touched AoE auto-fill.
 * While the user hasn't manually edited the AoE fields, description/range
 * changes re-run detection and keep the fields in sync. The first manual
 * edit locks them for the rest of the form session.
 */
export function useSpellAoeAutofill(
  formData: SpellFormData,
  onChange: (data: SpellFormData) => void
) {
  // Edit-clobber guard: if the stored AoE differs from what detection would
  // produce for the current text, the user set it deliberately — start locked.
  const [aoeTouched, setAoeTouched] = useState(
    () =>
      !aoeEquals(
        formData.aoe,
        detectSpellAoe(formData.description, formData.range)
      )
  );

  const setDescription = (description: string) => {
    const next = { ...formData, description };
    if (!aoeTouched) next.aoe = detectSpellAoe(description, formData.range);
    onChange(next);
  };

  const setRange = (range: string) => {
    const next = { ...formData, range };
    if (!aoeTouched) next.aoe = detectSpellAoe(formData.description, range);
    onChange(next);
  };

  const setAoe = (aoe: SpellAoe | null) => {
    setAoeTouched(true);
    onChange({ ...formData, aoe });
  };

  return { setDescription, setRange, setAoe };
}
