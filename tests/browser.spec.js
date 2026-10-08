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
  await page.evaluate(() => window.__clutchTestScene?.onInvalidate?.());
  // Pausing freezes physics, while visible animation frames still update the
  // mechanism from its controls. Await those frames before sampling WebGL.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertCameraSettingsReadable(page) {
  const settings = await page.locator('.camera-device').evaluateAll(labels => labels.map(label => {
    const box = label.getBoundingClientRect(), select = label.querySelector('select').getBoundingClientRect();
    const text = document.createRange(); text.selectNode(label.firstChild);
    const name = text.getBoundingClientRect();
    return { fontSize: parseFloat(getComputedStyle(label).fontSize),
      nameInside: name.left >= box.left && name.right <= select.left && name.height > 0,
      controlInside: select.right <= box.right && select.width >= 74 };
  }));
  for (const setting of settings) {
    expect(setting.fontSize).toBeGreaterThanOrEqual(10);
    expect(setting.nameInside).toBe(true);
    expect(setting.controlInside).toBe(true);
  }
}

async function trackClutchScene(page) {
  await page.evaluate(async () => {
    const { EngineScene } = await import('/src/scene.js');
    const render = EngineScene.prototype.render;
    EngineScene.prototype.render = function(...args) {
      window.__clutchTestScene = this;
      return render.apply(this, args);
    };
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => Boolean(window.__clutchTestScene));
}

async function setClutchSpeeds(page, inputRpm, torque = 60) {
  // Freeze physics so that the UI and real WebGL model consume an identical,
  // deterministic load. Pedal movement still goes through the actual controls.
  await page.evaluate(({ inputRpm, torque }) => {
    Object.assign(window.__clutchTestScene.sim, { paused: true, running: true, rpm: 1800,
      inputOmega: inputRpm * Math.PI / 30, transmittedTorque: torque,
      clutchSlip: Math.abs(1800 - inputRpm), angle: 27, inputAngle: 0.19 });
  }, { inputRpm, torque });
  await settleVisibleScene(page);
}

async function visibleFrictionPixels(page) {
  return page.evaluate(() => {
    const s = window.__clutchTestScene;
    // Control-driven DOM updates can precede the next animation frame. Prepare
    // the model before saving visibility, so cleanup restores its current pose.
    s.render(s.sim, 0);
    const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value?.isObject3D ? [value] : [];
    const cues = [...new Set([...flatten(s.drive.contacts), ...flatten(s.drive.contactEdges)])];
    const saved = cues.map(cue => [cue, cue.visible]);
    const gl = s.renderer.getContext(), width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const withCues = new Uint8Array(width * height * 4), withoutCues = new Uint8Array(withCues.length);
    try {
      s.renderer.render(s.scene, s.camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, withCues);
      cues.forEach(cue => { cue.visible = false; });
      s.renderer.render(s.scene, s.camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, withoutCues);
    } finally {
      saved.forEach(([cue, visible]) => { cue.visible = visible; });
      s.renderer.render(s.scene, s.camera);
    }
    let green = 0, orange = 0, changed = 0;
    for (let pixel = 0; pixel < withCues.length; pixel += 4) {
      const r = withCues[pixel], g = withCues[pixel + 1], b = withCues[pixel + 2];
      const delta = Math.abs(r - withoutCues[pixel]) + Math.abs(g - withoutCues[pixel + 1]) + Math.abs(b - withoutCues[pixel + 2]);
      if (delta < 20) continue;
      changed++;
      if (g > r + 20 && g > b + 12 && g > 110) green++;
      if (r > g + 25 && g > b + 20 && r > 150) orange++;
    }
    return { green, orange, changed, enabledCues: saved.filter(([, visible]) => visible).length };
  });
}

async function clutchProjectedHeight(page) {
  return page.evaluate(() => {
    const s = window.__clutchTestScene, face = s.drive.flywheel.userData.face;
    const positions = face.geometry.attributes.position;
    const point = s.controls.target.clone();
    let minimum = Infinity, maximum = -Infinity;
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(face.matrixWorld).project(s.camera);
      minimum = Math.min(minimum, point.y); maximum = Math.max(maximum, point.y);
    }
    return (maximum - minimum) / 2;
  });
}

