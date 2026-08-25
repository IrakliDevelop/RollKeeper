import type { CloudActivationConflictReason } from '@/lib/durableDm/durableFamilyAdapter';
import { CHANGED_ON_ANOTHER_BROWSER_PATTERN } from '@/lib/durableDm/familyConflictMessage';

/**
 * The one place the migration wizard turns INTERNAL text into product copy.
 *
 * Two hazards live here, both found by the final whole-branch review and both
 * confirmed on a real browser by the manual gate:
 *
 *  - **F1** — `activateCloud` refuses with a `CloudActivationConflictReason`
 *    discriminant (`'cloud-generation-diverged'` and its three siblings).
 *    `FamilyStep` used to render that token verbatim under the
 *    "Saved only in this browser" heading. It is not an R17 forbidden word,
 *    which is why the vocabulary sweep missed it — it is simply an internal
 *    union member shown to a DM at the highest-stress moment of the flow.
 *  - **F4 / gate defect D2** — a rejected `previewManifest`, selection-record
 *    read, family run or authority repair used to render `Error.message`
 *    straight through. The gate saw the browser's own `"Failed to fetch"` on
 *    screen. `MigrationWizard.hooks.ts` already closed exactly this hole for
 *    `verifyCloud`; the other four channels are closed here, by the same
 *    mechanism, so there is one rule rather than two.
 *
 * Scope, stated exactly, because the first version of this comment claimed
 * platform text "cannot reach the DOM now" while three render paths outside
 * the family step still passed `Error.message` through (scoped re-review
 * N1): every channel below covers the WHOLE wizard — step 0's workspace
 * discovery and step 1's browser-backup file and record paths included, not
 * just the family step. A blocked IndexedDB (a private window) rejects
 * discovery with a raw `DOMException` before the family step is ever
 * reached, so that step is the one that would have shown platform text
 * first.
 *
 * The raw text is never lost — every mapping below logs it to `console.error`
 * first. It is only kept out of the rendered alert.
 */

/**
 * Product copy for each internal cloud-activation refusal. Keyed by the closed
 * union so adding a member to `CloudActivationConflictReason` without adding
 * its copy is a type error, not a silently-unmapped token on screen.
 *
 * R17 vocabulary: "browser", "campaign data" / "data category", "cloud sync".
 * No "device", no "family", no storage-engine names.
 */
const CLOUD_ACTIVATION_FAILURE_COPY: Record<
  CloudActivationConflictReason,
  string
> = {
  'cloud-generation-diverged':
    'Cloud sync already holds a different copy of this campaign data — most likely it was moved from another browser. Nothing here was changed. Check that other browser before moving this data category again.',
  'cloud-epoch-unknown':
    'Cloud sync did not report where this campaign data now lives, so this browser stopped instead of guessing. Nothing here was changed. Try this data category again in a moment.',
  'cloud-epoch-unexpected':
    'Cloud sync moved this campaign data on while this run was in progress, so this browser stopped rather than overwrite it. Nothing here was changed. Close the wizard, reopen it and try this data category again.',
  'cloud-preview-unusable':
    'Cloud sync answered about this campaign data in a way this browser could not read, so nothing was changed. Try this data category again in a moment.',
};

/**
 * The sentence shown when the refusal reason is not one this build knows —
 * a newer server, or a caller passing something outside the union. It is
 * deliberately the same shape as the mapped ones, so an unknown token can
 * never fall through to being rendered verbatim.
 */
const UNKNOWN_CLOUD_ACTIVATION_FAILURE_COPY =
  'This campaign data could not be moved to cloud sync just now. Nothing here was changed. Try this data category again in a moment.';

/**
 * Maps an internal cloud-activation refusal to the DM-facing sentence.
 *
 * Takes `string` rather than the union on purpose: the union is what the
 * TYPE system pins (so a stub cannot fake polished prose), while this
 * signature keeps the function total at runtime, so no value whatsoever can
 * reach the DOM unmapped.
 */
export function cloudActivationFailureMessage(reason: string): string {
  if (
    Object.prototype.hasOwnProperty.call(CLOUD_ACTIVATION_FAILURE_COPY, reason)
  )
    return CLOUD_ACTIVATION_FAILURE_COPY[
      reason as CloudActivationConflictReason
    ];
  console.error(
    '[MigrationWizard] unmapped cloud activation refusal reason:',
    reason
  );
  return UNKNOWN_CLOUD_ACTIVATION_FAILURE_COPY;
}

