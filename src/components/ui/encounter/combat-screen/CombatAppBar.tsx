'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Settings, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

export interface CombatAppBarProps {
  name: string;
  backHref: string;
  onRename: (name: string) => void;
  onOpenAdd: () => void;
  onOpenConfig: () => void;
}

export function CombatAppBar({
  name,
  backHref,
  onRename,
  onOpenAdd,
  onOpenConfig,
}: CombatAppBarProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const cancelingRef = useRef(false);

  function startEdit() {
    setNameInput(name);
    setEditing(true);
  }

  function commitEdit() {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      return;
    }
    const trimmed = nameInput.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  return (
    <header className="bg-surface-raised border-divider flex items-center justify-between border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
            Back
          </Button>
        </Link>

        {editing ? (
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') {
                cancelingRef.current = true;
                cancelEdit();
              }
            }}
            className="font-display bg-surface-secondary text-heading min-w-0 rounded px-2 py-1 text-xl font-bold"
            autoFocus
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-heading group flex min-w-0 items-center gap-2"
            title="Click to rename"
          >
            <span className="font-display truncate text-xl font-bold">
              {name}
            </span>
            <Edit3
              size={14}
              className="text-muted shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onOpenAdd}
          leftIcon={<Plus size={16} />}
        >
          Add
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenConfig}
          title="Configure encounter"
        >
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}
