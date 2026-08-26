/**
 * Shared building block for the "another browser changed this data" 409
 * conflict message every `*Api.ts` gateway throws (`calendarApi.ts`,
 * `campaignSettingsApi.ts`, `magicItemApi.ts`, `npcApi.ts`, `encounterApi.ts`,
 * `combatLogArchiveApi.ts`), and the pattern
 * `MigrationWizard/migrationCopy.ts`'s `friendlyMigrationMessage` uses to
 * recognize that message and map it to its own specific clean sentence (the
 * mapping used to live in `MigrationWizard.hooks.ts` as
 * `reportFriendlyVerificationError`; the final fix wave moved it so all five
 * wizard error channels share one rule).
 *
 * Deriving both the message text and the recognizing pattern from this one
 * module closes a real regression this task's own sweep introduced and then
 * caught by hand: rewriting a gateway's literal (or the wizard's regex)
 * independently could silently desynchronize them, downgrading a
 * conflict-specific verification failure to the generic fallback message
 * with every existing suite still green, because nothing asserted the two
 * stayed matched. See `familyConflictMessage.test.ts` for the binding test.
 */
export function changedOnAnotherBrowserMessage(label: string): string {
  return `${label} changed on another browser.`;
}

export const CHANGED_ON_ANOTHER_BROWSER_PATTERN = /changed on another browser/i;
