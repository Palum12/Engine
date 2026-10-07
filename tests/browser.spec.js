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

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function clutchDiagram(page) {
  return page.locator('#clutch-lesson').evaluate(lesson => {
    const number = (selector, attribute) => Number(lesson.querySelector(selector).getAttribute(attribute));
    return {
      discRight: number('#diagram-disc', 'x') + number('#diagram-disc', 'width'),
      pressure: number('#diagram-pressure', 'x'),
      bearing: number('#diagram-bearing', 'x'),
    };
  });
}

async function settleVisibleScene(page) {
  await page.bringToFront();
  await page.locator('#scene canvas').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
  // Pausing freezes physics, while visible animation frames still update the
  // mechanism from its controls. Await those frames before sampling WebGL.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('manual clutch explains spring force, contact and release even while paused', async ({ page }, info) => {
  const errors = await openApp(page);
  await page.locator('#transmission-type').selectOption('manual');
  await page.locator('.view-tab[data-view="clutch"]').click();
  await expect(page.locator('#clutch-lesson')).toBeVisible();
  await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  await expect(page.locator('#clutch-mechanism-detail')).toContainText(/sprężyn/i);
  await expect(page.locator('#clutch-mechanism-detail')).toContainText(/pedał/i);
  await expect(page.locator('#explode')).toHaveValue('0');
  await expect(page.locator('#clutch-display')).toHaveAttribute('data-state', 'assembled');
  await expect(page.locator('#labels')).toBeChecked();
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Wznów symulację');
  if (await page.locator('#mechanism-readout').isVisible()) {
    await page.locator('#mechanism-readout .close-readout').click();
  }
  // Refit through the real control: software WebGL may not finish an animated fit promptly.
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  const engaged = await clutchDiagram(page);
  expect(engaged.pressure).toBeCloseTo(engaged.discRight, 4);
  await expect(page.locator('#contact-state')).toContainText(/połącz|styk|kontakt|zaciśnię/i);
  await settleVisibleScene(page);
  await page.screenshot({ path: info.outputPath('clutch-engaged.png') });
  const engagedCanvas = await page.locator('#scene canvas').screenshot({ path: info.outputPath('clutch-engaged-canvas.png') });

  await page.locator('[data-clutch-pedal="0.5"]').click();
  await expect(page.locator('#clutch')).toHaveValue('50');
  await expect.poll(async () => Number((await page.locator('#clutch-clamp-value').innerText()).replace('%', ''))).toBeGreaterThan(0);
  await expect.poll(async () => Number((await page.locator('#clutch-clamp-value').innerText()).replace('%', ''))).toBeLessThan(100);

  await page.locator('[data-clutch-pedal="1"]').click();
  await expect(page.locator('#clutch')).toHaveValue('100');
  await expect(page.locator('#clutch-clamp-value')).toHaveText('0%');
  await expect(page.locator('#clutch-gap-state')).toContainText(/szczelin|rozłącz|odsunięt/i);
  await expect(page.locator('#contact-state')).toContainText(/rozłącz|rozdziel|oddziel|brak styku/i);
  const released = await clutchDiagram(page);
  expect(released.pressure).toBeGreaterThan(released.discRight);
  expect(released.pressure).toBeGreaterThan(engaged.pressure);
  expect(released.bearing).toBeLessThan(engaged.bearing);
  await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Wznów symulację');
  await settleVisibleScene(page);
  await page.screenshot({ path: info.outputPath('clutch-released.png') });
  await expect.poll(async () => (await page.locator('#scene canvas').screenshot({ path: info.outputPath('clutch-released-canvas.png') })).equals(engagedCanvas), {
    timeout: 30_000, message: 'The paused 3D clutch must release when its pedal is fully pressed',
  }).toBe(false);

  await setRange(page, '#explode', 80);
  await expect(page.locator('#explode-value')).toHaveText('80%');
  await expect(page.locator('#clutch-display')).toHaveAttribute('data-state', 'exploded');
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath('clutch-exploded.png') });
  await page.locator('#assemble-clutch').click();
  await expect(page.locator('#explode')).toHaveValue('0');
  await expect(page.locator('#clutch-display')).toHaveAttribute('data-state', 'assembled');
  await page.locator('[data-clutch-pedal="0"]').click();
  await expect(page.locator('#clutch')).toHaveValue('0');
  await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  const reengaged = await clutchDiagram(page);
  expect(reengaged.pressure).toBeCloseTo(reengaged.discRight, 4);
  expect(reengaged.bearing).toBeCloseTo(engaged.bearing, 4);

  await page.locator('.view-tab[data-view="drive-detail"]').click();
  await page.locator('#inspect-section').selectOption('clutch');
  await page.locator('#isolate').check();
  await expect(page.locator('.visual-panel')).toHaveAttribute('data-inspection', 'clutch');
  await expect(page.locator('#clutch-lesson')).toBeVisible();
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('isolated-manual-clutch.png') });
  expect(errors).toEqual([]);
});

test('phone clutch lesson keeps pedal presets, explanation and model within the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openApp(page);
  await page.locator('#transmission-type').selectOption('manual');
  await page.locator('.view-tab[data-view="clutch"]').click();
  await expect(page.locator('#clutch-lesson')).toBeVisible();
  await page.locator('#pause').click();
  await page.locator('[data-clutch-pedal="1"]').click();
  await expect(page.locator('#clutch-clamp-value')).toHaveText('0%');
  await page.locator('[data-clutch-pedal="0"]').click();
  await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  await expect(page.locator('#clutch-mechanism-detail')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  for (const selector of ['#clutch-lesson', '#clutch-mechanism-detail', '#scene canvas']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  }
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('phone-clutch.png') });
  expect(errors).toEqual([]);
});

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

