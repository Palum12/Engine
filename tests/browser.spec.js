import { test, expect } from '@playwright/test';
import { CAR_PRESETS } from '../src/car-presets.js';

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#scene canvas')).toBeVisible();
  await expect(page.locator('.webgl-fallback')).toHaveCount(0);
  await expect(page.locator('#scene')).toHaveAttribute('data-view', 'drive-detail');
  return errors;
}

test('every tab renders and controls work in the local WebGL application', async ({ page }, info) => {
  const errors = await openApp(page);
  const views = await page.locator('.view-tab').evaluateAll(elements => elements.map(element => element.dataset.view));
  for (const view of views) {
    await page.locator(`.view-tab[data-view="${view}"]`).click();
    await expect(page.locator('#scene')).toHaveAttribute('data-view', view);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('#cycle-panel')).toBeVisible();
  }
  await page.locator('#transmission-type').selectOption('manual');
  await page.locator('#engine-orientation').selectOption('transverse');
  await expect(page.locator('#drive-layout')).toHaveValue('fwd');
  await page.locator('#drive-layout').selectOption('rwd');
  await expect(page.locator('#engine-orientation')).toHaveValue('longitudinal');
  await expect(page.locator('#scene')).toHaveAttribute('data-engine-orientation', 'longitudinal');
  await page.locator('.view-tab[data-view="gearbox"]').click();
  await page.locator('#clutch-toggle').click();
  await page.locator('[data-gear="1"]').click();
  await expect(page.locator('#ratio-label')).toContainText('3,50', { timeout: 30_000 });
  await page.locator('#flow').uncheck();
  await page.locator('#flow').check();
  await page.locator('#camera-input').selectOption('touchpad');
  await page.locator('#camera-pan').click();
  await expect(page.locator('#camera-pan')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('manual-gearbox.png') });
  expect(errors).toEqual([]);
});

test('all car presets configure their actual mounting and transmission; 8AT inspections render', async ({ page }, info) => {
  const errors = await openApp(page);
  for (const preset of CAR_PRESETS) {
    await page.locator('#car-preset').selectOption(preset.id);
    await expect(page.locator('#scene')).toHaveAttribute('data-engine', preset.engineId);
    await expect(page.locator('#scene')).toHaveAttribute('data-transmission', preset.transmission);
    await expect(page.locator('#scene')).toHaveAttribute('data-drive', preset.driveLayout);
    await expect(page.locator('#scene')).toHaveAttribute('data-engine-orientation', preset.engineOrientation);
    await expect(page.locator('#scene')).toHaveAttribute('data-engine-placement', preset.enginePlacement);
    await expect(page.locator('#car-preset')).toHaveValue(preset.id);
    if (['corolla-hybrid-2025', '911-carrera-s-2025', 'veyron-2005', '508-eat8-2018'].includes(preset.id)) {
      await page.locator('[data-camera="top"]').click();
      await page.waitForTimeout(1000); // Let the animated camera reach the requested pose for visual QA.
      await page.screenshot({ path: info.outputPath(`${preset.id}.png`) });
    }
  }
  await page.locator('#car-preset').selectOption('508-eat8-2018');
  await page.locator('.view-tab[data-view="clutch"]').click();
  await expect(page.locator('.view-tab[data-view="clutch"]')).toHaveText('Konwerter');
  await expect(page.locator('#clutch-control')).toBeHidden();
  for (const section of ['pump', 'turbine', 'stator', 'lockup', 'all']) {
    await page.locator('#inspect-section').selectOption(section);
    await page.locator('#inspect-description').click();
    await expect(page.locator('#part-panel')).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('converter.png') });
  await page.locator('.view-tab[data-view="gearbox"]').click();
  await expect(page.locator('.gear-buttons button')).toHaveCount(9);
  for (const section of ['planetary', 'automaticClutches', 'valveBody', 'all']) {
    await page.locator('#inspect-section').selectOption(section);
    await page.locator('#isolate').check();
    await expect(page.locator('#scene canvas')).toBeVisible();
    if (section === 'automaticClutches') {
      await expect(page.locator('.model-label:visible').filter({ hasText: 'Pakiety sprzęgieł' })).toHaveCount(1);
      await expect(page.locator('.model-label:visible').filter({ hasText: 'Planetarne' })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('isolated-automatic-clutches.png') });
    }
  }
  await page.locator('#isolate').uncheck();
  await page.locator('#automatic-auto').uncheck();
  await page.locator('[data-gear="8"]').click();
  await expect(page.locator('#automatic-state')).toContainText('Bieg 8', { timeout: 30_000 });
  await page.screenshot({ path: info.outputPath('automatic-gearbox.png') });
  await page.locator('#scenario-start').click();
  await page.locator('#scenario-next').click();
  await expect(page.locator('#scenario-description')).toContainText('2/');
  await page.locator('#reset').click();
  await expect(page.locator('#car-preset')).toHaveValue('');
  await expect(page.locator('#transmission-type')).toHaveValue('manual');
  expect(errors).toEqual([]);
});

test('phone layout retains car selection, canvas and quick driving controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openApp(page);
  await page.locator('#car-preset').selectOption('911-carrera-s-2025');
  await page.locator('#quick-throttle').scrollIntoViewIfNeeded();
  await expect(page.locator('#quick-throttle')).toBeVisible();
  await expect(page.locator('#quick-clutch-control')).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: info.outputPath('phone-911.png') });
  expect(errors).toEqual([]);
});
