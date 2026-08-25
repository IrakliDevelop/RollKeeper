/**
 * Maps an internal manifest-blocker `kind` discriminant to display-safe text
 * for the muted "Reference detail" line every sync card renders next to
 * `blocker.detail` (e.g. `CombatLogArchiveSyncControls/index.tsx`'s
 * `{blocker.kind}: {blocker.detail}`). Render-site only: the underlying
 * `kind` value itself is untouched everywhere else -- `blockers.find(b =>
 * b.kind === 'active-encounter')`, the React `key`, and every other
 * comparison keep using the real value from `durableDm/*Family.ts`; only
 * this one rendered string changes.
 *
 * `'oversized-family'` is the sole kind that fails spec R17 (it literally
 * contains "family" -- \bfamil(?:y|ies)\b matches it, hyphen before, colon
 * after). Every other kind (`'active-encounter'`, `'incomplete-envelope'`,
 * `'malformed-json'`, `'legacy-schema'`, `'future-schema'`,
 * `'oversized-record'`, `'too-many-records'`, ...) already reads as clean
 * copy and passes through unchanged.
 */
export function blockerKindReferenceLabel(kind: string): string {
  return kind === 'oversized-family' ? 'oversized-batch' : kind;
}
