import { summarizeBuffEffects } from './DockBuffs.utils';

import type { TemporaryBuff } from '@/types/character';

export interface DockBuffsProps {
  buffs: TemporaryBuff[];
  onToggleBuff: (id: string) => void;
}

/**
 * Quick-toggle tray for the character's temporary buffs (Mage Armor, Shield,
 * Bladesong…). Buffs are authored on the sheet (Features → Defenses); the
 * dock only flips `isActive`. Renders nothing when no buffs are defined.
 */
export function DockBuffs({ buffs, onToggleBuff }: DockBuffsProps) {
  if (buffs.length === 0) return null;

  return (
    <div>
      <div className="text-faint mb-1.5 text-xs font-bold tracking-wider uppercase">
        Buffs
      </div>
      <div className="flex flex-wrap gap-1.5">
        {buffs.map(buff => {
          const summary = summarizeBuffEffects(buff.effects);
          return (
            <button
              key={buff.id}
              onClick={() => onToggleBuff(buff.id)}
              aria-pressed={buff.isActive}
              title={summary}
              className={`min-h-[44px] max-w-full rounded-lg border px-2.5 py-1 text-left ${
                buff.isActive
                  ? 'bg-accent-purple-bg text-accent-purple-text border-accent-purple-border'
                  : 'border-divider text-body'
              }`}
            >
              <span className="block truncate text-sm font-semibold">
                {buff.name}
              </span>
              {summary && (
                <span className="text-faint block max-w-[140px] truncate text-[10px]">
                  {summary}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
