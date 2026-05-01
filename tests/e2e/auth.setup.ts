import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { STORAGE_STATE } from '../../playwright.config'

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set in .env.local'
    )
  }

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Login redirects to /candidates
  await page.waitForURL('**/candidates', { timeout: 20_000 })
  await expect(page).toHaveURL(/\/candidates/)

  mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  await page.context().storageState({ path: STORAGE_STATE })
})
