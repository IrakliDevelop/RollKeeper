import { expect, test } from '@playwright/test';

const DM_RAW =
  '{"state":{"campaigns":[{"id":"slice9-dm-untouched"}]},"version":1}';
const SELECTION_KEY = 'rollkeeper:indexeddb-selection:guest:character';

test('deployment flag alone leaves the control profile local-only and makes zero automatic RPC calls', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(dmRaw => {
    localStorage.setItem('rollkeeper-dm-data', dmRaw);
  }, DM_RAW);
  const page = await context.newPage();
  const automaticRpcRequests: string[] = [];
  page.on('request', request => {
    if (/\/rest\/v1\/rpc\/(put|soft_delete)_character/.test(request.url())) {
      automaticRpcRequests.push(request.method());
    }
  });

  await page.goto('/player');
  await expect(
    page.getByRole('heading', { name: /automatic character sync/i })
  ).toBeVisible();
  await expect(
    page.getByText(/complete the explicit character indexeddb cutover/i)
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /manual cloud backup/i })
  ).toHaveCount(0);

  const createdId = await page.evaluate(() =>
    window.__rkStores!.player.getState().createCharacter('Slice 9 Control')
  );
  await expect(
    page.getByRole('heading', { name: 'Slice 9 Control' })
  ).toBeVisible();
  await expect(page.getByText('Cloud: local only')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /enable automatic sync for slice 9 control/i,
    })
  ).toBeDisabled();

  const secondPage = await context.newPage();
  await secondPage.goto('/player');
  await expect(
    secondPage.getByRole('heading', { name: 'Slice 9 Control' })
  ).toBeVisible();
  await secondPage.reload();
  await expect(
    secondPage.getByRole('heading', { name: 'Slice 9 Control' })
  ).toBeVisible();

  const evidence = await secondPage.evaluate(
    ({ selectionKey, characterId }) => ({
      selection: localStorage.getItem(selectionKey),
      characterPresent: window
        .__rkStores!.player.getState()
        .characters.some(character => character.id === characterId),
      dmRaw: localStorage.getItem('rollkeeper-dm-data'),
    }),
    { selectionKey: SELECTION_KEY, characterId: createdId }
  );
  expect(evidence).toEqual({
    selection: null,
    characterPresent: true,
    dmRaw: DM_RAW,
  });
  expect(automaticRpcRequests).toEqual([]);
  await context.close();
});
