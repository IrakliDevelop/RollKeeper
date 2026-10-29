/**
 * Section Component
 *
 * Felt and Brass layout block: a Vollkorn heading on a 1px divider rule,
 * then the content. No background, border or radius. Use it to group
 * content inside a page or tab; keep Card for discrete objects.
 */

'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { cn } from '@/utils/cn';

export type SectionHeadingLevel = 2 | 3 | 4;

export interface SectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /**
   * The section heading.
   */
  heading: React.ReactNode;
  /**
   * Heading element: h2 (default), h3 or h4. Each level has its own step of
   * the type scale.
   */
  level?: SectionHeadingLevel;
  /**
   * Controls shown at the end of the heading row, such as an Add button.
   */
  trailing?: React.ReactNode;
  /**
   * Class names for the content below the rule.
   */
  contentClassName?: string;
  /** Stable per-device preference key. Omit for an always-open section. */
  collapsible?: string;
}

const HEADING_CLASS: Record<SectionHeadingLevel, string> = {
  2: 'type-heading',
  3: 'type-subheading',
  4: 'type-label-heading',
};

const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      heading,
      collapsible,
      level = 2,
      trailing,
      className,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => {
    const headingId = React.useId();
    const contentId = React.useId();
    const { prefs, setPref } = useUiPrefs();
    const collapsed = collapsible
      ? prefs.collapsed[collapsible] === true
      : false;
    const Heading = `h${level}` as const;

    return (
      <section
        ref={ref}
        aria-labelledby={headingId}
        className={className}
        {...props}
      >
        <div className="border-divider flex items-center justify-between gap-3 border-b pb-2">
          <Heading
            id={headingId}
            className={cn('text-heading min-w-0', HEADING_CLASS[level])}
          >
            {collapsible ? (
              <Button
                type="button"
                variant="ghost"
                aria-expanded={!collapsed}
                aria-controls={contentId}
                className={cn(
                  'h-auto min-h-6 justify-start px-0 py-0 text-left pointer-coarse:min-h-11',
                  HEADING_CLASS[level]
                )}
                onClick={() =>
                  setPref('collapsed', {
                    ...prefs.collapsed,
                    [collapsible]: !collapsed,
                  })
                }
              >
                {heading}
                <ChevronDown
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', collapsed && '-rotate-90')}
                />
              </Button>
            ) : (
              heading
            )}
          </Heading>
          {trailing != null && (
            <div className="flex shrink-0 items-center gap-2">{trailing}</div>
          )}
        </div>
        <div
          id={contentId}
          hidden={collapsed}
          className={cn(!collapsed && 'pt-4', contentClassName)}
        >
          {!collapsed && children}
        </div>
      </section>
    );
  }
);
Section.displayName = 'Section';

export { Section };
