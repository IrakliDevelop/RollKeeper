'use client';

import type * as React from 'react';
import { AnchoredEditor } from '@/components/ui/forms/AnchoredEditor';
import { calculateModifier, formatModifier } from '@/utils/calculations';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';

export interface AbilityScoreEditorProps {
  ability: AbilityName;
  score: number;
  /** Edit mode; without `onScoreChange` the trigger stays as it is. */
  editing: boolean;
  onScoreChange?: (score: number) => void;
  /** The trigger: a button in edit mode (see `AnchoredEditor`). */
  children: React.ReactElement;
}

function modifierPreview(draft: number | undefined) {
  if (draft === undefined) return null;
  return (
    <p className="type-small text-muted">
      Modifier {formatModifier(calculateModifier(draft))}
    </p>
  );
}

const noop = () => {};

/**
 * The ability score editor the medallion and the ledger row share: "Strength
 * score", 1–30, with the modifier for the number being typed.
 */
export function AbilityScoreEditor({
  ability,
  score,
  editing,
  onScoreChange,
  children,
}: AbilityScoreEditorProps) {
  return (
    <AnchoredEditor
      label={`${ABILITY_NAMES[ability]} score`}
      value={score}
      min={1}
      max={30}
      editing={editing && onScoreChange !== undefined}
      onSave={onScoreChange ?? noop}
      context={modifierPreview}
    >
      {children}
    </AnchoredEditor>
  );
}
