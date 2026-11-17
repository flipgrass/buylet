import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e-platform',
  use: {
    baseURL: 'http://localhost:4174',
    channel: 'chrome',
    // Test-only: Chrome's Local Network Access check denies any cross-origin request to
    // loopback in headless runs. Real embeds load from a public https host. CORS/CORP still apply.
    launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks'] },
  },
  webServer: {
    command: 'node server/index.ts',
    env: { PORT: '4174', DB_PATH: ':memory:' },
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
  },
});
