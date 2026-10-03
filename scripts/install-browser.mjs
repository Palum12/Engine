import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const browserPath = resolve('.cache/playwright');
const temporaryPath = resolve('.cache/tmp');
mkdirSync(temporaryPath, { recursive: true });
const result = spawnSync(process.execPath, [resolve('node_modules/playwright/cli.js'), 'install', 'chromium'], {
  cwd: resolve('.'), stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath, TMP: temporaryPath, TEMP: temporaryPath, TMPDIR: temporaryPath }
});
process.exit(result.status ?? 1);
