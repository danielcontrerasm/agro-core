import { defineConfig } from '@playwright/test';

const qaPort = process.env.AGRO_QA_WEB_PORT;
const port = qaPort === undefined ? 5173 : Number(qaPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('AGRO_QA_WEB_PORT must be a valid port number.');
}
const baseURL = `http://127.0.0.1:${port}`;
const customChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const watch = process.env.AGRO_QA_WATCH === '1';
const record = process.env.AGRO_QA_RECORD === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'list',
  timeout: watch ? 180_000 : undefined,
  use: {
    baseURL,
    browserName: 'chromium',
    channel: qaPort ? 'chrome' : undefined,
    actionTimeout: watch ? 30_000 : qaPort ? 10_000 : undefined,
    navigationTimeout: watch ? 45_000 : qaPort ? 20_000 : undefined,
    video: record ? 'on' : undefined,
    launchOptions: qaPort
      ? { slowMo: watch ? 700 : process.env.AGRO_QA_WALKTHROUGH === '1' ? 120 : 0 }
      : { executablePath: customChromium },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1100 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !qaPort && !process.env.CI,
  },
});
