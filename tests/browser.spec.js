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

test('compact navigation keeps every name and suspension visible at desktop, tablet and phone widths', async ({ page }, info) => {
  test.setTimeout(540_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors = await openApp(page);
  await page.locator('#pause').click();
  const expectedViews = ['engine', 'cylinder', 'drive-detail', 'clutch', 'gearbox', 'differential', 'hybrid', 'suspension'];
  const inspectLayout = async () => page.evaluate(() => {
    const tabs = document.querySelector('.view-tabs');
    const toolbar = document.querySelector('.view-toolbar');
    const parent = tabs.getBoundingClientRect();
    const buttons = [...tabs.querySelectorAll('.view-tab')].map(button => {
      const box = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const range = document.createRange();
      range.selectNodeContents(button);
      const lines = [...range.getClientRects()];
      return {
        view: button.dataset.view, name: button.textContent.trim(),
        font: parseFloat(style.fontSize), height: box.height,
        visible: style.visibility !== 'hidden' && style.display !== 'none' && lines.length > 0,
        insideParent: box.left >= parent.left - 1 && box.right <= parent.right + 1 && box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1,
        fullName: lines.every(line => line.left >= box.left - 1 && line.right <= box.right + 1 && line.top >= box.top - 1 && line.bottom <= box.bottom + 1)
      };
    });
    const enginePicker = document.querySelector('.engine-picker');
    const engineContainer = document.querySelector('.engine-buttons');
    const pickerBox = enginePicker.getBoundingClientRect();
    const engineBox = engineContainer.getBoundingClientRect();
    const engineButtons = [...engineContainer.querySelectorAll('[data-engine]')];
    const engines = engineButtons.map(button => {
      const box = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const lines = [...range.getClientRects()];
      return {
        name: button.textContent.trim(), top: Math.round(box.top),
        visible: getComputedStyle(button).visibility !== 'hidden' && lines.length > 0,
        insideParent: box.left >= engineBox.left - 1 && box.right <= engineBox.right + 1 && box.top >= engineBox.top - 1 && box.bottom <= engineBox.bottom + 1,
        fullName: lines.every(line => line.left >= box.left - 1 && line.right <= box.right + 1 && line.top >= box.top - 1 && line.bottom <= box.bottom + 1)
      };
    });
    return {
      buttons,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      tabsOverflow: tabs.scrollWidth > tabs.clientWidth + 1 || tabs.scrollHeight > tabs.clientHeight + 1,
      toolbarOverflow: toolbar.scrollWidth > toolbar.clientWidth + 1,
      parentInPage: parent.left >= -1 && parent.right <= innerWidth + 1,
      engineCount: engineButtons.length,
      engines,
      engineRows: new Set(engines.map(button => button.top)).size,
      enginePickerInPage: pickerBox.left >= -1 && pickerBox.right <= innerWidth + 1,
      engineContainerInPicker: engineBox.left >= pickerBox.left - 1 && engineBox.right <= pickerBox.right + 1 && engineBox.top >= pickerBox.top - 1 && engineBox.bottom <= pickerBox.bottom + 1,
      enginePickerOverflow: enginePicker.scrollWidth > enginePicker.clientWidth + 1,
      engineContainerOverflow: engineContainer.scrollWidth > engineContainer.clientWidth + 1 || engineContainer.scrollHeight > engineContainer.clientHeight + 1,
      boxer4Button: engineButtons.some(button => button.dataset.engine === 'boxer4')
    };
  });
  const assertReadableTabs = async label => {
    const layout = await inspectLayout();
    expect(layout.buttons.map(button => button.view), label).toEqual(expectedViews);
    expect(layout.horizontalOverflow, `${label}: page horizontal overflow`).toBe(false);
    expect(layout.tabsOverflow, `${label}: hidden or scrollable tabs`).toBe(false);
    expect(layout.toolbarOverflow, `${label}: toolbar horizontal overflow`).toBe(false);
    expect(layout.parentInPage, `${label}: tab container stays inside the page`).toBe(true);
    for (const button of layout.buttons) {
      expect(button.visible, `${label}: ${button.name} is visible`).toBe(true);
      expect(button.insideParent, `${label}: ${button.name} fits without scrolling the tab strip`).toBe(true);
      expect(button.fullName, `${label}: ${button.name} is not cropped`).toBe(true);
      expect(button.font, `${label}: ${button.name} text size`).toBeGreaterThanOrEqual(13);
      expect(button.height, `${label}: ${button.name} button height`).toBeGreaterThanOrEqual(32);
    }
    return layout;
  };
  for (const viewport of [
    { width: 1920, height: 1080 }, { width: 1440, height: 900 },
    { width: 1280, height: 800 }, { width: 1024, height: 768 },
    { width: 768, height: 1024 }, { width: 390, height: 844 },
    { width: 360, height: 780 }
  ]) {
    await page.setViewportSize(viewport);
    await page.locator('.view-tab[data-view="drive-detail"]').click();
    const label = `${viewport.width}x${viewport.height}`;
    // Check containment before any locator click or screenshot could scroll a
    // clipped button into view and conceal the original tab-strip regression.
    const layout = await assertReadableTabs(label);
    expect(layout.engineCount, `${label}: compact engine picker`).toBe(9);
    expect(layout.boxer4Button).toBe(false);
    expect(layout.enginePickerInPage, `${label}: engine picker stays inside the page`).toBe(true);
    expect(layout.engineContainerInPicker, `${label}: engine row fits its picker`).toBe(true);
    expect(layout.enginePickerOverflow, `${label}: engine picker horizontal overflow`).toBe(false);
    expect(layout.engineContainerOverflow, `${label}: clipped or scrollable engine choices`).toBe(false);
    for (const engine of layout.engines) {
      expect(engine.visible, `${label}: ${engine.name} is visible`).toBe(true);
      expect(engine.insideParent, `${label}: ${engine.name} fits without scrolling the engine picker`).toBe(true);
      expect(engine.fullName, `${label}: ${engine.name} is not cropped`).toBe(true);
    }
    if (viewport.width >= 1024) expect(layout.engineRows, `${label}: all engines in one row`).toBe(1);
    await page.locator('.page-heading').screenshot({ path: info.outputPath(`heading-${label}.png`) });
    await page.locator('.view-toolbar').screenshot({ path: info.outputPath(`navigation-${label}.png`) });
    await page.locator('.view-tab[data-view="suspension"]').click();
    await expect(page.locator('#scene')).toHaveAttribute('data-view', 'suspension');
    await expect(page.locator('#suspension-controls')).toBeVisible();
    await expect(page.locator('#suspension-telemetry')).toBeVisible();
    await assertReadableTabs(`${label} suspension`);
    expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThan(320);
    if ([1440, 390].includes(viewport.width)) {
      await page.locator('#inspect-section').dispatchEvent('change');
      await page.locator('.visual-panel').screenshot({ path: info.outputPath(`suspension-${label}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.view-tab[data-view="drive-detail"]').click();
  for (const section of ['timing', 'oil', 'fuel', 'turbo']) {
    await page.locator('#inspect-section').selectOption(section);
    await page.locator('#isolate').check();
    await expect(page.locator('#scene canvas')).toBeVisible();
    await page.locator('#inspect-description').click();
    await expect(page.locator('#part-panel')).toBeVisible();
    await expect(page.locator('#part-description')).not.toBeEmpty();
    await page.locator('#close-part').click();
  }
  await page.locator('#inspect-section').selectOption('all');
  await page.locator('#isolate').uncheck();
  await page.locator('#car-preset').selectOption('wrx-2024');
  await expect(page.locator('#scene')).toHaveAttribute('data-engine', 'boxer4');
  await expect(page.locator('.engine-buttons [data-engine="boxer4"]')).toHaveCount(0);
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.locator('.view-tab[data-view="suspension"]').click();
      await page.locator('#fullscreen').click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await assertReadableTabs(`${viewport.width}px fullscreen suspension`);
      expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThan(160);
      await page.screenshot({ path: info.outputPath(`suspension-fullscreen-${viewport.width}.png`) });
      await page.locator('#fullscreen').click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('every tab renders and controls work in the local WebGL application', async ({ page }, info) => {
  const errors = await openApp(page);
  const views = await page.locator('.view-tab').evaluateAll(elements => elements.map(element => element.dataset.view));
  for (const view of views) {
    await page.locator(`.view-tab[data-view="${view}"]`).click();
    await expect(page.locator('#scene')).toHaveAttribute('data-view', view);
    await expect(page.locator('#scene canvas')).toBeVisible();
    expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThan(200);
    if (view === 'suspension') await expect(page.locator('#suspension-telemetry')).toBeVisible();
    else if (['clutch', 'gearbox'].includes(view)) await expect(page.locator('#cycle-panel')).toBeHidden();
    else await expect(page.locator('#cycle-panel')).toBeVisible();
  }
  await page.locator('.view-tab[data-view="engine"]').click();
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

test('custom configuration, head, progressive manual clutch and FWD differential are inspectable', async ({ page }, info) => {
  const errors = await openApp(page);
  await expect(page.locator('#mount-settings #drive-layout')).toBeVisible();
  await expect(page.locator('#mount-settings #engine-orientation')).toBeVisible();
  await page.locator('#engine-orientation').selectOption('transverse');
  await expect(page.locator('#drive-layout')).toHaveValue('fwd');
  await page.locator('#drive-layout').selectOption('rwd');
  await expect(page.locator('#engine-orientation')).toHaveValue('longitudinal');
  await page.screenshot({ path: info.outputPath('custom-configuration.png') });

  await page.locator('.view-tab[data-view="engine"]').click();
  await page.locator('#inspect-section').selectOption('cylinderHead');
  await page.locator('#isolate').check();
  await page.locator('#inspect-description').click();
  await expect(page.locator('#part-description')).toContainText('zawor');
  await page.locator('#close-part').click();
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('isolated-head.png') });
  await page.locator('#inspect-section').selectOption('timing');
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('isolated-belt.png') });
  await page.locator('#timing-type').selectOption('chain');
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('isolated-chain.png') });
  await page.locator('#timing-type').selectOption('belt');

  await page.locator('.view-tab[data-view="clutch"]').click();
  await page.locator('#clutch-slip-demo').click();
  await expect(page.locator('#contact-state')).toContainText('POŚLIZGIEM');
  await expect(page.locator('#contact-detail')).toContainText('ciepło');
  await page.locator('#pause').click();
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('partial-clutch.png') });
  await page.locator('#quick-clutch').evaluate(element => { element.value = '80'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#contact-state')).toContainText('ROZŁĄCZONE');
  await page.locator('#inspect-section').selectOption('releaseBearing');
  await page.locator('#isolate').check();
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('clutch-release-mechanism.png') });

  await page.locator('.view-tab[data-view="gearbox"]').click();
  await page.locator('#inspect-section').selectOption('gear2');
  await expect(page.locator('#shift-detail')).toContainText('Koło biegu 2 obraca się swobodnie');
  await expect(page.locator('#shift-detail')).toContainText('Bieg 1 jest włączony');
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('manual-second-gear.png') });
  await page.locator('#quick-clutch').evaluate(element => { element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-gear="2"]').click();
  await page.locator('#shift-step').click();
  await expect(page.locator('#shift-detail')).toContainText('wyrównując obroty');
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('manual-synchronization.png') });

  await page.locator('#car-preset').selectOption('ibiza-mpi-2016');
  await expect(page.locator('#scene')).toHaveAttribute('data-cylinders', '3');
  await expect(page.locator('#scene')).toHaveAttribute('data-drive', 'fwd');
  await expect(page.locator('#scene')).toHaveAttribute('data-engine-orientation', 'transverse');
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(1000);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('ibiza-2016.png') });
  await page.locator('#inspect-section').selectOption('differential');
  await page.locator('#isolate').check();
  await expect(page.locator('.scene-legend')).toContainText('Satelity');
  await page.locator('#diff-demo').click();
  await expect(page.locator('#diff-demo')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('#diff-left').textContent()).not.toBe(await page.locator('#diff-right').textContent());
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('fwd-differential-turn.png') });
  await page.locator('[data-turn="0"]').click();
  await expect.poll(async () => (await page.locator('#diff-left').textContent()) === (await page.locator('#diff-right').textContent())).toBe(true);
  await page.locator('[data-turn="-1"]').click();
  await expect.poll(async () => Number(await page.locator('#diff-left').textContent()) > Number(await page.locator('#diff-right').textContent())).toBe(true);
  await page.locator('.view-tab[data-view="engine"]').click();
  await page.locator('.view-tab[data-view="drive-detail"]').click();
  await page.locator('#inspect-section').selectOption('differential');
  await expect(page.locator('#diff-demo')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('clutch, selector, DCT branches and all five suspension layouts are inspectable', async ({ page }, info) => {
  test.setTimeout(360_000);
  const errors = await openApp(page);
  const snapshot = async name => {
    await page.locator('#inspect-section').dispatchEvent('change');
    await page.waitForTimeout(300);
    await page.locator('.visual-panel').screenshot({ path: info.outputPath(`${name}.png`) });
  };
  await page.locator('#car-preset').selectOption('ibiza-mpi-2016');
  await page.locator('.view-tab[data-view="clutch"]').click();
  await page.locator('#pause').click();
  await page.locator('#spread-clutch').click();
  await snapshot('clutch-layers');
  await page.locator('#assemble-clutch').click();
  await page.locator('#quick-clutch').evaluate(element => { element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await snapshot('clutch-full-release');
  for (const part of ['clutchCover', 'diaphragm', 'releaseActuator']) {
    await page.locator('#inspect-section').selectOption(part);
    await page.locator('#isolate').check();
    await snapshot(`clutch-${part}`);
  }
  await page.locator('.view-tab[data-view="gearbox"]').click();
  await page.locator('#inspect-section').selectOption('selector');
  await expect(page.locator('.model-label:visible').filter({ hasText: 'Stożek' })).toHaveCount(0);
  await snapshot('manual-selector');
  await page.locator('#synchronizer-demo').click();
  await expect(page.locator('#inspect-section')).toHaveValue('synchronizer');
  await page.locator('#shift-step').click();
  await expect(page.locator('#shift-detail')).toContainText('wyrównując obroty');
  await snapshot('synchronizer-cone-contact');
  await page.locator('#shift-step').click();
  await snapshot('synchronizer-dog-engagement');
  await page.locator('#shift-step').click();
  await expect(page.locator('#shift-detail')).toContainText('Bieg 2');

  await page.locator('#car-preset').selectOption('458-italia-2009');
  await page.locator('.view-tab[data-view="gearbox"]').click();
  await expect(page.locator('#dct-layout-note')).toContainText('6 biegów');
  await page.locator('#quick-throttle').evaluate(element => { element.value = '30'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-gear="1"]').click();
  await page.locator('#dct-shift-step').evaluate(button => { for (let i = 0; i < 3; i++) button.click(); });
  await expect(page.locator('#dct-state')).toContainText('przygotowany 2');
  if (await page.locator('#mechanism-readout').isVisible()) await page.locator('#mechanism-readout .close-readout').click();
  for (const section of ['all', 'dctOdd', 'dctEven', 'dctSelector']) {
    await page.locator('#inspect-section').selectOption(section);
    if (section !== 'all') await page.locator('#isolate').check();
    await snapshot(`dct-${section}`);
  }
  await page.locator('#inspect-section').selectOption('all');
  await page.locator('#isolate').uncheck();
  await page.locator('[data-gear="2"]').click();
  await page.locator('#dct-shift-step').click();
  await expect(page.locator('#dct-state')).toContainText('przejmowanie momentu');
  await page.locator('#show-readout').click();
  await expect(page.locator('#mechanism-detail')).toContainText('Oba pakiety przejmują napęd z poślizgiem');
  await page.locator('#mechanism-readout .close-readout').click();
  await snapshot('dct-handover');
  await page.locator('.view-tab[data-view="suspension"]').click();
  await expect(page.locator('#suspension-controls')).toBeVisible();
  expect((await page.locator('#scene').boundingBox()).height).toBeGreaterThan(320);
  await expect(page.locator('#cycle-panel')).toBeHidden();
  await expect(page.locator('#mount-settings')).toBeHidden();
  await page.locator('#suspension-road').selectOption('split');
  await page.locator('#suspension-amplitude').evaluate(element => { element.value = '12'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const type of ['macpherson', 'multilink', 'leaf', 'pushrod', 'pullrod']) {
    await page.locator('#suspension-type').selectOption(type);
    await page.locator('#suspension-step').evaluate(button => { for (let i = 0; i < 7; i++) button.click(); });
    await expect(page.locator('#suspension-body-state')).toContainText('3.5 m');
    await snapshot(`suspension-${type}`);
  }
  for (const section of ['suspensionLinks', 'suspensionSpring', 'suspensionDamper', 'suspensionRoad']) {
    await page.locator('#inspect-section').selectOption(section);
    await page.locator('#isolate').check();
    if (['suspensionLinks', 'suspensionSpring', 'suspensionDamper'].includes(section)) {
      await expect(page.locator('.model-label:visible').filter({ hasText: 'Nawierzchnia' })).toHaveCount(0);
    }
    await snapshot(`suspension-${section}`);
  }
  await page.locator('#suspension-reset').click();
  await expect(page.locator('#suspension-body-state')).toContainText('0.0 m');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#inspect-section').selectOption('all');
  await page.locator('#isolate').uncheck();
  await snapshot('suspension-phone');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.locator('.view-tab[data-view="drive-detail"]').click();
  await expect(page.locator('#car-preset')).toHaveValue('458-italia-2009');
  await expect(page.locator('#quick-gear')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const id of ['ibiza-mpi-2016', 'a4-quattro-2011', '911-carrera-s-2025', '508-eat8-2018', 'corolla-hybrid-2025', 'veyron-2005']) test(`mechanism views remain clear: ${id}`, async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = await openApp(page);
  const screenshot = async name => {
    // Refit instantly through the real inspection control. Software WebGL may
    // render too few frames to finish an animated camera transition in 850 ms.
    await page.locator('#inspect-section').dispatchEvent('change');
    await page.waitForTimeout(250);
    await page.locator('.visual-panel').screenshot({ path: info.outputPath(`${name}.png`) });
  };
    const preset = CAR_PRESETS.find(preset => preset.id === id);
    await page.locator('#car-preset').selectOption(id);
    await page.locator('[data-camera="perspective"]').click();
    await screenshot(`${id}-whole`);
    await expect(page.locator('.model-label:visible').filter({ hasText: /^Głowica/ })).toHaveCount(1);
    await page.locator('#show-head').click();
    await expect(page.locator('#inspect-section')).toHaveValue('cylinderHead');
    await expect(page.locator('#isolate')).toBeChecked();
    await expect(page.locator('#part-description')).toContainText('Głowica');
    await page.locator('#close-part').click();
    if (['ibiza-mpi-2016', '911-carrera-s-2025', 'veyron-2005'].includes(id)) await screenshot(`${id}-head`);
    await page.locator('#isolate').uncheck();
    await page.locator('#inspect-section').selectOption('all');
    await screenshot(`${id}-engine`);
    await page.locator('.view-tab[data-view="drive-detail"]').click();
    await page.locator('#inspect-section').selectOption('timing');
    if (id === 'ibiza-mpi-2016') await screenshot(`${id}-timing`);
    if (preset.transmission === 'hybrid') {
      await page.locator('.view-tab[data-view="hybrid"]').click();
      await screenshot(`${id}-hybrid`);
    } else {
      await page.locator('.view-tab[data-view="clutch"]').click();
      if (preset.transmission === 'manual') {
        await expect(page.locator('#explode')).toHaveValue('55');
        await expect(page.locator('#mechanism-readout')).toBeHidden();
        await screenshot(`${id}-clutch-layers`);
        await page.locator('#spread-clutch').click();
        await expect(page.locator('#explode')).toHaveValue('70');
        await screenshot(`${id}-clutch-wide`);
        await page.locator('#assemble-clutch').click();
        await expect(page.locator('#explode')).toHaveValue('0');
        await page.locator('#quick-clutch').evaluate(element => {
          element.value = '100'; element.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await screenshot(`${id}-clutch-released`);
      } else await screenshot(`${id}-clutch`);
      await page.locator('.view-tab[data-view="gearbox"]').click();
      await screenshot(`${id}-gearbox`);
    }
    await page.locator('.view-tab[data-view="differential"]').click();
    await page.locator('#inspect-section').selectOption('core');
    await expect(page.locator('#scene canvas')).toBeVisible();
    await page.locator('.view-tab[data-view="drive-detail"]').click();
    await expect(page.locator('#car-preset')).toHaveValue(id);
    await expect(page.locator('#scene')).toHaveAttribute('data-engine-orientation', preset.engineOrientation);
    await expect(page.locator('#scene')).toHaveAttribute('data-transmission', preset.transmission);
  expect(errors).toEqual([]);
});
