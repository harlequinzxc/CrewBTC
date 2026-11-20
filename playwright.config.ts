import { defineConfig, devices } from '@playwright/test'

/**
 * Real-browser proof.
 *
 * Every bug this suite exists for was invisible to jsdom: a click swallowed by an element
 * that mounted between press and release, a `focus()` that scrolled the canvas, a
 * formatting bar that took 32px of height the moment editing began. jsdom has no layout
 * and no default browser behaviour, so it cannot see any of them.
 *
 * The web server is the **preview build**, not the dev server: the failures are all in
 * production CSS and production timing, and a dev-only pass would not mean anything.
 */
export default defineConfig({
  testDir: './e2e',
  // A stateful app is tested serially: two workers racing over one IndexedDB snapshot
  // restore each other's batches and the failures are unreproducible.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