/**
 * Which rendered surface an unvetted `Error.message` was about to reach.
 * Each channel has its own fallback sentence, so the DM still learns which
 * step failed even though the technical detail stays in the console.
 */
export type MigrationErrorChannel =
  /** `adapter.previewManifest` rejected. */
  | 'preview'
  /** `openRollkeeperDatabase` / `readFamilySelection` / `readFamilyPreparedState` rejected. */
  | 'browserRecord'
  /** The typed-confirmation run (`runFamily`) rejected. */
  | 'run'
  /** `adapter.repairAuthority` refused. */
  | 'repair'
  /** `adapter.verifyCloud` rejected (the channel that was already hardened). */
  | 'verify'
  /**
   * Owner-workspace discovery (`createBrowserDmWorkspace` / `list()`)
   * rejected. Step 0, the FIRST thing a DM sees — and the step the gate's
   * own blocked-IndexedDB scenario reaches before any other, because
   * `list()` is IndexedDB-backed and rejects with a raw `DOMException`
   * there.
   */
  | 'discovery'
  /**
   * Reading the picked browser-backup file back (`File.text()` —
   * `NotReadableError`, another raw `DOMException`) or verifying it
   * against this browser rejected.
   */
  | 'backupFile'
  /** Re-checking / enriching this browser's stored backup record rejected. */
  | 'backupRecord';

const CHANNEL_FALLBACK_COPY: Record<MigrationErrorChannel, string> = {
  preview:
    'This data category could not be previewed just now. Nothing here was changed. Try again, or skip this one and come back to it.',
  browserRecord:
    "This browser's record for this data category could not be checked just now. Nothing here was changed. Try again, or skip this one and come back to it.",
  run: 'This data category could not be moved to cloud sync just now. Your campaign data is still here in this browser. Try again, or skip this one and come back to it.',
  repair:
    "This browser's record could not be fixed automatically. Nothing here was changed. Skip this data category for now — your campaign data is still here in this browser.",
  verify: 'This data category could not be checked just now.',
  discovery:
    'Your cloud workspaces could not be looked up just now. Nothing in this browser was changed. Try Find my campaigns again in a moment.',
  backupFile:
    'This browser could not read that file, or it was saved from different campaign data.',
  backupRecord:
    "This browser's backup could not be checked just now. Nothing here was changed. Try again in a moment.",
};

const CHANNEL_CHANGED_ELSEWHERE_COPY: Record<MigrationErrorChannel, string> = {
  preview:
    'This data category changed somewhere else while this browser was reading it. Try again.',
  browserRecord:
    'This data category changed somewhere else while this browser was checking it. Try again.',
  run: 'This data category changed somewhere else while this browser was moving it. Nothing here was changed. Try again.',
  repair:
    'This data category changed somewhere else while this browser was checking it. Try again.',
  // Unchanged from the sentence `reportFriendlyVerificationError` shipped
  // with — the report step's Refresh control is what "Try Refresh again"
  // names, and only this channel has one.
  verify:
    'This data category changed somewhere else while this browser was checking it. Try Refresh again.',
  discovery:
    'Your cloud workspaces changed somewhere else while this browser was looking them up. Try Find my campaigns again.',
  backupFile:
    'This campaign changed somewhere else while this browser was checking that file. Download a fresh browser backup and pick that one up instead.',
  backupRecord:
    'This campaign changed somewhere else while this browser was checking its backup. Try again.',
};

/**
 * Turns any rejection into vetted product copy.
 *
 * Everything that is not the recognised "changed on another browser" class
 * (produced by all six `*Api` gateways on HTTP 409, and recognised through
 * `CHANGED_ON_ANOTHER_BROWSER_PATTERN` — the same module, so producer and
 * consumer cannot silently desynchronise) becomes that channel's fallback
 * sentence. This is deliberately fail-closed: an adapter sentence that IS
 * good product copy today is generalised along with everything else, because
 * no mechanism distinguishes it from a `DOMException` at this boundary, and
 * showing unvetted platform text is the worse failure.
 */
export function friendlyMigrationMessage(
  channel: MigrationErrorChannel,
  reason: unknown
): string {
  const raw = reason instanceof Error ? reason.message : String(reason);
  // Deliberate: the technical detail belongs in the console, never in the
  // rendered alert (see the module doc comment above).
  console.error(`[MigrationWizard] ${channel} failed:`, raw);
  if (CHANGED_ON_ANOTHER_BROWSER_PATTERN.test(raw))
    return CHANNEL_CHANGED_ELSEWHERE_COPY[channel];
  return CHANNEL_FALLBACK_COPY[channel];
}
