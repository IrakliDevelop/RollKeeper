/** Set while the leader is executing a forwarded intent. The canonical
 * mutation middleware reads it to advance the sender's watermark in the
 * SAME rawSet (and persist write) as the mutation — the exactly-once
 * failover guarantee depends on that atomicity. */
export interface IntentMark {
  tabId: string;
  seq: number;
}

let applyingIntent: IntentMark | null = null;

export const getApplyingIntent = (): IntentMark | null => applyingIntent;

export function withIntentContext(mark: IntentMark, fn: () => void): void {
  applyingIntent = mark;
  try {
    fn();
  } finally {
    applyingIntent = null;
  }
}
