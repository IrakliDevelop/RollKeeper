import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CampaignNPC } from '@/types/encounter';

export const UNGROUPED = 'Ungrouped';

export interface NpcGroup {
  name: string;
  npcs: CampaignNPC[];
  isUngrouped?: boolean;
}

/** Name search and tag filters over one library, grouped when any entry has a group. */
export function useNpcLibraryFilters(npcs: CampaignNPC[]): {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTags: ReadonlySet<string>;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  clearFilters: () => void;
  allTags: string[];
  filteredNpcs: CampaignNPC[];
  /** Null when no entry of this kind has a group. */
  groups: NpcGroup[] | null;
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const toggleTag = useCallback((tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const clearTags = useCallback(() => setActiveTags(new Set()), []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveTags(new Set());
  }, []);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    npcs.forEach(npc => npc.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [npcs]);

  const filteredNpcs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return npcs.filter(npc => {
      const matchesSearch =
        query === '' || npc.name.toLowerCase().includes(query);
      const matchesTags = Array.from(activeTags).every(tag =>
        npc.tags?.includes(tag)
      );
      return matchesSearch && matchesTags;
    });
  }, [npcs, searchQuery, activeTags]);

  const hasAnyGroup = useMemo(() => npcs.some(npc => !!npc.group), [npcs]);

  const groups = useMemo((): NpcGroup[] | null => {
    if (!hasAnyGroup) return null;
    const groupMap = new Map<string, CampaignNPC[]>();
    const ungrouped: CampaignNPC[] = [];
    filteredNpcs.forEach(npc => {
      if (npc.group) {
        groupMap.set(npc.group, [...(groupMap.get(npc.group) ?? []), npc]);
      } else {
        ungrouped.push(npc);
      }
    });
    const result: NpcGroup[] = Array.from(groupMap, ([name, groupNpcs]) => ({
      name,
      npcs: groupNpcs,
    })).sort((a, b) => a.name.localeCompare(b.name));
    if (ungrouped.length > 0) {
      result.push({ name: UNGROUPED, npcs: ungrouped, isUngrouped: true });
    }
    return result;
  }, [filteredNpcs, hasAnyGroup]);

  return {
    searchQuery,
    setSearchQuery,
    activeTags,
    toggleTag,
    clearTags,
    clearFilters,
    allTags,
    filteredNpcs,
    groups,
  };
}

// Longer than the 180 ms dialog exit, after which a closing dialog may have
// returned focus into itself and then unmounted.
const FOCUS_RECHECK_MS = 250;

/**
 * Moves focus to the next row's target (or the previous one, or the fallback)
 * once a removed entry has left `presentIds`, and to a new entry's target once
 * it has arrived.
 */
export function useFocusAfterRemove(presentIds: readonly string[]): {
  /** Put on the Create button that is rendered. */
  fallbackRef: RefObject<HTMLButtonElement | null>;
  /** The same callback for the same id. */
  registerTarget: (id: string) => (el: HTMLButtonElement | null) => void;
  removeThenFocus: (
    id: string,
    visibleIds: readonly string[],
    remove: () => void
  ) => void;
  /** Focus the entry's target once it is in `presentIds`, e.g. a new entry. */
  focusWhenPresent: (id: string) => void;
} {
  const fallbackRef = useRef<HTMLButtonElement | null>(null);
  const targets = useRef(new Map<string, HTMLButtonElement>());
  const callbacks = useRef(
    new Map<string, (el: HTMLButtonElement | null) => void>()
  );
  const recheckTimer = useRef<number | undefined>(undefined);
  const [pending, setPending] = useState<{
    removedId: string;
    nextId: string | null;
  } | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);

  const registerTarget = useCallback((id: string) => {
    let callback = callbacks.current.get(id);
    if (!callback) {
      callback = el => {
        if (el) targets.current.set(id, el);
        else targets.current.delete(id);
      };
      callbacks.current.set(id, callback);
    }
    return callback;
  }, []);

  const removeThenFocus = useCallback(
    (id: string, visibleIds: readonly string[], remove: () => void) => {
      const i = visibleIds.indexOf(id);
      setPending({
        removedId: id,
        // Not among the visible rows (hidden by a filter): no neighbour to pick.
        nextId: i < 0 ? null : (visibleIds[i + 1] ?? visibleIds[i - 1] ?? null),
      });
      remove();
    },
    []
  );

  const focusWhenPresent = useCallback((id: string) => setArrivedId(id), []);

  // `resolve` runs again at the re-check: a row may have remounted since.
  const focusWithRecheck = useCallback(
    (resolve: () => HTMLElement | null | undefined) => {
      resolve()?.focus();
      window.clearTimeout(recheckTimer.current);
      recheckTimer.current = window.setTimeout(() => {
        recheckTimer.current = undefined;
        const active = document.activeElement;
        const dropped =
          !active || active === document.body || !active.isConnected;
        const target = resolve();
        if (target?.isConnected && dropped) target.focus();
      }, FOCUS_RECHECK_MS);
    },
    []
  );

  useEffect(() => {
    if (!arrivedId) return;
    // The creation ran in the same batch as this render, so the row is here
    // now or it never will be.
    setArrivedId(null);
    if (!presentIds.includes(arrivedId)) return;
    focusWithRecheck(() => targets.current.get(arrivedId));
  }, [presentIds, arrivedId, focusWithRecheck]);

  useEffect(() => {
    if (!pending) return;
    if (presentIds.includes(pending.removedId)) {
      // The removal ran in the same batch as this render, so an entry that is
      // still here was not removed. Forget it, or a later removal elsewhere
      // would pull focus.
      setPending(null);
      return;
    }
    const next = pending.nextId ? targets.current.get(pending.nextId) : null;
    const target = next?.isConnected ? next : fallbackRef.current;
    setPending(null);
    if (target) focusWithRecheck(() => target);
  }, [presentIds, pending, focusWithRecheck]);

  useEffect(() => () => window.clearTimeout(recheckTimer.current), []);

  return { fallbackRef, registerTarget, removeThenFocus, focusWhenPresent };
}
