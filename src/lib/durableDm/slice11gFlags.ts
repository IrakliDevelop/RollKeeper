export function isMigrationWizardVisible() {
  return process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE === 'true';
}

/** The wizard replaces the older per-section migration setup cards. */
export function areStandaloneMigrationControlsVisible() {
  return !isMigrationWizardVisible();
}
