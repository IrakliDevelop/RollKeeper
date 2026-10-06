'use client';

import { MonsterSearch } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/MonsterSearch';
import { buildMonsterEntities } from '@/components/ui/encounter/combat-screen/AddCombatantDialog/buildEntity';
import { useMonsterSearch } from '@/hooks/useMonsterSearch';
import type { ProcessedMonster } from '@/types/bestiary';

import { creatureFromEntity } from './tableRosterModel';

/**
 * Bestiary creature instance: a Table-local copy (stats live only in the
 * scene repository; the bestiary and encounter library are untouched).
 */
export function TableAddCreatureTab({
  onAdd,
}: {
  onAdd: (stats: ReturnType<typeof creatureFromEntity>) => void;
}) {
  const search = useMonsterSearch();

  const handleSelect = (monster: ProcessedMonster) => {
    const [entity] = buildMonsterEntities(monster, {
      count: 1,
      hpOverride: monster.hpAverage,
      acOverride: monster.acValue,
      isHidden: false,
      playerDisposition: 'enemy',
      colorIdx: 0,
    });
    if (entity) onAdd(creatureFromEntity(entity, 'bestiary'));
  };

  return (
    <MonsterSearch
      query={search.query}
      onQueryChange={search.setQuery}
      results={search.results}
      total={search.total}
      hasMore={search.hasMore}
      loading={search.loading}
      loadingMore={search.loadingMore}
      onSelect={handleSelect}
      onLoadMore={search.loadMore}
    />
  );
}
