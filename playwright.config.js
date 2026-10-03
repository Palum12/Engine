import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

// Keep downloaded browser binaries and reports inside the project.
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.cache/playwright');
const temporaryPath = resolve('.cache/tmp');
mkdirSync(temporaryPath, { recursive: true });
Object.assign(process.env, { TEMP: temporaryPath, TMP: temporaryPath, TMPDIR: temporaryPath });
export default defineConfig({
  testDir: './tests', testMatch: 'browser.spec.js', workers: 1,
  timeout: 180_000, outputDir: 'artifacts/browser',
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 }
});
