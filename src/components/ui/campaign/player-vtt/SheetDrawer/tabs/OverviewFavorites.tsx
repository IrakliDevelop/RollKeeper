'use client';

import { useMemo } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';

import { useDockSpellCasting } from '../../CharacterDock/DockSpells.hooks';
import { buildFavoriteRows } from '../SheetTabs.utils';
import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';
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
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Favorites</h3>
      <p className="text-faint -mt-1 mb-2 text-xs">
        Star anything in other tabs to pin it here
      </p>

      {rows.length === 0 ? (
        <p className="text-muted text-sm">
          Nothing pinned. Tap the star on any item, spell or feature.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.key}
              className="border-divider flex items-start justify-between gap-2 rounded-lg border p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-heading truncate text-sm font-semibold">
                  {row.name}
                </div>
                <div className="text-muted truncate text-xs">
                  {row.kind === 'item' && row.entry.consumable
                    ? `${row.meta} · ×${row.entry.quantity ?? 0}`
                    : row.meta}
                </div>

                {row.kind === 'item' && row.entry.attackText && (
                  <div className="text-body mt-0.5 text-xs">
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
                    <Badge variant="success">Equipped</Badge>
                  )}
                {row.kind === 'spell' && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    aria-label={`Cast ${row.name}`}
                    disabled={!row.castable}
                    title={
                      row.castable ? undefined : 'Not prepared or no slots left'
                    }
                    onClick={() => handleCastClick(row.spell)}
                  >
                    Cast
                  </Button>
                )}
                <FavoriteStar kind={row.kind} id={row.id} name={row.name} />
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );
}
