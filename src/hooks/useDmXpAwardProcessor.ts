import { useEffect, useRef } from 'react';
import type { DmXpAward, DmXpAwardEnvelope } from '@/types/sharedState';

interface UseDmXpAwardProcessorArgs {
  xpAwards: DmXpAwardEnvelope[] | undefined;
  applyDmXpAward: (award: DmXpAward) => {
    status: 'applied' | 'duplicate';
    becamePending: boolean;
  };
  acknowledgeXpAward: (receipt: string) => Promise<void>;
  /** Called once per NEWLY applied award (never for duplicates). */
  onApplied: (award: DmXpAward, becamePending: boolean) => void;
}

/**
 * Applies queued DM XP awards in enqueue order: apply (idempotent, dedup by
 * award id) then ack, one at a time. A failure stops the cycle — the queue is
 * refetched on the next poll and idempotency makes reprocessing safe. The
 * single-flight ref prevents overlapping poll/effect runs from double-acking.
 */
export function useDmXpAwardProcessor({
  xpAwards,
  applyDmXpAward,
  acknowledgeXpAward,
  onApplied,
}: UseDmXpAwardProcessorArgs) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!xpAwards || xpAwards.length === 0) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    (async () => {
      for (const { award, receipt } of xpAwards) {
        try {
          const result = applyDmXpAward(award);
          await acknowledgeXpAward(receipt);
          if (result.status === 'applied') {
            onApplied(award, result.becamePending);
          }
        } catch (err) {
          console.error(
            'Failed to process DM XP award; will retry next poll',
            err
          );
          break;
        }
      }
    })().finally(() => {
      inFlightRef.current = false;
    });
  }, [xpAwards, applyDmXpAward, acknowledgeXpAward, onApplied]);
}
