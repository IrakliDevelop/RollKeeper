import { expect, test } from '@playwright/test';

test('stages a full-device bundle inactive and preserves collisions during explicit restore', async ({
  page,
}) => {
  await page.goto('/player');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('rollkeeper-slice2-fixture', 'source-opaque');
    localStorage.setItem('location-canvas-slice2', ' {"unicode":"雪🐉"}\n');
    localStorage.setItem('unrelated-slice2-key', 'keep-me');
  });
  await page.reload();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download browser backup' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  await page.evaluate(() => {
    localStorage.setItem('rollkeeper-slice2-fixture', 'active-divergent');
    localStorage.removeItem('location-canvas-slice2');
  });
  await page
    .locator('input[accept="application/json,.json"]')
    .setInputFiles(downloadPath!);

  await expect(
    page.getByRole('heading', { name: 'Recovery preview' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Restore selected entries' })
  ).toBeDisabled();

  const inactiveStatus = await page.evaluate(async () => {
    const request = indexedDB.open('rollkeeper-recovery', 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('generations', 'readonly');
    const generationsRequest = transaction.objectStore('generations').getAll();
    const generations = await new Promise<Array<{ status: string }>>(
      (resolve, reject) => {
        generationsRequest.onsuccess = () => resolve(generationsRequest.result);
        generationsRequest.onerror = () => reject(generationsRequest.error);
      }
    );
    database.close();
    return generations.at(-1)?.status;
  });
  expect(inactiveStatus).toBe('inactive');

  await page.getByRole('button', { name: 'Activate generation' }).click();
  await expect(
    page.getByRole('button', { name: 'Generation active' })
  ).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restore selected entries' }).click();
  await expect(page.getByText(/Restored 1;/)).toBeVisible();

  const values = await page.evaluate(() => ({
    collision: localStorage.getItem('rollkeeper-slice2-fixture'),
    restored: localStorage.getItem('location-canvas-slice2'),
    unrelated: localStorage.getItem('unrelated-slice2-key'),
  }));
  expect(values).toEqual({
    collision: 'active-divergent',
    restored: ' {"unicode":"雪🐉"}\n',
    unrelated: 'keep-me',
  });
});
