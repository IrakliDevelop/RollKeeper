import type { ReactNode } from 'react';
import { Section } from '@/components/ui/layout/section';
import { cn } from '@/utils/cn';

interface LandingSectionProps {
  heading: string;
  children: ReactNode;
  /** A real screenshot, beside the text from `lg` and below it before. */
  media?: ReactNode;
}

/** One landing-page section: text on the left, an optional screenshot right. */
export function LandingSection({
  heading,
  children,
  media,
}: LandingSectionProps) {
  return (
    <Section
      heading={heading}
      level={2}
      className="border-divider border-t pt-10"
    >
      <div
        className={cn(
          'grid gap-8',
          media != null && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
        )}
      >
        <div className="type-body text-body flex max-w-[36em] flex-col gap-3">
          {children}
        </div>
        {media}
      </div>
    </Section>
  );
}
