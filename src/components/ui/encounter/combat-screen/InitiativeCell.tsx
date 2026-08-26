'use client';

import React, { useState } from 'react';
import type { EncounterEntity } from '@/types/encounter';

interface InitiativeCellProps {
  entity: EncounterEntity;
  isRail: boolean;
  isActive: boolean;
  onSetInitiative: (entityId: string, value: number) => void;
}

export function InitiativeCell({
  entity,
  isRail,
  isActive,
  onSetInitiative,
}: InitiativeCellProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  function commit() {
    const val = parseFloat(input);
    if (!isNaN(val)) onSetInitiative(entity.id, val);
    setEditing(false);
  }

  const display =
    entity.initiative != null
      ? Number.isInteger(entity.initiative)
        ? String(entity.initiative)
        : entity.initiative.toFixed(1)
      : '—';

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onClick={e => e.stopPropagation()}
        className="bg-surface-raised text-heading h-10 w-12 rounded-lg text-center font-bold tabular-nums shadow-sm"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        setInput(entity.initiative?.toString() ?? '');
        setEditing(true);
      }}
      className={`hover:ring-accent-amber-border flex shrink-0 flex-col items-center justify-center rounded-lg shadow-sm transition-all hover:ring-2 ${isRail ? 'h-10 w-10' : 'h-9 w-9'} ${isActive ? 'bg-accent-amber-bg-strong text-accent-amber-text ring-accent-amber-border ring-2' : 'bg-surface-raised text-heading'}`}
      title="Click to set initiative"
    >
      <span
        className={`font-display font-extrabold tabular-nums ${isRail ? 'text-xl' : 'text-lg'}`}
      >
        {display}
      </span>
      {isRail && (
        <span className="text-faint text-[8px] font-semibold tracking-widest">
          INIT
        </span>
      )}
    </button>
  );
}
