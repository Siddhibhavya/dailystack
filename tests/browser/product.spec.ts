import { expect, test } from './fixture';
test('morning journal, confirmed suggestions and actual activities survive offline reload', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: /Write instead/ }).click();
  await page.getByRole('textbox', { name: 'Your words' }).fill("I'm tired. I need to buy a notebook.");
  await page.getByRole('button', { name: 'Save journal', exact: true }).click();
  await expect(page.getByText("I'm tired. I need to buy a notebook.", { exact: true })).toBeVisible();
  const suggestion = page.locator('.suggestion-list').getByRole('button', { name: 'Confirm' });
  await expect(suggestion).toHaveCount(2); await suggestion.last().click();
  await page.getByRole('button', { name: 'Log something' }).click();
  await page.getByRole('button', { name: /Something I did/ }).click();
  await page.getByRole('textbox', { name: 'What happened?' }).fill('A walk');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await page.goto('/#Timeline'); await expect(page.getByText('A walk', { exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(r => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true })); });
  await context.setOffline(true); await page.reload(); await expect(page.getByText('A walk', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByText("I'm tired. I need to buy a notebook.", { exact: true })).toBeVisible();
});
