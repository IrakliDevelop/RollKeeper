'use client';

import { Button } from '@/components/ui/forms/button';

import type { TableRosterNotice } from './useTableRosterActions';

const TONE_CLASS: Record<TableRosterNotice['tone'], string> = {
  info: 'text-muted',
  success: 'text-accent-emerald-text',
  error: 'text-accent-red-text',
};

/** Polite live region for roster command outcomes (one per visible layer). */
export function TableRosterNoticeLine({
  notice,
}: {
  notice: TableRosterNotice | null;
}) {
  if (!notice) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-1">
      <p
        role="status"
        aria-live="polite"
        className={`min-w-0 flex-1 text-xs ${TONE_CLASS[notice.tone]}`}
      >
        {notice.message}
      </p>
      {notice.retry && (
        <Button variant="outline" size="sm" onClick={notice.retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
