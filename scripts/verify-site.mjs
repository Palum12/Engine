import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Expected preset data is read by Node only. The browser uses the public UI.
import { CAR_PRESETS } from '../src/car-presets.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const within = (root, path) => {
  const child = relative(root, path);
  return child !== '' && child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(child);
};
const usage = 'node scripts/verify-site.mjs --url https://palum12.github.io/Engine/ [--output artifacts/site-qa] [--expected-dist dist]';
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const option = process.argv[index];
  if (option === '--help') { console.log(usage); process.exit(0); }
  if (!['--url', '--output', '--expected-dist'].includes(option) || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw Error(`Invalid argument ${option}. Usage: ${usage}`);
  if (options[option]) throw Error(`Duplicate argument ${option}`);
  options[option] = process.argv[++index];
}
if (!options['--url']) throw Error(`--url is required. Usage: ${usage}`);
const target = new URL(options['--url']);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw Error('--url must be an HTTP(S) URL without credentials');
const output = resolve(projectRoot, options['--output'] || 'artifacts/site-qa');
if (!within(resolve(projectRoot, 'artifacts'), output)) throw Error('--output must be a directory underneath this project\'s artifacts/');
const expectedDist = options['--expected-dist'] ? resolve(projectRoot, options['--expected-dist']) : null;
const expectedHtml = expectedDist ? await readFile(resolve(expectedDist, 'index.html'), 'utf8') : null;
const cache = resolve(projectRoot, '.cache');
const temporaryPath = resolve(cache, 'tmp');
await Promise.all([mkdir(output, { recursive: true }), mkdir(temporaryPath, { recursive: true }), mkdir(resolve(cache, 'downloads'), { recursive: true })]);
Object.assign(process.env, { PLAYWRIGHT_BROWSERS_PATH: resolve(cache, 'playwright'), TEMP: temporaryPath, TMP: temporaryPath, TMPDIR: temporaryPath });
const { chromium, expect: baseExpect } = await import('@playwright/test');
const expect = baseExpect.configure({ timeout: 45_000 });

const report = {
  url: target.href, expectedDist, startedAt: new Date().toISOString(),
  environment: 'Chromium SwiftShader; functional and render-idle checks, no FPS measurement',
  checks: [], consoleErrors: [], pageErrors: [], httpErrors: [], requestFailures: [], externalRequests: [], assets: [],
};
const responses = new Map();
let browser, page, collecting = true, fatalError;
const errorDetails = error => ({ message: error.message || String(error), stack: error.stack || null });
const fileName = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const drawCount = () => page.evaluate(() => window.__siteQaDraws || 0);

async function diagnostics() {
  if (!page || page.isClosed()) return null;
  return page.evaluate(() => {
    const value = selector => document.querySelector(selector)?.value;
    const text = selector => document.querySelector(selector)?.textContent;
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight },
      scene: { ...document.querySelector('#scene')?.dataset }, preset: value('#car-preset'), transmission: value('#transmission-type'),
      pauseLabel: document.querySelector('#pause')?.getAttribute('aria-label'), rpm: text('#rpm'), speed: text('#speed'),
      quickGear: value('#quick-gear'), ratio: text('#ratio-label'), driveStatus: text('#drive-status'),
      automaticState: text('#automatic-state'), hybridState: text('#hybrid-state'), drawInvocations: window.__siteQaDraws || 0 };
  });
}

async function check(name, run) {
  const result = { name, startedAt: new Date().toISOString() };
  const started = performance.now();
  try {
    const details = await run();
    Object.assign(result, { status: 'passed', details: details ?? null });
    console.log(`PASS ${name}`);
  } catch (error) {
    Object.assign(result, { status: 'failed', error: errorDetails(error) });
    try { result.ui = await diagnostics(); } catch (diagnosticError) { result.diagnosticError = errorDetails(diagnosticError); }
    try {
      result.screenshot = `${fileName(name)}-failure.png`;
      await page?.screenshot({ path: resolve(output, result.screenshot), fullPage: true, timeout: 30_000 });
    } catch (screenshotError) { result.screenshotError = errorDetails(screenshotError); }
    console.error(`FAIL ${name}: ${error.message}`);
  }
  result.durationMs = Math.round(performance.now() - started);
  report.checks.push(result);
  return result.status === 'passed';
}

