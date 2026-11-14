'use client';

import { useMemo } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { useCharacterStore } from '@/store/characterStore';

import { useDockSpellCasting } from '../../CharacterDock/DockSpells.hooks';
import { buildFavoriteRows } from '../SheetTabs.utils';
import type { SheetSpellCastingProps } from '../SheetDrawer.types';
import { FavoriteStar } from './FavoriteStar';
import { FeaturePips } from './FeaturesTab';
import { SpellsTabModals } from './SpellsTabModals';
import { useConsumableUse } from './useConsumableUse';
import { useFeatureUses } from './useFeatureUses';

export interface OverviewFavoritesProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  spellCasting: SheetSpellCastingProps;
}

/** Pinned items/spells/features, surfaced at the top of the Overview tab. */
export function OverviewFavorites({
  addToast,
  spellCasting,
}: OverviewFavoritesProps) {
  const character = useCharacterStore(s => s.character);
  const rows = useMemo(() => buildFavoriteRows(character), [character]);
  const consumeItem = useConsumableUse(addToast);
  const { spend: spendFeature, restore: restoreFeature } = useFeatureUses();

  const {
    castingSpell,
    viewingSpell,
    handleCastClick,
    handleModalCast,
    closeCastModal,
    closeDetailsModal,
  } = useDockSpellCasting({ addToast, ...spellCasting });

  return (
    <Section heading="Favorites" level={4}>
      {rows.length === 0 ? (
        <p className="type-body text-muted py-6 text-center">
          Nothing pinned. Tap the star on any item, spell or feature.
        </p>
      ) : (
        <ul className="divide-divider divide-y">
          {rows.map(row => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="type-ui text-heading truncate">{row.name}</div>
                <div className="type-small text-muted truncate">
                  {row.kind === 'item' && row.entry.consumable
                    ? `${row.meta} · ×${row.entry.quantity ?? 0}`
                    : row.meta}
                </div>

                {row.kind === 'spell' && !row.castable && (
                  <p className="type-caption text-muted">
                    Not prepared or no slots left
                  </p>
                )}

                {row.kind === 'item' && row.entry.attackText && (
                  <div className="type-small text-body mt-0.5">
                    {row.entry.attackText}
                  </div>
                )}

                {row.kind === 'feature' &&
                  (row.feature.maxUses > 0 ? (
                    <FeaturePips
                      feature={row.feature}
                      onSpend={() => spendFeature(row.feature)}
                      onRestore={() => restoreFeature(row.feature)}
                    />
                  ) : (
                    row.feature.tag && (
                      <Badge variant="neutral">{row.feature.tag}</Badge>
                    )
                  ))}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {row.kind === 'item' && row.entry.consumable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Use ${row.name}`}
                    disabled={(row.entry.quantity ?? 0) <= 0}
                    onClick={() =>
                      consumeItem(row.id, row.name, row.entry.quantity ?? 0)
                    }
                  >
                    Use
                  </Button>
                )}
                {row.kind === 'item' &&
                  !row.entry.consumable &&
                  row.entry.equipped && (
                    <Badge variant="neutral">Equipped</Badge>
                  )}
                {row.kind === 'spell' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Cast ${row.name}`}
                    disabled={!row.castable}
                    onClick={() => handleCastClick(row.spell)}
                  >
                    Cast
                  </Button>
                )}
                <FavoriteStar kind={row.kind} id={row.id} name={row.name} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SpellsTabModals
        character={character}
        castingSpell={castingSpell}
        viewingSpell={viewingSpell}
        closeCastModal={closeCastModal}
        closeDetailsModal={closeDetailsModal}
        handleModalCast={handleModalCast}
        handleCastClick={handleCastClick}
        addToast={addToast}
      />
    </Section>
  );
}
