import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';

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
 * Also mounted by the sheet drawer's Effects tab, whose tests render it
 * without a `TooltipProvider`, so it renders no Tooltip.
 */
export function DockBuffs({ buffs, onToggleBuff }: DockBuffsProps) {
  if (buffs.length === 0) return null;

  return (
    <Section
      level={4}
      heading="Buffs"
      contentClassName="flex flex-wrap gap-1.5"
    >
      {buffs.map(buff => {
        const summary = summarizeBuffEffects(buff.effects);
        return (
          <Button
            key={buff.id}
            variant="secondary"
            size="sm"
            selected={buff.isActive}
            aria-pressed={buff.isActive}
            onClick={() => onToggleBuff(buff.id)}
            className="h-auto min-h-9 max-w-full flex-col items-start gap-0 px-2.5 py-1 text-left"
          >
            <span className="type-ui">{buff.name}</span>
            {summary && (
              <span className="type-caption text-muted">{summary}</span>
            )}
          </Button>
        );
      })}
    </Section>
  );
}
