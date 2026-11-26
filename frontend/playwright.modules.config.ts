import { defineConfig } from '@playwright/test';

const port = Number(process.env.AGRO_MODULE_PORT ?? '5198');
const baseURL = 'http://127.0.0.1:' + port;
const pause = Number(process.env.AGRO_MODULE_PAUSE_MS ?? '12000');
const speed = Number(process.env.AGRO_MODULE_ACTION_MS ?? '350');
const viewport = { width: 1440, height: 900 };

export default defineConfig({
  testDir: './qa/modules',
  outputDir: process.env.AGRO_MODULE_RESULTS ?? './test-results/modulos-locales',
  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: process.env.AGRO_MODULE_HTML ?? './playwright-report/modulos-locales', open: 'never' }],
    ['json', { outputFile: process.env.AGRO_MODULE_JSON ?? './test-results/modulos-locales.json' }],
  ],
  timeout: 90_000 + 12 * (pause + 12 * speed),
  use: {
    baseURL,
    channel: 'chrome',
    viewport,
    headless: process.env.AGRO_MODULE_HEADLESS === '1',
    actionTimeout: 12_000,
    launchOptions: { slowMo: speed },
    video: { mode: 'on', size: viewport },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port ' + port + ' --strictPort',
    url: baseURL,
  },
});
