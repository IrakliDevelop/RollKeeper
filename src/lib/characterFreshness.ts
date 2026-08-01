export interface FreshnessStamp {
  revision?: number;
  lastMutatedAt?: number;
  lastMutatedBy?: string;
}

/** Total order over character snapshots: (revision, lastMutatedAt,
 * lastMutatedBy), lexicographic, strictly greater. Equal-on-all-fields
 * (including legacy stamp-less snapshots) is NOT fresher — callers must
 * not adopt in that case (spec: legacy divergence heals on next mutation). */
export function isStrictlyFresher(
  incoming: FreshnessStamp,
  local: FreshnessStamp
): boolean {
  const ir = incoming.revision ?? 0;
  const lr = local.revision ?? 0;
  if (ir !== lr) return ir > lr;
  const ia = incoming.lastMutatedAt ?? 0;
  const la = local.lastMutatedAt ?? 0;
  if (ia !== la) return ia > la;
  return (incoming.lastMutatedBy ?? '') > (local.lastMutatedBy ?? '');
}
