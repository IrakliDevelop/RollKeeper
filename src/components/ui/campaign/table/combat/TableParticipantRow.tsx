'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { Badge } from '@/components/ui/layout/badge';
import type { TableCombatParticipantView } from '@/lib/table/combatReadModel';

function parseInitiative(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 'invalid';
}

/**
 * One prepared participant: manual initiative (empty = missing, 0 valid),
 * hidden-from-players toggle and status labels. Commits on blur/Enter.
 */
export function TableParticipantRow(props: {
  view: TableCombatParticipantView;
  highlightMissing: boolean;
  disabled: boolean;
  onInitiative: (value: number | null) => void;
  onHidden: (hidden: boolean) => void;
  /** PR07 P9: the member is a physical mini on the table display. */
  physical?: boolean;
}) {
  const { view } = props;
  const stored = view.entity.initiative;
  const [draft, setDraft] = useState(stored === null ? '' : String(stored));
  const [lastStored, setLastStored] = useState(stored);
  if (lastStored !== stored) {
    setLastStored(stored);
    setDraft(stored === null ? '' : String(stored));
  }
  const missing = stored === null;
  const commit = () => {
    const parsed = parseInitiative(draft);
    if (parsed === 'invalid') {
      setDraft(stored === null ? '' : String(stored));
      return;
    }
    if (parsed !== stored) props.onInitiative(parsed);
  };
  const inputId = `table-initiative-${view.entityId}`;
  return (
    <li className="border-divider flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5">
      <div className="min-w-0 flex-1 basis-24">
        <p className="text-heading truncate text-xs font-medium">
          {view.entity.name}
        </p>
        <div className="flex flex-wrap gap-1">
          {view.removedFromScene && (
            <Badge variant="warning" size="sm">
              removed from scene
            </Badge>
          )}
          {view.identityUnresolved && (
            <Badge variant="warning" size="sm">
              identity unresolved
            </Badge>
          )}
          {props.physical && (
            <Badge variant="neutral" size="sm">
              Physical
            </Badge>
          )}
        </div>
      </div>
      <Input
        id={inputId}
        aria-label={`Initiative for ${view.entity.name}`}
        aria-invalid={props.highlightMissing && missing ? 'true' : undefined}
        inputMode="decimal"
        size="sm"
        wrapperClassName="w-16 shrink-0"
        className={missing ? 'border-accent-amber-border' : undefined}
        placeholder="None"
        value={draft}
        disabled={props.disabled}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') commit();
        }}
      />
      <Switch
        size="sm"
        aria-label={`Hide ${view.entity.name} from players`}
        checked={view.hidden}
        disabled={props.disabled}
        onCheckedChange={props.onHidden}
      />
    </li>
  );
}
