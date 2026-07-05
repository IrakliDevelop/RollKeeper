'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, Plus, Minus } from 'lucide-react';
import type { EncounterEntity, PlayerDisposition } from '@/types/encounter';
import type { ProcessedMonster } from '@/types/bestiary';
import { SharedOptions } from './SharedOptions';
import { buildMonsterEntities } from './buildEntity';

interface MonsterTabProps {
  colorIdx: number;
  onAdd: (entities: Array<Omit<EncounterEntity, 'id'>>) => void;
}

export function MonsterTab({ colorIdx, onAdd }: MonsterTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProcessedMonster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ProcessedMonster | null>(null);
  const [hp, setHp] = useState('');
  const [ac, setAc] = useState('');
  const [count, setCount] = useState(1);
  const [hideName, setHideName] = useState(false);
  const [playerAlias, setPlayerAlias] = useState('');
  const [disposition, setDisposition] = useState<PlayerDisposition>('enemy');

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
    setSelected(m);
    setHp(m.hpAverage.toString());
    setAc(m.acValue.toString());
    setCount(1);
  };

  const handleAdd = () => {
    if (!selected) return;
    onAdd(
      buildMonsterEntities(selected, {
        count,
        hpOverride: parseInt(hp) || selected.hpAverage,
        acOverride: parseInt(ac) || selected.acValue,
        isHidden: hideName,
        playerAlias: playerAlias || undefined,
        playerDisposition: disposition,
        colorIdx,
      })
    );
  };

  if (selected) {
    const mType =
      typeof selected.type === 'string' ? selected.type : selected.type.type;
    return (
      <div className="space-y-3 pb-4">
        <button
          onClick={() => setSelected(null)}
          className="text-muted hover:text-heading flex items-center gap-1 text-[13.5px] font-bold transition-colors"
        >
          <ArrowLeft size={14} /> Back to search
        </button>

        {/* Stat card */}
        <div className="border-accent-purple-border bg-surface-raised rounded-[16px] border-[1.5px] p-[18px]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-display text-heading text-[21px] leading-tight font-extrabold">
                {selected.name}
              </h4>
              <p className="text-muted text-[12.5px]">
                {selected.size.join('/')} {mType}
                {selected.alignment ? `, ${selected.alignment}` : ''}
              </p>
            </div>
            <span className="bg-accent-purple-bg text-accent-purple-text shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold">
              CR {selected.cr}
            </span>
          </div>

          {/* HP / AC / Count */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
                HP
              </label>
              <input
                type="number"
                value={hp}
                onChange={e => setHp(e.target.value)}
                className="border-divider bg-surface-secondary font-display w-full rounded-[10px] border-[1.5px] px-3 py-2.5 text-base font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
                AC
              </label>
              <input
                type="number"
                value={ac}
                onChange={e => setAc(e.target.value)}
                className="border-divider bg-surface-secondary font-display w-full rounded-[10px] border-[1.5px] px-3 py-2.5 text-base font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
                Count
              </label>
              <div className="border-divider flex items-center overflow-hidden rounded-[10px] border-[1.5px]">
                <button
                  aria-label="Decrease count"
                  onClick={() => setCount(c => Math.max(1, c - 1))}
                  className="bg-surface-secondary flex h-[42px] w-9 items-center justify-center"
                >
                  <Minus size={16} />
                </button>
                <span className="font-display flex-1 text-center text-base font-bold tabular-nums">
                  {count}
                </span>
                <button
                  aria-label="Increase count"
                  onClick={() => setCount(c => Math.min(20, c + 1))}
                  className="bg-surface-secondary flex h-[42px] w-9 items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Ability scores */}
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
              <div
                key={ab}
                className="bg-surface-secondary rounded-[9px] py-[7px] text-center"
              >
                <div className="text-muted block text-[9.5px] font-extrabold uppercase">
                  {ab}
                </div>
                <div className="font-display text-heading text-[15px] font-bold">
                  {selected[ab]}
                </div>
              </div>
            ))}
          </div>

          <p className="text-faint mt-3 text-[11.5px] font-semibold">
            HP formula {selected.hpFormula}
            {selected.actions && selected.actions.length > 0
              ? ` · ${selected.actions.length} action(s)`
              : ''}
            {selected.legendaryActions && selected.legendaryActions.length > 0
              ? ' · Legendary'
              : ''}
          </p>
        </div>

        <SharedOptions
          hideName={hideName}
          onHideNameChange={setHideName}
          playerAlias={playerAlias}
          onPlayerAliasChange={setPlayerAlias}
          disposition={disposition}
          onDispositionChange={setDisposition}
        />

        {/* Footer add button */}
        <div className="border-divider border-t pt-3.5 pb-4">
          <button
            onClick={handleAdd}
            className="bg-accent-emerald-text-muted flex w-full items-center justify-center gap-1.5 rounded-[13px] py-[15px] text-[15px] font-extrabold text-white shadow-[0_5px_16px_-5px_rgba(18,133,92,0.6)] transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Add {selected.name}
            {count > 1 ? ` ×${count}` : ''}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <div className="relative">
        <Search
          size={14}
          className="text-muted absolute top-1/2 left-[14px] -translate-y-1/2"
        />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the bestiary…"
          className="border-divider bg-surface-raised focus:border-accent-amber-border w-full rounded-[11px] border-[1.5px] py-3 pr-3 pl-9 text-sm focus:outline-none"
        />
      </div>

      {loading && (
        <p className="text-muted py-8 text-center text-sm">Searching…</p>
      )}
      {!loading && results.length === 0 && query.length >= 2 && (
        <p className="text-muted py-8 text-center text-sm">
          No creatures match &ldquo;{query}&rdquo;.
        </p>
      )}

      <div className="space-y-2">
        {results.map(m => {
          const mType = typeof m.type === 'string' ? m.type : m.type.type;
          return (
            <button
              key={m.id}
              onClick={() => handleSelect(m)}
              className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-accent-purple-bg w-full rounded-[13px] border-[1.5px] px-[14px] py-3 text-left transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-heading text-[14.5px] font-bold">
                  {m.name}
                </span>
                <span className="bg-accent-purple-bg text-accent-purple-text rounded-full px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap">
                  CR {m.cr}
                </span>
              </div>
              <div className="text-muted mt-0.5 text-xs font-medium">
                {m.hp} HP · AC {m.ac} · {mType}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
