import { afterEach, describe, expect, it } from 'vitest';

import { isMigrationWizardVisible } from '../slice11gFlags';

const original = process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;

afterEach(() => {
  process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = original;
});

describe('isMigrationWizardVisible', () => {
  it('is off when the flag is unset', () => {
    delete process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE;
    expect(isMigrationWizardVisible()).toBe(false);
  });

  it('is off for any value other than the exact string "true"', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'TRUE';
    expect(isMigrationWizardVisible()).toBe(false);
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = '1';
    expect(isMigrationWizardVisible()).toBe(false);
  });

  it('is on for the exact string "true"', () => {
    process.env.NEXT_PUBLIC_MIGRATION_WIZARD_VISIBLE = 'true';
    expect(isMigrationWizardVisible()).toBe(true);
  });
});
