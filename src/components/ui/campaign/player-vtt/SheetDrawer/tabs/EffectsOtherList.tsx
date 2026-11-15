'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import type { OtherEffectsView } from '../SheetDrawer.types';

export interface EffectsOtherListProps {
  effects: OtherEffectsView;
  onRemove: (id: string) => void;
}

/** Buffs, custom/DM-library conditions and diseases not covered by the toggles. */
export function EffectsOtherList({ effects, onRemove }: EffectsOtherListProps) {
  const { conditions, diseases } = effects;
  if (conditions.length === 0 && diseases.length === 0) return null;

  return (
    <Section heading="Other active effects" level={4}>
      {conditions.length > 0 && (
        <ul className="divide-divider divide-y">
          {conditions.map(effect => (
            <li key={effect.id} className="flex items-center gap-2 py-1.5">
              <span className="type-ui text-heading">{effect.name}</span>
              <Badge variant="neutral">{effect.kind}</Badge>
              {effect.count > 1 && (
                <span className="type-small text-muted">×{effect.count}</span>
              )}
              <span className="type-caption text-muted flex-1 truncate">
                {effect.source}
              </span>
              <Tooltip content={`Remove ${effect.name}`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-9 px-0"
                  aria-label={`Remove ${effect.name}`}
                  onClick={() => onRemove(effect.id)}
                >
                  <X size={16} aria-hidden />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      {diseases.length > 0 && (
        <div className={conditions.length > 0 ? 'mt-3' : undefined}>
          <h5 className="type-small text-muted mb-1">Diseases</h5>
          <ul className="divide-divider divide-y">
            {diseases.map(disease => (
              <li key={disease.id} className="flex items-center gap-2 py-1.5">
                <span className="type-ui text-heading">{disease.name}</span>
                <span className="type-caption text-muted truncate">
                  {disease.source}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
