'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import type { FeatureRowView } from '../SheetDrawer.types';
import { buildFeatureGroups } from '../SheetTabs.utils';

const SECTION_CLASS = 'border-divider bg-surface rounded-xl border p-3';

function FeaturePips({
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
    <div className="mt-2 flex flex-wrap gap-1.5">
      {Array.from({ length: feature.maxUses }, (_, index) =>
        index < remaining ? (
          <button
            key={index}
            type="button"
            aria-label={`Use ${feature.name}`}
            onClick={onSpend}
            className="bg-accent-emerald-text-muted border-accent-emerald-border h-3 w-3 rounded-full border"
          />
        ) : (
          <button
            key={index}
            type="button"
            aria-label={`Restore ${feature.name}`}
            onClick={onRestore}
            className="border-divider h-3 w-3 rounded-full border"
          />
        )
      )}
    </div>
  );
}

export function FeaturesTab() {
  const character = useCharacterStore(s => s.character);
  const expendFeature = useCharacterStore(s => s.useExtendedFeature);
  const updateExtendedFeature = useCharacterStore(s => s.updateExtendedFeature);
  const expendTrait = useCharacterStore(s => s.useTrackableTrait);
  const updateTrackableTrait = useCharacterStore(s => s.updateTrackableTrait);

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
          <h3 className="text-faint mb-2 text-xs font-bold uppercase">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.features.map(feature => {
              const isOpen = expanded === feature.id;
              const descId = `feature-desc-${feature.id}`;
              return (
                <div
                  key={feature.id}
                  className="border-divider rounded-lg border p-2"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={descId}
                    onClick={() => setExpanded(isOpen ? null : feature.id)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="text-heading text-sm font-semibold">
                      {feature.name}
                    </span>
                    {feature.tag && (
                      <Badge variant="neutral">{feature.tag}</Badge>
                    )}
                  </button>

                  {feature.maxUses > 0 && (
                    <FeaturePips
                      feature={feature}
                      onSpend={() =>
                        feature.kind === 'extended'
                          ? expendFeature(feature.id)
                          : expendTrait(feature.id)
                      }
                      onRestore={() =>
                        feature.kind === 'extended'
                          ? updateExtendedFeature(feature.id, {
                              usedUses: feature.usedUses - 1,
                            })
                          : updateTrackableTrait(feature.id, {
                              usedUses: feature.usedUses - 1,
                            })
                      }
                    />
                  )}

                  {isOpen && (
                    <div id={descId} className="text-body mt-2 text-sm">
                      {feature.description ? (
                        <div
                          className="prose-sm"
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
