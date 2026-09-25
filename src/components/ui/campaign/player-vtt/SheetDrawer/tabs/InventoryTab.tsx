'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { useCharacterStore } from '@/store/characterStore';
import { cn } from '@/utils/cn';

import type { ToastData } from '@/components/ui/feedback/Toast';

import {
  buildInventoryGroups,
  buildInventorySummary,
} from '../InventoryTabs.utils';
import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';
import {
  INVENTORY_VIEW_STORAGE_KEY,
  type InventoryViewMode,
} from '../SheetDrawer.types';
import { InventoryEntryRow } from './InventoryEntryRow';
import { InventoryGrid } from './InventoryGrid';
import { InventorySummary } from './InventorySummary';

export interface InventoryTabProps {
  locked: boolean;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

function readStoredViewMode(): InventoryViewMode {
  try {
    const stored = window.localStorage.getItem(INVENTORY_VIEW_STORAGE_KEY);
    if (stored === 'list' || stored === 'grid') return stored;
  } catch {
    // localStorage unavailable (private mode, SSR) — fall back silently.
  }
  return 'list';
}

function writeStoredViewMode(mode: InventoryViewMode) {
  try {
    window.localStorage.setItem(INVENTORY_VIEW_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable — the toggle still works, just doesn't persist.
  }
}

/** Sheet drawer's Inventory tab: search, list/grid views, currency, weight, attunement. */
export function InventoryTab({ locked, addToast }: InventoryTabProps) {
  const character = useCharacterStore(s => s.character);
  const [search, setSearch] = useState('');
  const [viewMode, setViewModeState] =
    useState<InventoryViewMode>(readStoredViewMode);

  const setViewMode = (mode: InventoryViewMode) => {
    setViewModeState(mode);
    writeStoredViewMode(mode);
  };

  const groups = useMemo(
    () => buildInventoryGroups(character, search),
    [character, search]
  );
  const hasAnyItems = useMemo(
    () =>
      (character.weapons?.length ?? 0) > 0 ||
      (character.armorItems?.length ?? 0) > 0 ||
      (character.magicItems?.length ?? 0) > 0 ||
      (character.inventoryItems?.length ?? 0) > 0,
    [character]
  );
  const summary = useMemo(() => buildInventorySummary(character), [character]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          aria-label="Search inventory"
          placeholder="Search inventory…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          wrapperClassName="flex-1"
        />
        <div role="group" aria-label="Inventory view" className="flex gap-1">
          <Button
            type="button"
            variant={viewMode === 'list' ? 'secondary' : 'outline'}
            size="sm"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'secondary' : 'outline'}
            size="sm"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <InventorySummary locked={locked} summary={summary} />

      {groups.length === 0 ? (
        <div className={cn(SECTION_CLASS, 'text-muted text-sm')}>
          {hasAnyItems
            ? `No items match “${search}”.`
            : 'No items yet. Add gear on the full character sheet.'}
        </div>
      ) : viewMode === 'grid' ? (
        <InventoryGrid groups={groups} addToast={addToast} />
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.key} className={SECTION_CLASS}>
              <h3 className={HEADING_CLASS}>
                {group.label} ({group.entries.length})
              </h3>
              <div className="space-y-2">
                {group.entries.map(entry => (
                  <InventoryEntryRow
                    key={entry.id}
                    entry={entry}
                    summary={summary}
                    addToast={addToast}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
