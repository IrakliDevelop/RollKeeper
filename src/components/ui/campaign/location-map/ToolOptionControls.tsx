'use client';

import type { ReactNode } from 'react';
import { Plus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { cn } from '@/utils/cn';

/**
 * The option controls the map tool chrome is built from: the tool options
 * row, the selection options and the grid popover. Mechanics only — tool
 * names, palettes and copy live with the callers. Tooltips here need a
 * `TooltipProvider` above them.
 */

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Overrides the visible label as the accessible name (e2e-pinned names). */
  ariaLabel?: string;
}

interface SegmentedGroupProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

/** A row of outline buttons choosing one value; the chosen one is `selected`. */
export function SegmentedGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map(option => {
        const on = option.value === value;
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            variant="secondary"
            size="xs"
            selected={on}
            aria-pressed={on}
            aria-label={option.ariaLabel}
            leftIcon={Icon ? <Icon size={14} /> : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

interface SwatchButtonProps {
  /** A literal colour (data, not theming — rule 3). */
  color: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  /** `toggle` (default): `aria-pressed`. `radio`: inside a `radiogroup`. */
  semantics?: 'toggle' | 'radio';
  /** Test hook on the colour dot, for callers that assert the painted fill. */
  dotTestId?: string;
}

/** A named colour dot in a 36px icon button; the chosen one gets a brass outline. */
export function SwatchButton({
  color,
  name,
  selected,
  onSelect,
  semantics = 'toggle',
  dotTestId,
}: SwatchButtonProps) {
  const stateProps =
    semantics === 'radio'
      ? { role: 'radio', 'aria-checked': selected }
      : { 'aria-pressed': selected };
  return (
    <Tooltip content={name}>
      <Button
        variant="ghost"
        size="sm"
        className="w-9 shrink-0 px-0"
        aria-label={name}
        {...stateProps}
        onClick={onSelect}
      >
        <span
          aria-hidden="true"
          data-testid={dotTestId}
          className={cn(
            'border-divider-strong block size-5 rounded-full border',
            selected && 'outline-brass-border outline-2 outline-offset-2'
          )}
          style={{ backgroundColor: color }}
        />
      </Button>
    </Tooltip>
  );
}

interface CustomColorButtonProps {
  value: string;
  onChange: (color: string) => void;
}

/** The native colour picker behind a dashed dot, sized like an icon button. */
export function CustomColorButton({ value, onChange }: CustomColorButtonProps) {
  return (
    <Tooltip content="Custom color">
      <label className="hover:bg-surface-hover has-[:focus-visible]:outline-ring relative inline-flex size-9 shrink-0 items-center justify-center rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 pointer-coarse:size-11">
        <input
          type="color"
          aria-label="Custom color"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className="border-divider-strong text-muted flex size-5 items-center justify-center rounded-full border border-dashed"
        >
          <Plus size={12} />
        </span>
      </label>
    </Tooltip>
  );
}

interface RangeFieldProps {
  ariaLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}

/** A native range with its value beside it. Put an `OptionLabel` before it. */
export function RangeField({
  ariaLabel,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: RangeFieldProps) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="accent-brass-fill w-24 pointer-coarse:h-11"
      />
      <span className="type-small text-muted tabular-nums">
        {format(value)}
      </span>
    </span>
  );
}

interface DisableableTooltipProps {
  content: ReactNode;
  disabled: boolean;
  children: ReactNode;
  /** Forwarded to the `Tooltip` content (e.g. a higher z class inside a popover). */
  className?: string;
  /**
   * Make the wrapper a tab stop while the button is disabled, so keyboard
   * users can reach the hint. Only for hints that explain the disabled state
   * (a reason, a count); a hint that just repeats the button's name would be
   * a nameless tab stop. Default false.
   */
  focusable?: boolean;
}

/**
 * Radix never fires a Tooltip whose trigger is a disabled button, so a button
 * that can be disabled hangs its tooltip on a wrapper span. With `focusable`
 * the span is a tab stop only while the button is disabled; an enabled button
 * always keeps a single tab stop.
 */
export function DisableableTooltip({
  content,
  disabled,
  children,
  className,
  focusable = false,
}: DisableableTooltipProps) {
  return (
    <Tooltip content={content} className={className}>
      <span
        className="inline-flex"
        tabIndex={disabled && focusable ? 0 : undefined}
      >
        {children}
      </span>
    </Tooltip>
  );
}

/** The small muted word before a control in the options row. */
export function OptionLabel({ children }: { children: ReactNode }) {
  return <span className="type-small text-muted">{children}</span>;
}

/** A thin vertical rule between the name cell and the options. */
export function OptionSeparator() {
  return <span aria-hidden="true" className="bg-divider h-6 w-px" />;
}
