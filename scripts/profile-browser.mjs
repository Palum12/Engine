import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const temporaryPath = resolve('.cache/tmp');
await mkdir(temporaryPath, { recursive: true }); await mkdir('artifacts/performance', { recursive: true });
Object.assign(process.env, { PLAYWRIGHT_BROWSERS_PATH: resolve('.cache/playwright'), TEMP: temporaryPath, TMP: temporaryPath, TMPDIR: temporaryPath });
const { chromium } = await import('@playwright/test');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://127.0.0.1:5174')).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  if (!ready) throw Error('Local profiling server did not start');
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174');
  await page.evaluate(async () => {
    const { EngineScene } = await import('/src/scene.js'), original = EngineScene.prototype.render;
    EngineScene.prototype.render = function(...args) {
      window.__profileScene = this;
      if (!window.__profileBuffers) {
        const gl = this.renderer.getContext(), create = gl.createBuffer.bind(gl), remove = gl.deleteBuffer.bind(gl), live = new WeakSet();
        const counts = window.__profileBuffers = { created: 0, deleted: 0 };
        gl.createBuffer = () => { const buffer = create(); if (buffer) { live.add(buffer); counts.created++; } return buffer; };
        gl.deleteBuffer = buffer => { if (live.has(buffer)) { live.delete(buffer); counts.deleted++; } return remove(buffer); };
      }
      const result = original.apply(this, args);
      window.__profileRenderedPreset = document.querySelector('#car-preset').value;
      return result;
    };
  });
  await page.waitForFunction(() => !!window.__profileScene);
  await page.locator('#render-quality').selectOption('economy');
  await page.locator('#pause').click();
  const cdp = await page.context().newCDPSession(page), rounds = [];
  for (let round = 0; round < 5; round++) {
    for (const preset of ['veyron-2005', 'corolla-hybrid-2025', '508-eat8-2018', 'ibiza-mpi-2016']) {
      await page.locator('#car-preset').selectOption(preset);
      await page.evaluate(() => { window.__profileScene.sim.paused = true; window.__profileScene.onInvalidate(); });
      await page.waitForFunction(id => window.__profileRenderedPreset === id, preset);
    }
    await cdp.send('HeapProfiler.collectGarbage');
    rounds.push(await page.evaluate(() => {
      const s = window.__profileScene, counts = window.__profileBuffers;
      return { ...counts, balance: counts.created - counts.deleted, geometries: s.renderer.info.memory.geometries,
        textures: s.renderer.info.memory.textures, programs: s.renderer.info.programs.length, domNodes: document.querySelectorAll('*').length,
        heapBytes: performance.memory?.usedJSHeapSize ?? null };
    }));
    console.log(`Preset round ${round + 1}/5: balance ${rounds.at(-1).balance}`);
  }
  const report = { browser: browser.version(), renderer: 'Chromium SwiftShader; operation/resource check, not laptop GPU timing', rounds, errors };
  await writeFile('artifacts/performance/resources.json', JSON.stringify(report, null, 2) + '\n');
  if (errors.length) throw Error(errors.join('\n'));
  const warm = rounds.slice(2);
  if (warm.some(round => round.balance !== warm[0].balance || round.geometries !== warm[0].geometries || round.textures !== warm[0].textures || round.domNodes !== warm[0].domNodes)) throw Error('Resources do not stabilize after warmup; inspect artifacts/performance/resources.json');
} finally { await browser?.close(); server.kill(); }
