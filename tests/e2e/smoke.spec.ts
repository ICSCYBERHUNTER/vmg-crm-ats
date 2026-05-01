import { test, expect } from '@playwright/test'

test('login succeeds', async ({ page }) => {
  // Storage state is already loaded — we should land on dashboard without re-logging in
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
})

test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('TasksWidget appears', async ({ page }) => {
  await page.goto('/dashboard')
  // The TasksWidget section heading (h2, not the nav link)
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
})

test('Candidates page loads', async ({ page }) => {
  await page.goto('/candidates')
  await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible()
})

test('Smart Search page loads', async ({ page }) => {
  await page.goto('/search')
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()
})
