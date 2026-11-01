'use client';

import { useId, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
import { ABILITY_ABBREVIATIONS, SKILL_NAMES } from '@/utils/constants';
import type { AbilityName, SkillName } from '@/types/character';
import { ABILITY_ORDER } from './AbilitiesSection.utils';

const ICON_BUTTON =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm min-h-6 min-w-6 pointer-coarse:min-h-11 pointer-coarse:min-w-11 focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2';

const CHOICE =
  'type-ui text-body border-divider min-h-6 min-w-11 cursor-pointer rounded-sm border px-2 pointer-coarse:min-h-11 focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:border-brass-fill aria-pressed:bg-brass-fill aria-pressed:text-on-brass';

/** The "+WIS" control: a popover with a button per other ability. */
export function BonusAbilityPicker({
  skill,
  ability,
  bonusAbilities,
  onToggle,
}: {
  skill: SkillName;
  ability: AbilityName;
  bonusAbilities: AbilityName[];
  onToggle: (skill: SkillName, ability: AbilityName) => void;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const Icon = open ? X : bonusAbilities.length > 0 ? MoreHorizontal : Plus;

  return (
    // Modal, like the score editor: a tap outside only closes it.
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Choose ability modifiers for ${SKILL_NAMES[skill]}`}
          className={ICON_BUTTON}
        >
          <Icon aria-hidden="true" className="text-muted size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-labelledby={headingId}
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className={cn(OVERLAY_SURFACE, 'z-50 w-52 p-2.5')}
        >
          <p id={headingId} className="type-small text-muted mb-1.5">
            Add ability modifiers:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ABILITY_ORDER.filter(other => other !== ability).map(other => (
              <button
                key={other}
                type="button"
                aria-pressed={bonusAbilities.includes(other)}
                onClick={() => onToggle(skill, other)}
                className={CHOICE}
              >
                {ABILITY_ABBREVIATIONS[other]}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