test('suspension body mounts, five layouts and right-click descriptions stay readable', async ({ page }, info) => {
  test.setTimeout(540_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = await openApp(page);
  await page.locator('#pause').click();
  await page.locator('.view-tab[data-view="suspension"]').click();
  await page.locator('#suspension-road').selectOption('split');
  await page.locator('#suspension-amplitude').evaluate(element => {
    element.value = '12'; element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const capture = async name => {
    // Use the actual inspection control for an instant camera fit before QA.
    await page.locator('#inspect-section').dispatchEvent('change');
    await page.waitForTimeout(300);
    await page.locator('#scene').screenshot({ path: info.outputPath(`${name}.png`) });
  };
  for (const type of ['macpherson', 'multilink', 'leaf', 'pushrod', 'pullrod']) {
    await page.locator('#suspension-type').selectOption(type);
    await page.locator('#inspect-section').selectOption('all');
    await page.locator('#isolate').uncheck();
    if (['multilink', 'pushrod', 'pullrod'].includes(type)) {
      await page.locator('#labels').uncheck();
      await capture(`${type}-rest`);
    }
    await page.locator('#suspension-step').evaluate(button => { for (let i = 0; i < 7; i++) button.click(); });
    await page.locator('#labels').check();
    await capture(`${type}-body-mounts`);
    const labels = page.locator('.model-label:visible');
    expect(await labels.count()).toBeLessThanOrEqual(5);
    await expect(labels.filter({ hasText: /Nawierzchnia|Koło [LP]/ })).toHaveCount(0);
    await page.locator('#labels').uncheck();
    await expect(page.locator('.model-label:visible')).toHaveCount(0);
    await capture(`${type}-without-labels`);
    if (type === 'multilink' || type === 'pushrod' || type === 'pullrod') {
      await page.locator('#inspect-section').selectOption(type === 'multilink' ? 'suspensionLinks' : 'suspensionRocker');
      await capture(`${type}-connections`);
      if (type !== 'multilink') {
        await page.locator('#isolate').check();
        await capture(`${type}-actuation-isolated`);
        await page.locator('#isolate').uncheck();
      }
    }
  }

  await page.locator('#suspension-type').selectOption('macpherson');
  await page.locator('#inspect-section').selectOption('suspensionDamper');
  await page.locator('#isolate').check();
  await page.locator('#labels').uncheck();
  await capture('damper-picking');
  const canvas = page.locator('#scene canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  // Try a small grid on the real rendered mesh instead of exposing scene internals
  // or relying on the position of a DOM label (which is deliberately hidden).
  let pickedPoint;
  for (const [x, y] of [[0.5, 0.5], [0.45, 0.5], [0.55, 0.5], [0.5, 0.4], [0.5, 0.6], [0.4, 0.4], [0.6, 0.6]]) {
    const point = { x: rect.x + rect.width * x, y: rect.y + rect.height * y };
    await page.mouse.click(point.x, point.y, { button: 'right' });
    if (await page.locator('#part-panel').isVisible()) {
      if (await page.locator('#part-title').textContent() === 'Amortyzator') { pickedPoint = point; break; }
      await page.locator('#close-part').click();
    }
  }
  expect(pickedPoint, 'right-click selects the rendered damper with all labels hidden').toBeTruthy();
  await expect(page.locator('#part-title')).toHaveText('Amortyzator');
  await expect(page.locator('#part-description')).not.toBeEmpty();
  await expect(page.locator('#labels')).not.toBeChecked();
  await expect(page.locator('.model-label:visible')).toHaveCount(0);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('right-click-description-labels-off.png') });
  await page.locator('#close-part').click();
  // A right drag still pans. Returning to its start must not turn it into a pick.
  await page.mouse.move(pickedPoint.x, pickedPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(pickedPoint.x + 45, pickedPoint.y + 15, { steps: 4 });
  await page.mouse.move(pickedPoint.x, pickedPoint.y, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(page.locator('#part-panel')).toBeHidden();
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.locator('#fullscreen').click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await capture('damper-fullscreen');
    await canvas.scrollIntoViewIfNeeded();
    const fullRect = await canvas.boundingBox();
    for (const [x, y] of [[0.5, 0.5], [0.45, 0.5], [0.55, 0.5], [0.5, 0.4], [0.5, 0.6]]) {
      await page.mouse.click(fullRect.x + fullRect.width * x, fullRect.y + fullRect.height * y, { button: 'right' });
      if (await page.locator('#part-panel').isVisible()) {
        if (await page.locator('#part-title').textContent() === 'Amortyzator') break;
        await page.locator('#close-part').click();
      }
    }
    await expect(page.locator('#part-panel')).toBeVisible();
    await expect(page.locator('#part-title')).toHaveText('Amortyzator');
    await expect(page.locator('#labels')).not.toBeChecked();
    await page.locator('.visual-panel').screenshot({ path: info.outputPath('right-click-fullscreen.png') });
    await page.locator('#close-part').click();
    await page.locator('#fullscreen').click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  }
  await page.locator('#inspect-section').selectOption('all');
  await page.locator('#isolate').uncheck();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#suspension-type').selectOption('pushrod');
  await page.locator('#labels').check();
  await capture('pushrod-phone');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await expect(page.locator('.view-tab[data-view="suspension"]')).toBeVisible();
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
        await expect(page.locator('#explode')).toHaveValue('0');
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
