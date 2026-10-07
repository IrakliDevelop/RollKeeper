'use client';

import { Monitor } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { openTableDisplay } from '@/lib/openTableDisplay';

import { useDisplayLauncher } from './useDisplayLauncher';

interface OpenDisplayButtonProps {
  code: string;
  dmId: string;
  /** Called after a successful rotation (e.g. to refresh display status). */
  onLaunched?: () => void;
}

/** PR05 E12: "Open display" for any campaign DM (no live lease needed). */
export function OpenDisplayButton({
  code,
  dmId,
  onLaunched,
}: OpenDisplayButtonProps) {
  const { message, launch } = useDisplayLauncher(onLaunched);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Monitor size={14} />}
        onClick={() => launch(() => openTableDisplay({ code, dmId }))}
      >
        Open display
      </Button>
      <span
        role="status"
        className="text-accent-amber-text min-w-0 text-xs break-words"
      >
        {message}
      </span>
    </div>
  );
}

/**
 * Campaign dashboard launcher: rendered only under the existing Table v1
 * public flag (the capability route answers 503 without v1). No new flag.
 */
export function CampaignDisplayLauncher(props: OpenDisplayButtonProps) {
  if (process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED !== 'true')
    return null;
  return <OpenDisplayButton {...props} />;
}
