'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ProcessedMonster } from '@/types/bestiary';
import type { PlayerDisposition } from '@/types/encounter';
import { MonsterSearch } from './MonsterSearch';
import { MonsterDetail } from './MonsterDetail';

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
}: MonsterTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProcessedMonster[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bestiary/search?q=${encodeURIComponent(q)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.monsters ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSelect = (m: ProcessedMonster) => {
    onSelect(m);
    onHpChange(m.hpAverage.toString());
    onAcChange(m.acValue.toString());
    onCountChange(1);
  };

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
      />
    );
  }

  return (
    <MonsterSearch
      query={query}
      onQueryChange={setQuery}
      results={results}
      loading={loading}
      onSelect={handleSelect}
    />
  );
}
