/** Card background/border by HP percentage: >60 emerald, 31-60 amber, <=30 red. */
export function getHpCardClasses(percent: number): string {
  if (percent > 60) return 'bg-accent-emerald-bg border-accent-emerald-border';
  if (percent > 30) return 'bg-accent-amber-bg border-accent-amber-border';
  return 'bg-accent-red-bg border-accent-red-border';
}

/** Parses a raw HP-editor input string; returns null for NaN/empty/non-positive. */
export function parseHpAmount(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}
