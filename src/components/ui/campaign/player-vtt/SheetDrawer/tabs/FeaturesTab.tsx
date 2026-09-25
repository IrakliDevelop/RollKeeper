'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';
import { buildFeatureGroups } from '../SheetTabs.utils';
import { FavoriteStar } from './FavoriteStar';
import { useFeatureUses } from './useFeatureUses';

import type { FeatureRowView } from '../SheetDrawer.types';

const PIP_BUTTON_CLASS = 'inline-flex h-6 w-6 items-center justify-center';

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
            <span className="bg-accent-emerald-text-muted border-accent-emerald-border h-3 w-3 rounded-full border" />
          </button>
        ) : (
          <button
            key={index}
            type="button"
            aria-label={`Restore ${feature.name}`}
            onClick={onRestore}
            className={PIP_BUTTON_CLASS}
          >
            <span className="border-divider h-3 w-3 rounded-full border" />
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
      <div className={cn(SECTION_CLASS, 'text-muted text-sm')}>
        No features yet. Add features on the full character sheet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.key} className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>{group.label}</h3>
          <div className="space-y-2">
            {group.features.map(feature => {
              const isOpen = expanded === feature.id;
              const descId = `feature-desc-${feature.id}`;
              return (
                <div
                  key={feature.id}
                  className="border-divider rounded-lg border p-2"
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={descId}
                      onClick={() => setExpanded(isOpen ? null : feature.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="text-heading text-sm font-semibold">
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
                    <div id={descId} className="text-body mt-2 text-sm">
                      {feature.description ? (
                        <div
                          className="prose prose-sm text-body max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: feature.description,
                          }}
                        />
                      ) : (
                        <span className="text-muted">No description.</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
