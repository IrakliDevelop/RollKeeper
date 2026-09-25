'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

import type {
  OtherConditionView,
  OtherEffectsView,
} from '../SheetDrawer.types';

import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';

export interface EffectsOtherListProps {
  effects: OtherEffectsView;
  onRemove: (id: string) => void;
}

const KIND_VARIANT: Record<
  OtherConditionView['kind'],
  'success' | 'danger' | 'neutral'
> = {
  buff: 'success',
  debuff: 'danger',
  neutral: 'neutral',
};

const HEADING_ID = 'sheet-other-effects-heading';

/** Buffs, custom/DM-library conditions and diseases not covered by the toggles. */
export function EffectsOtherList({ effects, onRemove }: EffectsOtherListProps) {
  const { conditions, diseases } = effects;
  if (conditions.length === 0 && diseases.length === 0) return null;

  return (
    <section aria-labelledby={HEADING_ID} className={SECTION_CLASS}>
      <h3 id={HEADING_ID} className={HEADING_CLASS}>
        Other active effects
      </h3>
      {conditions.length > 0 && (
        <ul className="space-y-1.5">
          {conditions.map(effect => (
            <li key={effect.id} className="flex items-center gap-2 text-sm">
              <span className="text-heading font-semibold">{effect.name}</span>
              <Badge variant={KIND_VARIANT[effect.kind]}>{effect.kind}</Badge>
              {effect.count > 1 && (
                <span className="text-muted text-xs">×{effect.count}</span>
              )}
              <span className="text-faint flex-1 truncate text-xs">
                {effect.source}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${effect.name}`}
                onClick={() => onRemove(effect.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {diseases.length > 0 && (
        <div className={conditions.length > 0 ? 'mt-3' : undefined}>
          <h4 className="text-muted mb-1 text-xs font-semibold">Diseases</h4>
          <ul className="space-y-1">
            {diseases.map(disease => (
              <li key={disease.id} className="flex items-center gap-2 text-sm">
                <span className="text-heading font-semibold">
                  {disease.name}
                </span>
                <span className="text-faint truncate text-xs">
                  {disease.source}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
