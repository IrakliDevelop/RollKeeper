'use client';

import { useMemo, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';
import { Section } from '@/components/ui/layout/section';
import { cn } from '@/utils/cn';

import { buildFeatureGroups } from '../SheetTabs.utils';
import { FavoriteStar } from './FavoriteStar';
import { useFeatureUses } from './useFeatureUses';

import type { FeatureRowView } from '../SheetDrawer.types';

const PIP_BUTTON_CLASS =
  'focus-visible:outline-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11';

/** Use/restore pips for a feature's remaining uses, shared with the Overview tab's pinned favorites. */
export function FeaturePips({
  feature,
  onSpend,
  onRestore,
}: {
  feature: FeatureRowView;
  onSpend: () => void;
  onRestore: () => void;
}) {
  const remaining = feature.maxUses - feature.usedUses;
  return (
    <div
      role="group"
      aria-label={`${feature.name} uses: ${remaining} of ${feature.maxUses}`}
      className="mt-1 flex flex-wrap"
    >
      {Array.from({ length: feature.maxUses }, (_, index) =>
        index < remaining ? (
          <button
            key={index}
            type="button"
            aria-label={`Use ${feature.name}`}
            onClick={onSpend}
            className={PIP_BUTTON_CLASS}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-3 rounded-full border',
                CLASS_RESOURCE_STYLE.pipOn
              )}
            />
          </button>
        ) : (
          <button
            key={index}
            type="button"
            aria-label={`Restore ${feature.name}`}
            onClick={onRestore}
            className={PIP_BUTTON_CLASS}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-3 rounded-full border',
                CLASS_RESOURCE_STYLE.pipOff
              )}
            />
          </button>
        )
      )}
    </div>
  );
}

export function FeaturesTab() {
  const character = useCharacterStore(s => s.character);
  const { spend, restore } = useFeatureUses();

  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => buildFeatureGroups(character), [character]);

  if (groups.length === 0) {
    return (
      <p className="type-body text-muted py-6 text-center">
        No features yet. Add features on the full character sheet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <Section key={group.key} level={4} heading={group.label}>
          <ul className="divide-divider divide-y">
            {group.features.map(feature => {
              const isOpen = expanded === feature.id;
              const descId = `feature-desc-${feature.id}`;
              return (
                <li key={feature.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={descId}
                      onClick={() => setExpanded(isOpen ? null : feature.id)}
                      className="focus-visible:outline-ring flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className={cn('shrink-0', !isOpen && '-rotate-90')}
                      />
                      <span className="type-ui text-heading">
                        {feature.name}
                      </span>
                      {feature.tag && (
                        <Badge variant="neutral">{feature.tag}</Badge>
                      )}
                    </button>
                    {/* Legacy trackable traits aren't shown by the full sheet's
                        QuickFeatures, so pinning one would create a phantom. */}
                    {feature.kind !== 'trait' && (
                      <FavoriteStar
                        kind="feature"
                        id={feature.id}
                        name={feature.name}
                      />
                    )}
                  </div>

                  {feature.maxUses > 0 && (
                    <FeaturePips
                      feature={feature}
                      onSpend={() => spend(feature)}
                      onRestore={() => restore(feature)}
                    />
                  )}

                  {isOpen && (
                    <div id={descId} className="mt-2">
                      {feature.description ? (
                        <div
                          className="prose prose-sm text-body max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: feature.description,
                          }}
                        />
                      ) : (
                        <span className="type-small text-muted">
                          No description.
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </div>
  );
}
