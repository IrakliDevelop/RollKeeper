'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';
import { useLastCharacter } from './useLastCharacter';

const KEYHOLE =
  'M50 8 88.1 30v44L50 96 11.9 74V30Z M50 33a11 11 0 0 0-4.6 20.99L41.5 73h17l-3.9-19.01A11 11 0 0 0 50 33Z';

export function KeyholeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('fill-brass-fill', className)}
      aria-hidden="true"
    >
      <path fillRule="evenodd" d={KEYHOLE} />
    </svg>
  );
}

/** Opens the sheet last played on this device, for someone returning. */
export function ContinueLink({ className }: { className?: string }) {
  const last = useLastCharacter();
  if (!last) return null;
  return (
    <Button variant="primary" asChild className={className}>
      <Link href={`/player/characters/${last.id}`}>
        Open {last.name}&apos;s sheet
      </Link>
    </Button>
  );
}

const SMALL_LINKS = [
  { href: '/resources', label: 'Rules reference' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/about', label: 'About' },
];

export function SmallLinks({ className }: { className?: string }) {
  return (
    <nav className={className}>
      <ul className="type-ui flex flex-wrap justify-center gap-x-6 gap-y-1">
        {SMALL_LINKS.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted hover:text-heading inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const LAUNCHER_LINE =
  'D&D 5e character sheets for players, and initiative and battle maps for the DM.';