async function setPaused(paused = true) {
  const button = page.locator('#pause');
  const currentlyPaused = (await button.getAttribute('aria-label'))?.startsWith('Wznów');
  if (currentlyPaused !== paused) await button.click();
  await expect(button).toHaveAttribute('aria-label', paused ? 'Wznów symulację' : 'Wstrzymaj symulację');
}

async function setRange(selector, value) {
  await page.locator(selector).evaluate((input, next) => {
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function waitForIdle(timeout = 45_000) {
  let previous = await drawCount(), unchanged = 0;
  await expect.poll(async () => {
    const current = await drawCount();
    unchanged = current === previous ? unchanged + 1 : 0;
    previous = current;
    return unchanged;
  }, { timeout, intervals: [500], message: 'WebGL draw invocations should stop after camera movement settles' }).toBeGreaterThanOrEqual(3);
  return previous;
}

async function screenshot(name) {
  await setPaused();
  await page.locator('#scene canvas').scrollIntoViewIfNeeded();
  await waitForIdle();
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, timeout: 45_000 });
}

async function preset(id) {
  await page.locator('#car-preset').selectOption(id);
  await expect(page.locator('#car-preset')).toHaveValue(id);
  await setPaused();
}

async function publicAssets() {
  const actual = await page.evaluate(() => ({
    url: location.href,
    references: [...document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]')].map(element => element.src || element.href),
    resources: performance.getEntriesByType('resource').map(entry => entry.name),
  }));
  for (const resource of [...actual.references, ...actual.resources]) {
    if (/^https?:/.test(resource)) assert.equal(new URL(resource).origin, new URL(actual.url).origin, `Remote asset: ${resource}`);
  }
  assert.ok(actual.references.some(reference => /\.js(?:\?|$)/.test(reference)), 'The built application JavaScript is loaded');
  assert.ok(actual.references.some(reference => /\.css(?:\?|$)/.test(reference)), 'The built application stylesheet is loaded');
  if (!expectedHtml) return { references: actual.references, exactBuildComparison: 'not requested' };

  const expected = [];
  for (const tag of expectedHtml.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const source = /\b(?:src|href)=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!source || !(/<script/i.test(tag) || /\brel=["'](?:stylesheet|modulepreload)["']/i.test(tag))) continue;
    const url = new URL(source, actual.url);
    assert.equal(url.origin, new URL(actual.url).origin, `Expected asset must be local: ${url.href}`);
    assert.ok(actual.references.includes(url.href), `Deployed index does not reference expected asset ${url.href}`);
    assert.equal(responses.get(url.href), 200, `Browser did not load expected asset successfully: ${url.href}`);
    const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    let local;
    for (let offset = 0; offset < segments.length; offset++) {
      const candidate = resolve(expectedDist, ...segments.slice(offset));
      if (!within(expectedDist, candidate)) continue;
      try { local = { path: candidate, body: await readFile(candidate) }; break; } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    }
    assert.ok(local, `Expected asset cannot be found in ${expectedDist}: ${source}`);
    const response = await page.request.get(url.href, { timeout: 60_000 });
    assert.equal(response.status(), 200, `Asset fetch failed: ${url.href}`);
    const digest = buffer => createHash('sha256').update(buffer).digest('hex');
    const localSha256 = digest(local.body), deployedSha256 = digest(await response.body());
    report.assets.push({ url: url.href, localPath: local.path, localSha256, deployedSha256, status: response.status() });
    assert.equal(deployedSha256, localSha256, `Deployed asset differs from the local build: ${url.href}`);
    expected.push(url.href);
  }
  assert.ok(expected.length >= 2, 'Expected dist/index.html must contain JavaScript and CSS');
  return { expected, references: actual.references, exactBuildComparison: 'SHA-256 matches' };
}

try {
  browser = await chromium.launch({ headless: true, downloadsPath: resolve(cache, 'downloads'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(90_000);
  page.on('pageerror', error => { if (collecting) report.pageErrors.push(errorDetails(error)); });
  page.on('console', message => { if (collecting && message.type() === 'error') report.consoleErrors.push({ message: message.text(), location: message.location() }); });
  page.on('response', response => {
    if (!collecting) return;
    responses.set(response.url(), response.status());
    if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status(), resourceType: response.request().resourceType() });
  });
  page.on('requestfailed', request => { if (collecting) report.requestFailures.push({ url: request.url(), resourceType: request.resourceType(), failure: request.failure() }); });
  page.on('request', request => {
    if (collecting && /^https?:/.test(request.url()) && new URL(request.url()).origin !== target.origin) report.externalRequests.push({ url: request.url(), resourceType: request.resourceType() });
  });
  await page.addInitScript(() => {
    window.__siteQaDraws = 0;
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue;
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const descriptor = Object.getOwnPropertyDescriptor(Context.prototype, name);
        if (typeof descriptor?.value !== 'function') continue;
        const original = descriptor.value;
        Object.defineProperty(Context.prototype, name, { ...descriptor, value(...args) { window.__siteQaDraws++; return original.apply(this, args); } });
      }
    }
  });

  const loaded = await check('HTTP 200 and usable WebGL application', async () => {
    const response = await page.goto(target.href, { waitUntil: 'load' });
    assert.equal(response?.status(), 200, 'The main document must return HTTP 200');
    report.resolvedUrl = page.url();
    await expect(page.locator('#scene canvas')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('.webgl-fallback')).toHaveCount(0);
    await expect(page.locator('#scene')).toHaveAttribute('data-view', 'drive-detail');
    await expect.poll(drawCount, { timeout: 90_000 }).toBeGreaterThan(0);
    await page.locator('#render-quality').selectOption('economy');
    await setPaused();
    return { status: response.status(), title: await page.title(), url: page.url() };
  });
  if (!loaded) throw Error('Application failed to load; dependent interaction checks were not run');
  await check('Local assets and expected production build', publicAssets);

  await check('Paused WebGL sleeps and zoom wakes drawing', async () => {
    await preset('ibiza-mpi-2016');
    await page.locator('.view-tab[data-view="cylinder"]').click();
    const before = await waitForIdle();
    await page.waitForTimeout(800);
    assert.equal(await drawCount(), before, 'Paused rendering continued while the UI was untouched');
    const angle = await page.locator('#angle-readout').textContent();
    await page.locator('#zoom-in').click();
    await expect.poll(drawCount).toBeGreaterThan(before);
    await waitForIdle();
    assert.equal(await page.locator('#angle-readout').textContent(), angle, 'Camera zoom advanced the paused engine cycle');
    await screenshot('paused-cylinder-zoom');
    return { idleDrawInvocations: before, drawInvocationsAfterZoom: await drawCount(), pausedAngle: angle };
  });

  const views = ['engine', 'cylinder', 'drive-detail', 'clutch', 'gearbox', 'differential', 'hybrid', 'suspension'];
  await check('Eight navigation views are available', async () => {
    assert.deepEqual(await page.locator('.view-tab').evaluateAll(buttons => buttons.map(button => button.dataset.view)), views);
  });
  await preset('ibiza-mpi-2016');
  for (const view of views) await check(`View ${view}`, async () => {
    await page.locator(`.view-tab[data-view="${view}"]`).click();
    await expect(page.locator('#scene')).toHaveAttribute('data-view', view);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('.webgl-fallback')).toHaveCount(0);
    await screenshot(`view-${view}`);
  });

  await check('Every factory preset is present', async () => {
    const available = await page.locator('#car-preset option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
    assert.deepEqual(available, CAR_PRESETS.map(entry => entry.id));
  });
  for (const car of CAR_PRESETS) await check(`Preset ${car.id}`, async () => {
    await preset(car.id);
    for (const [attribute, value] of Object.entries({ engine: car.engineId, transmission: car.transmission, drive: car.driveLayout, 'engine-orientation': car.engineOrientation, 'engine-placement': car.enginePlacement })) {
      await expect(page.locator('#scene')).toHaveAttribute(`data-${attribute}`, value);
    }
    await expect(page.locator('#car-preset-summary')).toContainText(car.name);
    await page.locator('[data-camera="top"]').click();
    await screenshot(`preset-${car.id}`);
  });

  await check('Manual clutch controls explain contact and separation', async () => {
    await preset('ibiza-mpi-2016');
    await page.locator('.view-tab[data-view="clutch"]').click();
    await page.locator('[data-clutch-pedal="0.5"]').click();
    await expect(page.locator('#clutch-clamp-value')).not.toHaveText('100%');
    await expect(page.locator('#clutch-gap-state')).toContainText('stykają');
    await page.locator('[data-clutch-pedal="1"]').click();
    await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'open');
    await expect(page.locator('#clutch-clamp-value')).toHaveText('0%');
    await screenshot('manual-clutch-open');
    await page.locator('[data-clutch-pedal="0"]').click();
    await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  });

  await check('Stopped engine completes manual 1 then N without extra input', async () => {
    await preset('ibiza-mpi-2016');
    await page.locator('.view-tab[data-view="gearbox"]').click();
    await setRange('#throttle', 0);
    await page.locator('#ignition').click();
    await setPaused(false);
    await expect(page.locator('#rpm')).toHaveText('0', { timeout: 60_000 });
    await expect(page.locator('#engine-status')).toContainText('WYŁĄCZONY');
    const stoppedDraws = await waitForIdle(60_000);
    await setRange('#clutch', 100);
    await page.locator('.gear-buttons [data-gear="1"]').click();
    await expect(page.locator('#drive-status')).toContainText('Sprzęgło rozłączone', { timeout: 45_000 });
    await expect(page.locator('#shift-step')).toBeDisabled();
    await expect(page.locator('.gear-buttons [data-gear="1"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.gear-buttons [data-gear="0"]').click();
    // Assertions only: any additional click could accidentally wake a broken loop.
    await expect(page.locator('#drive-status')).toHaveText('Luz: silnik nie napędza kół.', { timeout: 45_000 });
    await expect(page.locator('#shift-step')).toBeDisabled();
    await expect(page.locator('.gear-buttons [data-gear="0"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#rpm')).toHaveText('0');
    await screenshot('manual-stopped-shift-neutral');
    return { drawInvocationsBeforeShift: stoppedDraws, finalStatus: await page.locator('#drive-status').textContent() };
  });

  await check('8AT converter inspections and eighth gear work', async () => {
    await preset('508-eat8-2018');
    await page.locator('.view-tab[data-view="clutch"]').click();
    await expect(page.locator('.view-tab[data-view="clutch"]')).toHaveText('Konwerter');
    await expect(page.locator('#clutch-control')).toBeHidden();
    for (const section of ['pump', 'turbine', 'stator', 'lockup', 'all']) {
      await page.locator('#inspect-section').selectOption(section);
      await page.locator('#inspect-description').click();
      await expect(page.locator('#part-panel')).toBeVisible();
      await page.locator('#close-part').click();
    }
    await screenshot('automatic-converter');
    await page.locator('.view-tab[data-view="gearbox"]').click();
    for (const section of ['planetary', 'automaticClutches', 'valveBody', 'all']) await page.locator('#inspect-section').selectOption(section);
    await expect(page.locator('.gear-buttons [data-gear]')).toHaveCount(9);
    await page.locator('#automatic-auto').uncheck();
    if (await page.locator('#brake').getAttribute('aria-pressed') !== 'true') await page.locator('#brake').click();
    await page.locator('.gear-buttons [data-gear="8"]').click();
    await setPaused(false);
    await expect(page.locator('#automatic-state')).toContainText('Bieg 8', { timeout: 45_000 });
    await screenshot('automatic-eighth-gear');
  });

  await check('Hybrid ranges and electric energy flow work', async () => {
    await preset('corolla-hybrid-2025');
    await page.locator('.view-tab[data-view="hybrid"]').click();
    await expect(page.locator('#clutch-control')).toBeHidden();
    await expect(page.locator('#hybrid-controls')).toBeVisible();
    await page.locator('#hybrid-range').selectOption('P');
    await expect(page.locator('#quick-gear')).toHaveValue('P');
    await page.locator('#hybrid-range').selectOption('D');
    await page.locator('#hybrid-mode').selectOption('ev');
    if ((await page.locator('#ignition span').textContent()).startsWith('Włącz')) await page.locator('#ignition').click();
    await setRange('#throttle', 30);
    await setPaused(false);
    await expect(page.locator('#energy-battery')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('#energy-battery')).toHaveAttribute('data-direction', 'forward');
    await expect.poll(async () => Number((await page.locator('#speed').textContent()).replace(/\s/g, ''))).toBeGreaterThan(0);
    await screenshot('hybrid-electric-drive');
    await page.locator('#hybrid-range').selectOption('N');
    await expect(page.locator('#quick-gear')).toHaveValue('N');
    assert.ok(!/NaN|Infinity/.test(await page.locator('#hybrid-controls').textContent()), 'Hybrid metrics must remain finite');
  });

  for (const pauseBeforeShutdown of [false, true]) await check(`Stationary EV shutdown clears telemetry${pauseBeforeShutdown ? ' after resuming from pause' : ''}`, async () => {
    await preset('corolla-hybrid-2025');
    await page.locator('.view-tab[data-view="hybrid"]').click();
    await page.locator('#hybrid-mode').selectOption('ev');
    await page.locator('#hybrid-range').selectOption('D');
    await setRange('#throttle', 0);
    if (await page.locator('#brake').getAttribute('aria-pressed') !== 'true') await page.locator('#brake').click();
    await setPaused(false);
    await expect(page.locator('#hybrid-state')).toContainText('EV · bateria');
    await expect(page.locator('#speed')).toHaveText('0');
    await expect(page.locator('#ignition span')).toHaveText('Wyłącz hybrydę');
    if (pauseBeforeShutdown) {
      await setPaused();
      await waitForIdle();
    }
    await page.locator('#ignition').click();
    // The paused variant reproduces a completely sleeping clock. Resuming is
    // the final input; the live variant has no further input after shutdown.
    if (pauseBeforeShutdown) await setPaused(false);
    await expect(page.locator('#hybrid-state')).toHaveText('Układ hybrydowy wyłączony');
    await expect(page.locator('#battery-power')).toHaveText('0,0 kW');
    await expect(page.locator('#battery-current')).toHaveText('0,0 A · spoczynek');
    await expect(page.locator('#energy-battery')).toHaveAttribute('data-active', 'false');
    await expect(page.locator('#energy-battery-value')).toHaveText('0,0 kW');
    await screenshot(pauseBeforeShutdown ? 'hybrid-off-after-pause' : 'hybrid-off-at-rest');
  });

  await check('Phone layout keeps navigation and camera settings readable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preset('ibiza-mpi-2016');
    await page.locator('.view-tab[data-view="clutch"]').click();
    await expect(page.locator('#quick-clutch')).toBeVisible();
    await expect(page.locator('#quick-throttle')).toBeVisible();
    await expect(page.locator('#quick-gear')).toBeVisible();
    const bounds = await page.evaluate(() => {
      const textInside = element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const text = range.getBoundingClientRect(), box = element.getBoundingClientRect();
        return text.width > 0 && text.left >= box.left - 1 && text.right <= box.right + 1 && text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
      };
      const tabs = [...document.querySelectorAll('.view-tab')].map(button => ({ view: button.dataset.view, readable: textInside(button) }));
      const settings = [...document.querySelectorAll('.camera-device')].map(label => {
        const box = label.getBoundingClientRect(), control = label.querySelector('select').getBoundingClientRect();
        const range = document.createRange(); range.selectNode(label.firstChild); const text = range.getBoundingClientRect();
        return { label: label.firstChild.textContent, readable: parseFloat(getComputedStyle(label).fontSize) >= 10 && text.height > 0 && text.left >= box.left && text.right <= control.left && control.right <= box.right && control.width >= 74 };
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, tabs, settings };
    });
    assert.equal(bounds.overflow, false, 'The page must not scroll horizontally');
    assert.ok(bounds.tabs.every(tab => tab.readable), `Clipped navigation names: ${JSON.stringify(bounds.tabs)}`);
    assert.ok(bounds.settings.every(setting => setting.readable), `Clipped camera settings: ${JSON.stringify(bounds.settings)}`);
    await screenshot('phone-clutch');
    await preset('911-carrera-s-2025');
    await expect(page.locator('#quick-clutch-control')).toBeHidden();
    await screenshot('phone-911');
    return bounds;
  });

  await check('No runtime errors failed requests or remote assets', async () => {
    await expect(page.locator('.webgl-fallback')).toHaveCount(0);
    for (const key of ['consoleErrors', 'pageErrors', 'httpErrors', 'requestFailures', 'externalRequests']) assert.deepEqual(report[key], [], key);
    return { successfulResponses: responses.size };
  });
} catch (error) {
  fatalError = errorDetails(error);
  report.fatalError = fatalError;
  console.error(error.stack || error.message);
} finally {
  collecting = false;
  if (page && !page.isClosed()) { try { report.finalUi = await diagnostics(); } catch {} }
  try { await browser?.close(); } catch (error) { report.cleanupError = errorDetails(error); }
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length };
  report.ok = !fatalError && !report.cleanupError && report.summary.failed === 0 && ['consoleErrors', 'pageErrors', 'httpErrors', 'requestFailures', 'externalRequests'].every(key => report[key].length === 0);
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${resolve(output, 'report.json')} (${report.summary.passed} passed, ${report.summary.failed} failed)`);
  if (!report.ok) process.exitCode = 1;
}
