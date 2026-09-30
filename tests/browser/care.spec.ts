import { expect, test } from './fixture';
test('memo items and care logs are fast and durable offline', async ({ page, context }) => {
 await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/#Projects');
 await page.getByRole('button', { name: 'Checklist', exact: true }).click(); await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Portfolio'); await page.getByRole('button', { name: 'Add checklist', exact: true }).click();
 await page.getByRole('button', { name: 'Add item to Portfolio', exact: true }).click(); await page.getByRole('textbox', { name: 'New item for Portfolio' }).fill('Research'); await page.getByRole('button', { name: 'Save item for Portfolio', exact: true }).click(); await page.getByRole('checkbox', { name: 'Complete Research', exact: true }).check(); await expect(page.getByRole('checkbox', { name: 'Complete Portfolio', exact: true })).not.toBeChecked();
 await page.goto('/#Today'); await page.getByRole('button', { name: 'Log a glass' }).click(); await expect(page.getByText('1 glass logged today.')).toBeVisible();
 await page.getByRole('button', { name: 'Log something' }).click(); await page.locator('.log-options').getByRole('button', { name: /Food/ }).click(); await page.getByRole('textbox', { name: 'What did you have?' }).fill('Toast'); await page.getByRole('button', { name: 'Save meal' }).click(); await expect(page.locator('dialog')).not.toBeVisible();
 await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await context.setOffline(true); await page.reload(); await expect(page.getByText('1 glass logged today.')).toBeVisible(); await page.goto('/#Projects'); await expect(page.getByRole('checkbox', { name: 'Complete Research', exact: true })).toBeChecked();
});
