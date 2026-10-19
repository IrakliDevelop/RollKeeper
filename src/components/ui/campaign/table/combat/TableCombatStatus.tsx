'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';

import type { TableCombatNotice } from './useTableCombat';

/**
 * Save status of the Table combat panel ("Saving…", "Still saving", the
 * unsaved line with Retry, Show + Start outcomes). PR08 C1: it is the panel
 * footer, below the scrolling rows, with one line always reserved. A notice
 * appearing on blur-commit therefore never moves a row or switch between
 * pointerdown and pointerup; a longer message only grows the footer.
 */
export function TableCombatStatus(props: {
  saving: boolean;
  notice: TableCombatNotice | null;
  /** Changes that were not saved; shown beside `notice`, never hidden. */
  unsavedNotice: TableCombatNotice | null;
}) {
  return (
    // Z4: one always-mounted live region, so a notice inserted later is
    // announced (a region mounted already filled can be missed).
    <div
      role="status"
      aria-live="polite"
      className="border-divider min-h-10 space-y-1 border-t px-3 py-1.5"
      data-testid="table-combat-status"
    >
      {(props.saving || props.notice) && (
        <NoticeLine notice={props.notice} fallback="Saving…" />
      )}
      {props.unsavedNotice && <NoticeLine notice={props.unsavedNotice} />}
    </div>
  );
}

function NoticeLine(props: {
  notice: TableCombatNotice | null;
  fallback?: string;
}) {
  const { notice } = props;
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-2">
      <p
        className={`min-w-0 flex-1 text-xs ${
          notice?.tone === 'error' ? 'text-accent-red-text' : 'text-muted'
        }`}
      >
        {notice?.message ?? props.fallback}
      </p>
      {notice?.link && (
        <Link
          className="text-accent-blue-text text-xs underline"
          href={notice.link.href}
        >
          {notice.link.label}
        </Link>
      )}
      {notice?.retry && (
        <Button variant="outline" size="xs" onClick={notice.retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
