import { test, expect } from '@playwright/test'

test('homepage has title and login link', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/CreditCareConnect/)
  await expect(page.getByText('Admin Login')).toBeVisible()
})
