import type { BrowserContext, Page } from '@playwright/test';

/** A 1×1 PNG served for the synthetic map fixtures (PR06 review F1). */
export const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Table spec context guard (PR06 review F1): serves a real image for the
 * fixtures' `/synthetic-map.webp` (the Table ensures the scene's map image,
 * so a 404 would surface as an uncaught canvas render error) and records
 * every uncaught page error, which the spec asserts empty before closing.
 * Errors on `about:blank` come from the specs' own init scripts reading
 * localStorage before navigation and are not application errors.
 */
export async function guardTableContext(
  context: BrowserContext
): Promise<string[]> {
  await context.route('**/synthetic-map.webp', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: FIXTURE_PNG })
  );
  const errors: string[] = [];
  const watch = (page: Page) =>
    page.on('pageerror', error => {
      if (page.url() === 'about:blank') return;
      errors.push(`${page.url()}: ${String(error)}`);
    });
  context.pages().forEach(watch);
  context.on('page', watch);
  return errors;
}
