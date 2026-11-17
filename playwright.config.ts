import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173', channel: 'chrome' },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/demo/index.html',
    reuseExistingServer: true,
  },
});
