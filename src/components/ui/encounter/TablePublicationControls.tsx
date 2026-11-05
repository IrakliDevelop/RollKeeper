import { Button } from '@/components/ui/forms/button';
import type { useTableControl } from '@/hooks/useTableControl';

interface Props {
  control: ReturnType<typeof useTableControl>;
  combatActive: boolean;
}

export function TablePublicationControls({ control, combatActive }: Props) {
  const activeLease =
    !!control.current && control.current.leaseUntil > Date.now();
  const message =
    control.status === 'broadcasting'
      ? 'Initiative shared with players'
      : control.status === 'controlling'
        ? "You're live. No initiative shared"
        : combatActive
          ? 'Started here, not shared with players'
          : 'Not shared with players';
  return (
    <div
      className="border-divider bg-surface-secondary text-body flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <span>
        {control.status === 'checking' ? "Checking if you're live…" : message}
      </span>
      {control.error && (
        <span className="text-blood-text">{control.error}</span>
      )}
      {control.status === 'waiting' && (
        <Button
          variant="secondary"
          onClick={() => void control.initialize().catch(() => {})}
        >
          Set up live play
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
          {activeLease ? 'Take over and go live' : 'Go live'}
        </Button>
      )}
      {control.status === 'error' && (
        <Button variant="ghost" onClick={() => void control.refresh()}>
          Check again
        </Button>
      )}
    </div>
  );
}
