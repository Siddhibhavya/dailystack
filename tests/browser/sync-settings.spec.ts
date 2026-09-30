import { expect, test } from './fixture';
const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet-portrait', width: 768, height: 1024 }, { name: 'tablet-landscape', width: 1024, height: 768 }, { name: 'desktop', width: 1440, height: 900 }];
for (const layout of layouts) test(`private sync settings: ${layout.name}`, async ({ page }, testInfo) => {
  await page.setViewportSize(layout);
  await page.goto('/#Settings');
  await expect(page.getByRole('heading', { name: 'My Life account', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to My Life', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'Sync between my devices', exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Journal', exact: true })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Tasks', exact: true }).check();
  await page.reload(); await expect(page.getByRole('switch', { name: 'Tasks', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Journal', exact: true })).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'Google Calendar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`sync-settings-${layout.name}.png`), fullPage: true });
});
test('sync preferences and local task edits work through an offline reload', async ({ page, context }) => {
  await page.goto('/#Settings');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); });
  await context.setOffline(true); await page.reload();
  await page.getByRole('switch', { name: 'Tasks', exact: true }).check();
  await page.getByRole('switch', { name: 'Sync between my devices', exact: true }).check();
  await page.reload(); await expect(page.getByRole('switch', { name: 'Tasks', exact: true })).toBeChecked();
  await page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Offline with sync enabled');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Offline with sync enabled', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Offline with sync enabled', exact: true })).toBeVisible();
});
