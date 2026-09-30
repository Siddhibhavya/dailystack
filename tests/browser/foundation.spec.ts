import { test, expect } from './fixture';
const layouts = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];
for (const layout of layouts) test(`responsive navigation and tasks: ${layout.name}`, async ({ page }, testInfo) => {
  await page.setViewportSize(layout);
  await page.route('https://accounts.google.com/**', route => route.abort());
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'A few priorities' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
  await expect(nav.getByRole('link')).toHaveCount(5);
  const pos = await nav.evaluate(element => getComputedStyle(element).position);
  expect(pos).toBe(layout.width <= 600 ? 'fixed' : 'static');
  await page.screenshot({ path: testInfo.outputPath(`${layout.name}.png`), fullPage: true });
  await nav.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Draw for a while');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Draw for a while', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start timer: Draw for a while', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timer: Draw for a while', exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByRole('button', { name: 'Pause timer: Draw for a while', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Complete Draw for a while', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Complete Draw for a while', exact: true })).toBeChecked();
  for (const name of ['Calendar', 'Journal', 'Insights', 'Today']) { await nav.getByRole('link', { name, exact: true }).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  expect(errors).toEqual([]);
});
test('legacy migration, recovery export, and offline reload', async ({ page, context }) => {
  await page.route('https://accounts.google.com/**', route => route.abort());
  const raw = JSON.stringify([{ id: 100, text: 'Old task', done: false, elapsedSeconds: 90 }]);
  await page.addInitScript(value => { if (!localStorage.getItem('dailystack_widget_todos')) localStorage.setItem('dailystack_widget_todos', value); }, raw);
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Your Daily Stack tasks are here.' })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export original tasks' }).click(); expect((await download).suggestedFilename()).toBe('dailystack-before-migration.json');
  await page.getByRole('button', { name: 'Back up & import tasks' }).click();
  await expect(page.getByRole('status')).toContainText('1 tasks imported and verified');
  expect(await page.evaluate(() => localStorage.getItem('dailystack_widget_todos'))).toBe(raw);
  await page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('button', { name: 'Old task', exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); });
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('button', { name: 'Old task', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Offline task'); await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Offline task', exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('button', { name: 'Offline task', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await caches.keys()).every(key => key.startsWith('my-life-app-')))).toBe(true);
});
