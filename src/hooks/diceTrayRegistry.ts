import { createDiceTray } from 'pollyroll/render';
import { diceClacks } from 'pollyroll/sounds';
import type { DiceTray, SkinRef } from 'pollyroll/render';
import type { DicePreferences } from '@/types/dice';

export interface DiceTrayEntry {
  tray: DiceTray;
  users: number;
  skinKey: string;
  dieScale: number;
  creationKey: string;
  rolling: boolean;
  clearTimer: ReturnType<typeof setTimeout> | null;
}
const trays = new Map<string, DiceTrayEntry>();
export const diceTrayCreationKey = (options?: DicePreferences) =>
  JSON.stringify({ ...options, sound: undefined });
export const getDiceTrayEntry = (id: string) => trays.get(id);

/** Buttons share one scene. Only a caller supplying preferences reconfigures it. */
export function acquireDiceTray(
  id: string,
  skin: SkinRef | undefined,
  dieScale: number,
  options?: DicePreferences
): DiceTray | null {
  const existing = trays.get(id);
  const target = document.getElementById(id);
  if (!target) return null;
  if (existing) {
    if (
      options !== undefined &&
      existing.creationKey !== diceTrayCreationKey(options)
    ) {
      if (existing.clearTimer) clearTimeout(existing.clearTimer);
      existing.tray.dispose();
      existing.tray = createDiceTray(target, {
        ...options,
        clacks: diceClacks,
        skin,
        dieScale,
      });
      existing.creationKey = diceTrayCreationKey(options);
      existing.skinKey = JSON.stringify(skin ?? null);
      existing.dieScale = dieScale;
      existing.rolling = false;
      existing.clearTimer = null;
    }
    existing.users += 1;
    return existing.tray;
  }
  const tray = createDiceTray(target, {
    ...options,
    clacks: diceClacks,
    skin,
    dieScale,
  });
  trays.set(id, {
    tray,
    users: 1,
    skinKey: JSON.stringify(skin ?? null),
    dieScale,
    creationKey: diceTrayCreationKey(options),
    rolling: false,
    clearTimer: null,
  });
  return tray;
}

export function releaseDiceTray(id: string): void {
  const entry = trays.get(id);
  if (!entry || --entry.users > 0) return;
  if (entry.clearTimer) clearTimeout(entry.clearTimer);
  entry.tray.dispose();
  trays.delete(id);
}

export function applyDiceAppearance(
  id: string,
  skin: SkinRef | undefined,
  dieScale: number | undefined,
  options?: DicePreferences
): void {
  const entry = trays.get(id);
  if (!entry) return;
  if (skin !== undefined && JSON.stringify(skin) !== entry.skinKey) {
    entry.skinKey = JSON.stringify(skin);
    entry.tray.setSkin(skin);
  }
  if (dieScale !== undefined && dieScale !== entry.dieScale) {
    entry.dieScale = dieScale;
    entry.tray.setDieScale(dieScale);
  }
  if (options !== undefined) entry.tray.setSound(options.sound ?? 0);
}
