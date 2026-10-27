import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

/** How proficient a character is with a skill, tool or saving throw. */
export type ProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

/** What a dot that stands on its own tells a screen reader. */
export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  none: 'Not proficient',
  half: 'Jack of All Trades',
  proficient: 'Proficient',
  expertise: 'Expertise',
};

/** Saved data with an unknown level draws, and is read as, not proficient. */
function knownLevel(level: ProficiencyLevel): ProficiencyLevel {
  return Object.hasOwn(PROFICIENCY_LABELS, level) ? level : 'none';
}

/**
 * The skill dot's cycle in edit mode: none → proficient → expertise → none.
 * A half dot (Jack of All Trades) is not proficient, so it becomes
 * proficient.
 */
export function nextSkillProficiency(
  level: ProficiencyLevel
): ProficiencyLevel {
  if (level === 'proficient') return 'expertise';
  if (level === 'expertise') return 'none';
  return 'proficient';
}

/** A skill dot button's label: the current state, then what a tap does. */
export function skillDotLabel(skill: string, level: ProficiencyLevel): string {
  if (level === 'proficient') return `${skill}: proficient. Add expertise.`;
  if (level === 'expertise') return `${skill}: expertise. Remove proficiency.`;
  return `${skill}: not proficient. Make proficient.`;
}

/** A save dot button's label; `aria-pressed` carries its state. */
export function saveDotLabel(ability: string): string {
  return `${ability} save proficiency`;
}

/**
 * An 8px dot in a 14px box, so every state lines up in a column and the
 * expertise ring fits. Drawn in SVG: the half dot is half a circle, not a
 * gradient.
 */
function DotGlyph({ level }: { level: ProficiencyLevel }) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none size-3.5 shrink-0"
    >
      {level === 'none' && (
        <circle
          cx="7"
          cy="7"
          r="3.25"
          strokeWidth="1.5"
          className="stroke-muted fill-none"
        />
      )}
      {level === 'half' && (
        <>
          <circle
            cx="7"
            cy="7"
            r="3.25"
            strokeWidth="1.5"
            className="stroke-brass-fill fill-none"
          />
          <path d="M7 3 A4 4 0 0 0 7 11 Z" className="fill-brass-fill" />
        </>
      )}
      {(level === 'proficient' || level === 'expertise') && (
        <circle cx="7" cy="7" r="4" className="fill-brass-fill" />
      )}
      {level === 'expertise' && (
        <circle
          cx="7"
          cy="7"
          r="6.25"
          strokeWidth="1.5"
          className="stroke-brass-fill fill-none"
        />
      )}
    </svg>
  );
}

export interface ProficiencyDotProps {
  level: ProficiencyLevel;
  /**
   * Overrides the state word, e.g. "Stealth: expertise". An empty label falls
   * back to the state word, so the dot is never nameless.
   */
  label?: string;
  /**
   * Hide the dot from screen readers when nearby text already says the
   * state, e.g. a save line read as "Strength saving throw +5, proficient".
   */
  decorative?: boolean;
  className?: string;
}

/** A proficiency mark for display: skills, tools and the save line. */
export function ProficiencyDot({
  level,
  label,
  decorative = false,
  className,
}: ProficiencyDotProps) {
  const shown = knownLevel(level);
  return (
    <span
      data-level={shown}
      className={cn('inline-flex shrink-0', className)}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label || PROFICIENCY_LABELS[shown] })}
    >
      <DotGlyph level={shown} />
    </span>
  );
}

export type ProficiencyDotButtonProps = Omit<
  ComponentProps<'button'>,
  'children' | 'aria-pressed'
> & {
  level: ProficiencyLevel;
  /** States the current level and what a tap does (`skillDotLabel`), or names the save (`saveDotLabel`). */
  'aria-label': string;
  /** Set for a save dot, which toggles; leave out for a skill dot, which cycles. */
  pressed?: boolean;
};

/**
 * The dot as an edit-mode control. It keeps its 14px look and gets a 24px
 * hit area with a mouse and 44px on touch.
 */
export function ProficiencyDotButton({
  level,
  pressed,
  className,
  type = 'button',
  ...props
}: ProficiencyDotButtonProps) {
  const shown = knownLevel(level);
  return (
    <button
      type={type}
      aria-pressed={pressed}
      data-level={shown}
      className={cn(
        'relative inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 pointer-coarse:after:size-11',
        className
      )}
      {...props}
    >
      <DotGlyph level={shown} />
    </button>
  );
}
