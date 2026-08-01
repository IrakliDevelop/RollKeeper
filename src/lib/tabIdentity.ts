/** Stable identity for this tab for the lifetime of the JS context.
 * Used as the intent sender id and the lastMutatedBy stamp. */
export const TAB_ID: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
