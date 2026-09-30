import { test as base, expect } from '@playwright/test';
export { expect };
/** Existing-feature tests begin with a completed real local onboarding flow. */
export const test = base.extend({ page: async ({ page }, use) => {
 await page.goto('/'); await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Get started', exact: true }).click(); await page.getByRole('button', { name: 'Continue on this device' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Food', exact: true }).click(); await page.getByRole('button', { name: 'Hydration', exact: true }).click(); await page.getByRole('button', { name: 'Me time', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Start My Life', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Hi, you.' })).toBeVisible(); await use(page);
} });
