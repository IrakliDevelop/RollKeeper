'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Play mode (`editing: false`) shows build values — ability scores, max HP,
 * base AC, speed, name, avatar — as plain text, so a stray tap at the table
 * can't change them. Edit mode makes them editable. Per page and per
 * character: never persisted or synced; every load starts in play mode.
 */
export interface SheetMode {
  editing: boolean;
  setEditing: (editing: boolean) => void;
}

const SheetModeContext = createContext<SheetMode | null>(null);

/**
 * The sheet mode for one character page. Opening another character (the
 * page can be reused across `[characterId]` params) starts in play mode
 * again.
 */
export function useSheetModeState(characterId: string): SheetMode {
  const [state, setState] = useState({ characterId, editing: false });
  if (!Object.is(state.characterId, characterId)) {
    setState({ characterId, editing: false });
  }
  const editing = Object.is(state.characterId, characterId)
    ? state.editing
    : false;
  const setEditing = useCallback(
    (next: boolean) => setState({ characterId, editing: next }),
    [characterId]
  );
  return useMemo(() => ({ editing, setEditing }), [editing, setEditing]);
}

export function SheetModeProvider({
  value,
  children,
}: {
  value: SheetMode;
  children: ReactNode;
}) {
  return (
    <SheetModeContext.Provider value={value}>
      {children}
    </SheetModeContext.Provider>
  );
}

export function useSheetMode(): SheetMode {
  const mode = useContext(SheetModeContext);
  if (!mode) {
    throw new Error('useSheetMode must be used inside a SheetModeProvider');
  }
  return mode;
}