test('manual clutch explains spring force, contact and release even while paused', async ({ page }, info) => {
  const errors = await openApp(page);
  await trackClutchScene(page);
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
  await setClutchSpeeds(page, 1800);
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'grip');
  await expect(page.locator('#clutch-engine-rpm')).toContainText('1800');
  await expect(page.locator('#clutch-input-rpm')).toContainText('1800');
  if (await page.locator('#mechanism-readout').isVisible()) {
    await page.locator('#mechanism-readout .close-readout').click();
  }
  // Refit through the real control: software WebGL may not finish an animated fit promptly.
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  const engaged = await clutchDiagram(page);
  expect(engaged.pressure).toBeCloseTo(engaged.discRight, 4);
  await expect(page.locator('#contact-state')).toContainText(/połącz|styk|kontakt|zaciśnię|zacisk/i);
  await settleVisibleScene(page);
  const heightFraction = await clutchProjectedHeight(page);
  expect(heightFraction, 'the default desktop camera must leave the clutch large enough to inspect').toBeGreaterThan(0.4);
  await info.attach('clutch-camera-scale', { body: JSON.stringify({ heightFraction }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('clutch-engaged.png') });
  const engagedCanvas = await page.locator('#scene canvas').screenshot({ path: info.outputPath('clutch-engaged-canvas.png') });

  await page.locator('[data-clutch-pedal="0.5"]').click();
  await setClutchSpeeds(page, 1800);
  await expect(page.locator('#clutch')).toHaveValue('50');
  await expect.poll(async () => Number((await page.locator('#clutch-clamp-value').innerText()).replace('%', ''))).toBeGreaterThan(0);
  await expect.poll(async () => Number((await page.locator('#clutch-clamp-value').innerText()).replace('%', ''))).toBeLessThan(100);
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'grip');
  await expect(page.locator('#contact-state')).not.toContainText(/z poślizgiem/i);
  const gripPixels = await visibleFrictionPixels(page);
  expect(gripPixels.green, 'the actual contact cue must contribute visible green pixels at the default camera').toBeGreaterThanOrEqual(8);
  await setClutchSpeeds(page, 650);
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'slip');
  await expect(page.locator('#contact-state')).toContainText(/poślizg/i);
  await expect(page.locator('#clutch-input-rpm')).toContainText('650');
  await expect(page.locator('#clutch-engine-rpm')).toContainText('1800');
  const slipPixels = await visibleFrictionPixels(page);
  expect(slipPixels.orange, 'the actual contact cue must contribute visible orange pixels during loaded slip').toBeGreaterThanOrEqual(8);
  await settleVisibleScene(page);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('clutch-friction-slip.png') });

  await page.locator('[data-clutch-pedal="1"]').click();
  await expect(page.locator('#clutch')).toHaveValue('100');
  await expect(page.locator('#clutch-clamp-value')).toHaveText('0%');
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'open');
  const openPixels = await visibleFrictionPixels(page);
  expect(openPixels.enabledCues).toBe(0);
  expect(openPixels.changed).toBe(0);
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
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'exploded');
  await expect(page.locator('#contact-state')).toContainText(/montaż|rozstrzel|warstw|rozsuni/i);
  const explodedPixels = await visibleFrictionPixels(page);
  expect(explodedPixels.enabledCues).toBe(0);
  expect(explodedPixels.changed).toBe(0);
  await info.attach('actual-friction-visibility', { body: JSON.stringify({ gripPixels, slipPixels, openPixels, explodedPixels }, null, 2), contentType: 'application/json' });
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  await page.screenshot({ path: info.outputPath('clutch-exploded.png') });
  await page.locator('#assemble-clutch').click();
  await expect(page.locator('#explode')).toHaveValue('0');
  await expect(page.locator('#clutch-display')).toHaveAttribute('data-state', 'assembled');
  await page.locator('[data-clutch-pedal="0"]').click();
  await expect(page.locator('#clutch')).toHaveValue('0');
  await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  await setClutchSpeeds(page, 1800);
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'grip');
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
  await trackClutchScene(page);
  await page.locator('#transmission-type').selectOption('manual');
  await page.locator('.view-tab[data-view="clutch"]').click();
  await expect(page.locator('#clutch-lesson')).toBeVisible();
  await page.locator('#pause').click();
  await page.locator('[data-clutch-pedal="1"]').click();
  await expect(page.locator('#clutch-clamp-value')).toHaveText('0%');
  await page.locator('[data-clutch-pedal="0"]').click();
  await expect(page.locator('#clutch-clamp-value')).toHaveText('100%');
  await expect(page.locator('#clutch-mechanism-detail')).toBeVisible();
  await assertCameraSettingsReadable(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  for (const selector of ['#clutch-lesson', '#clutch-status', '#clutch-mechanism-detail', '#clutch-engine-rpm', '#clutch-input-rpm', '#scene canvas']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  }
  await page.locator('#inspect-section').dispatchEvent('change');
  await page.waitForTimeout(250);
  await settleVisibleScene(page);
  expect(await clutchProjectedHeight(page), 'the phone camera must not shrink the clutch into an illegible thumbnail').toBeGreaterThan(0.3);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('phone-clutch.png') });
  await page.locator('#fullscreen').click();
  await page.locator('#inspect-section').dispatchEvent('change');
  await settleVisibleScene(page);
  expect(await clutchProjectedHeight(page), 'fullscreen must keep usable space for the mechanism below its explanation').toBeGreaterThan(0.3);
  const playback = await page.locator('.playback').boundingBox();
  expect(playback.y + playback.height).toBeLessThanOrEqual(845);
  await page.locator('[data-clutch-pedal="1"]').click();
  await expect(page.locator('#clutch-status')).toHaveAttribute('data-state', 'open');
  await assertCameraSettingsReadable(page);
  await page.locator('.visual-panel').screenshot({ path: info.outputPath('phone-clutch-fullscreen.png') });
  expect(errors).toEqual([]);
});

