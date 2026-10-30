'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { ConcentrationState } from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';

interface ConcentrationTrackerProps {
  concentration: ConcentrationState;
  onStopConcentration: () => void;
  className?: string;
}

function elapsedTime(startedAt: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(startedAt).getTime());
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function ConcentrationTracker({
  concentration,
  onStopConcentration,
  className,
}: ConcentrationTrackerProps) {
  const [duration, setDuration] = useState('');
  useEffect(() => {
    if (!concentration.isConcentrating || !concentration.startedAt) return;
    const tick = () =>
      setDuration(elapsedTime(concentration.startedAt!, Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [concentration.isConcentrating, concentration.startedAt]);

  if (!concentration.isConcentrating) return null;

  return (
    <Section heading="Concentrating" level={3} className={className}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="type-subheading text-lapis-text">
            {concentration.spellName}
          </p>
          <div className="type-ui text-muted flex flex-wrap items-center gap-3">
            {(concentration.castAt ?? 0) > 0 && (
              <span>Level {concentration.castAt}</span>
            )}
            {concentration.startedAt && duration && (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" />
                {duration}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onStopConcentration()}
          >
            End concentration
          </Button>
        </div>
        <div>
          <h4 className="type-label-heading text-heading">
            Concentration rules
          </h4>
          <ul className="type-ui text-body mt-2 list-disc space-y-1 pl-5">
            <li>Taking damage may require a Constitution saving throw</li>
            <li>Casting another concentration spell ends this one</li>
            <li>Being incapacitated or killed ends concentration</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
