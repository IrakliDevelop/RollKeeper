import { Button } from '@/components/ui/forms/button';
import type { useTableControl } from '@/hooks/useTableControl';

interface Props {
  control: ReturnType<typeof useTableControl>;
  combatActive: boolean;
  publicationError: string | null;
  legacyBroadcasting: boolean;
}

export function TablePublicationControls({
  control,
  combatActive,
  publicationError,
  legacyBroadcasting,
}: Props) {
  if (control.status === 'legacy') {
    if (!publicationError) return null;
    return (
      <div
        className="border-divider bg-surface-secondary text-accent-red-text border-b px-4 py-2 text-sm"
        role="alert"
      >
        {legacyBroadcasting ? 'Broadcasting initiative' : 'Not broadcasting'}:{' '}
        {publicationError}
      </div>
    );
  }
  const activeLease =
    !!control.current && control.current.leaseUntil > Date.now();
  const message =
    control.status === 'broadcasting'
      ? 'Broadcasting initiative'
      : control.status === 'controlling'
        ? 'Live control held · publication pending'
        : combatActive
          ? 'Started locally · not broadcasting'
          : 'Not broadcasting';
  return (
    <div
      className="border-divider bg-surface-secondary text-body flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <span>
        {control.status === 'checking' ? 'Checking live control…' : message}
      </span>
      {control.error && (
        <span className="text-accent-red-text">{control.error}</span>
      )}
      {control.status === 'waiting' && (
        <Button
          variant="secondary"
          onClick={() => void control.initialize().catch(() => {})}
        >
          Initialize live control
        </Button>
      )}
      {control.current && control.status !== 'broadcasting' && (
        <Button
          variant="secondary"
          onClick={() =>
            void (activeLease ? control.takeover() : control.acquire()).catch(
              () => {}
            )
          }
        >
          {activeLease ? 'Take over broadcast' : 'Acquire broadcast'}
        </Button>
      )}
      {control.status === 'error' && (
        <Button variant="ghost" onClick={() => void control.refresh()}>
          Refresh control
        </Button>
      )}
    </div>
  );
}