test('paused rendering sleeps, input wakes it and quality preserves the active simulation', async ({ page }, info) => {
  const errors = await openApp(page);
  await trackClutchScene(page);
  await page.locator('#render-quality').selectOption('economy');
  await assertCameraSettingsReadable(page);
  await page.locator('.view-tab[data-view="cylinder"]').click();
  await page.locator('#pause').click();
  await page.evaluate(() => {
    const scene = window.__clutchTestScene;
    const render = scene.render.bind(scene);
    scene.render = (...args) => { window.__performanceDraws++; return render(...args); };
    window.__performanceDraws = 0;
  });
  await expect.poll(() => page.evaluate(() => !!window.__clutchTestScene.cameraGoal), { timeout: 15000 }).toBe(false);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__performanceDraws);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__performanceDraws)).toBe(before);
  const angle = await page.evaluate(() => window.__clutchTestScene.sim.angle);
  await page.locator('#zoom-in').click();
  await expect.poll(() => page.evaluate(() => window.__performanceDraws)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__clutchTestScene.sim.angle)).toBe(angle);
  await page.locator('#render-quality').selectOption('high');
  await expect.poll(() => page.evaluate(() => window.__clutchTestScene.quality.settings(2).maxFps)).toBe(60);
  await page.locator('#render-quality').selectOption('economy');
  await expect.poll(() => page.evaluate(() => window.__clutchTestScene.engine.cylinders[0].charge.count)).toBe(32);
  await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => window.__clutchTestScene.sim.angle)).not.toBe(angle);
  await page.locator('#pause').click();
  await page.screenshot({ path: info.outputPath('quality-economy-cylinder.png'), fullPage: true });
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
      await page.bringToFront();
      await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
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
  if (!await page.locator('#clutch-schematic').evaluate(details => details.open)) await page.locator('#clutch-schematic summary').click();
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
        if (!await page.locator('#clutch-schematic').evaluate(details => details.open)) await page.locator('#clutch-schematic summary').click();
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
