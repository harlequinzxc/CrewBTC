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
    // A fresh context per test, and service workers blocked: the PWA precaches the shell,
    // so a reused profile serves the *previous* build and every measurement silently lies.
    // That is not hypothetical — it produced two identical "before" and "after" runs while
    // this suite was being written.
    serviceWorkers: 'block',
    // NOTE: e2e/offline.spec.ts re-enables the worker via `test.use({ serviceWorkers:
    // 'allow' })`; nothing else may, or the precache serves a stale build.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // A sandbox without Playwright's own download can point at any Chromium it already
        // has. `LD_LIBRARY_PATH` rides along because a statically-fetched build may need
        // its own NSS/NSRP next to it.
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          env: { ...process.env, LD_LIBRARY_PATH: process.env.CHROMIUM_LD_LIBRARY_PATH ?? '' },
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--in-process-gpu',
            // No `--single-process`: it makes the browser die between tests when several
            // pages share one process, which reads as an app failure and is not one.
            '--use-gl=swiftshader',
            '--disable-features=Vulkan',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
