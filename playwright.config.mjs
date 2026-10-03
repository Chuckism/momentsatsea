import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the installed Chrome, so no Playwright browser download is needed.
    // On CI without Chrome, run `npx playwright install chromium` and drop this.
    channel: 'chrome',
    // Day labels are where time-zone bugs show up; US time zones are behind UTC.
    timezoneId: 'America/Chicago',
    // Keep the service worker out of the way so every run hits the fresh build.
    serviceWorkers: 'block',
  },
  webServer: {
    // Build first so tests always run against the current code.
    command: `npx next build && npx serve out -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    // Never test against whatever else is on the port: a stale build, or a
    // server that shuts down mid-run, gives misleading failures.
    reuseExistingServer: false,
  },
});
