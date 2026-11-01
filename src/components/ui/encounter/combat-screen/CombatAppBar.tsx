'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

export interface CombatAppBarProps {
  name: string;
  backHref: string;
  onRename: (name: string) => void;
  onOpenAdd: () => void;
  onOpenConfig: () => void;
  addPrimary?: boolean;
  /** Optional battle-map action rendered before the Add button. */
  mapAction?: React.ReactNode;
}

export function CombatAppBar({
  name,
  backHref,
  onRename,
  onOpenAdd,
  onOpenConfig,
  addPrimary = false,
  mapAction,
}: CombatAppBarProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const renameRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      renameRef.current?.focus();
      returnFocus.current = false;
    }
  }, [editing]);

  const handleStartEdit = () => {
    setNameInput(name);
    setEditing(true);
  };

  const handleCloseEdit = () => {
    returnFocus.current = true;
    setEditing(false);
  };

  const handleCommit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    handleCloseEdit();
  };

  return (
    <header className="border-divider flex flex-wrap items-center justify-between gap-3 border-b py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
        >
          <Link href={backHref}>Back</Link>
        </Button>
        {editing ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
            onSubmit={event => {
              event.preventDefault();
              handleCommit();
            }}
          >
            <Input
              label="Encounter name"
              value={nameInput}
              onChange={event => setNameInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') handleCloseEdit();
              }}
              wrapperClassName="min-w-40 flex-1"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!nameInput.trim()}>
              Save name
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCloseEdit}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="type-subheading text-heading min-w-0 break-words">
              {name}
            </h2>
            <Button
              ref={renameRef}
              variant="ghost"
              size="sm"
              onClick={handleStartEdit}
            >
              Rename <span className="sr-only">{name}</span>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mapAction}
        <Button
          variant={addPrimary ? 'primary' : 'secondary'}
          size="sm"
          onClick={onOpenAdd}
          leftIcon={<Plus size={16} />}
        >
          Add combatant
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenConfig}
          aria-label="Open combat configuration"
        >
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}
