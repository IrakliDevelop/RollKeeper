'use client';

import React from 'react';
import type { ProcessedMonster } from '@/types/bestiary';
import type { PlayerDisposition } from '@/types/encounter';
import { MonsterSearch } from './MonsterSearch';
import { MonsterDetail } from './MonsterDetail';
import { StatBlockEditor } from './StatBlockEditor';
import { useMonsterSearch } from '@/hooks/useMonsterSearch';
import type { MonsterEditDraft } from './monsterEditDraft';

interface MonsterTabProps {
  selected: ProcessedMonster | null;
  onSelect: (m: ProcessedMonster | null) => void;
  hp: string;
  onHpChange: (v: string) => void;
  ac: string;
  onAcChange: (v: string) => void;
  count: number;
  onCountChange: (v: number) => void;
  hideName: boolean;
  onHideNameChange: (v: boolean) => void;
  playerAlias: string;
  onPlayerAliasChange: (v: string) => void;
  disposition: PlayerDisposition;
  onDispositionChange: (v: PlayerDisposition) => void;
  draft: MonsterEditDraft | null;
  editing: boolean;
  onEditStatBlock: () => void;
  onDraftChange: (d: MonsterEditDraft) => void;
  onEditorBack: () => void;
  onEditorReset: () => void;
}

export function MonsterTab({
  selected,
  onSelect,
  hp,
  onHpChange,
  ac,
  onAcChange,
  count,
  onCountChange,
  hideName,
  onHideNameChange,
  playerAlias,
  onPlayerAliasChange,
  disposition,
  onDispositionChange,
  draft,
  editing,
  onEditStatBlock,
  onDraftChange,
  onEditorBack,
  onEditorReset,
}: MonsterTabProps) {
  const {
    query,
    setQuery,
    results,
    total,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  } = useMonsterSearch();

  const handleSelect = (m: ProcessedMonster) => {
    onSelect(m);
    onHpChange(m.hpAverage.toString());
    onAcChange(m.acValue.toString());
    onCountChange(1);
  };

  if (selected && editing && draft) {
    return (
      <StatBlockEditor
        monsterName={selected.name}
        draft={draft}
        onDraftChange={onDraftChange}
        onReset={onEditorReset}
        onBack={onEditorBack}
      />
    );
  }

  if (selected) {
    return (
      <MonsterDetail
        selected={selected}
        hp={hp}
        onHpChange={onHpChange}
        ac={ac}
        onAcChange={onAcChange}
        count={count}
        onCountChange={onCountChange}
        hideName={hideName}
        onHideNameChange={onHideNameChange}
        playerAlias={playerAlias}
        onPlayerAliasChange={onPlayerAliasChange}
        disposition={disposition}
        onDispositionChange={onDispositionChange}
        onBack={() => onSelect(null)}
        onEditStatBlock={onEditStatBlock}
        hasEdits={draft !== null}
      />
    );
  }

  return (
    <MonsterSearch
      query={query}
      onQueryChange={setQuery}
      results={results}
      total={total}
      hasMore={hasMore}
      loading={loading}
      loadingMore={loadingMore}
      onSelect={handleSelect}
      onLoadMore={loadMore}
    />
  );
}
