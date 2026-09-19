'use client';

import { useEffect, useState } from 'react';

import { SPELL_BUFF_NAMES } from '@/components/ui/encounter/combat-screen/effectPalettes';

import type { EffectPaletteEntry } from '@/components/ui/encounter/combat-screen/effectPalettes';
import type { ProcessedSpell } from '@/types/spells';

interface PaletteSpellState {
  effects: EffectPaletteEntry[];
  loading: boolean;
}

const INITIAL_STATE: PaletteSpellState = { effects: [], loading: true };

function selectSpellRules(spells: ProcessedSpell[]): EffectPaletteEntry[] {
  const byName = new Map<string, ProcessedSpell>();
  for (const spell of spells) {
    const key = spell.name.toLowerCase();
    const current = byName.get(key);
    if (!current || spell.id.endsWith('-xphb')) byName.set(key, spell);
  }
  return [...byName.values()].map(spell => ({
    name: spell.name,
    kind: 'buff',
    origin: 'spell',
    description: spell.description,
    rulesSource: spell.source,
  }));
}

let cachedEffects: EffectPaletteEntry[] | null = null;
let pendingEffects: Promise<EffectPaletteEntry[]> | null = null;

function loadPaletteSpellEffects(): Promise<EffectPaletteEntry[]> {
  if (cachedEffects) return Promise.resolve(cachedEffects);
  if (pendingEffects) return pendingEffects;
  const params = new URLSearchParams();
  for (const name of SPELL_BUFF_NAMES) params.append('name', name);
  pendingEffects = fetch(`/api/spells?${params.toString()}`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to load spell effect rules');
      return response.json() as Promise<{ spells: ProcessedSpell[] }>;
    })
    .then(({ spells }) => {
      cachedEffects = selectSpellRules(spells);
      pendingEffects = null;
      return cachedEffects;
    })
    .catch(error => {
      pendingEffects = null;
      console.warn('Failed to load spell effect rules:', error);
      return [];
    });
  return pendingEffects;
}

/** Loads rules text only for the spell buffs shown in the combat palette. */
export function usePaletteSpellEffects(): PaletteSpellState {
  const [state, setState] = useState(INITIAL_STATE);
  useEffect(() => {
    let active = true;
    loadPaletteSpellEffects().then(effects => {
      if (active) setState({ effects, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
