import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

for (const [lineEnding, newline] of [['LF', '\n'], ['CRLF', '\r\n']]) test(`the actual application UI switches transmissions, retains four strokes and operates guided energy scenarios (${lineEnding})`, async t => {
  const window = new Window({ url: 'http://localhost/Engine/' });
  const saved = new Map();
  for (const key of ['window', 'document', 'CustomEvent', 'ResizeObserver', 'requestAnimationFrame']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'requestAnimationFrame' ? () => 0 : key === 'window' ? window : window[key] });
  }
  const errors = [];
  window.addEventListener('error', event => errors.push(event.error));
  window.document.body.innerHTML = '<div id="app"></div>';
  const originalError = console.error;
  let app;
  console.error = () => {};
  try {
    const source = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8'))
      .replace(/\r?\n/g, newline)
      .replace(/^import ['"].*\.css['"];\r?\n/gm, '')
      .replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, new URL('../src/main.js', import.meta.url)).href}'`);
    app = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { sim, player, updateUI, toastTimer };').toString('base64')}`);
    console.error = originalError;
    const $ = selector => window.document.querySelector(selector);
    const select = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new window.Event('change', { bubbles: true })); };
    const input = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new window.Event('input', { bubbles: true })); };
    const run = seconds => { app.sim.paused = false; for (let time = 0; time < seconds; time += 0.02) app.sim.update(0.02); app.updateUI(); };
    await t.test('default whole vehicle, all ten engines and manual clutch toggle remain available', () => {
      assert.ok($('.visual-panel').classList.contains('vehicle-mode'));
      assert.equal($('#cycle-panel').hidden, false);
      assert.equal(window.document.querySelectorAll('.engine-buttons [data-engine]').length, 10);
      $('#clutch-toggle').click(); assert.equal(app.sim.clutch, 1);
      $('#clutch-toggle').click(); assert.equal(app.sim.clutch, 0);
    });
    await t.test('camera pan toggle and device choice expose their current behavior', () => {
      $('#camera-pan').click();
      assert.equal($('#camera-pan').getAttribute('aria-pressed'), 'true');
      assert.equal($('#scene').dataset.cameraPan, 'true');
      assert.match($('.orbit-hint').textContent, /Przeciągnij: przesuwanie/);
      select('#camera-input', 'mouse');
      assert.match($('.orbit-hint').textContent, /kółko: zoom/);
      select('#camera-input', 'touchpad');
      assert.match($('.orbit-hint').textContent, /2 palce: przesuwanie/);
      $('#camera-pan').click();
      assert.equal($('#scene').dataset.cameraPan, 'false');
    });
    await t.test('DCT removes the pedal, exposes six gears and prepares the opposite clutch', () => {
      select('#transmission-type', 'dct');
      assert.equal($('#clutch-control').hidden, true);
      assert.equal($('#quick-clutch-control').hidden, true);
      assert.equal($('#quick-gear').options.length, 7);
      $('[data-gear="1"]').click(); run(2);
      assert.equal(app.sim.gear, 1);
      assert.match($('#dct-state').textContent, /przygotowany 2/);
      assert.match($('#dct-k2').textContent, /0 Nm/);
    });
    await t.test('hybrid exposes battery, range and DC/AC directions with finite initial values', () => {
      select('#transmission-type', 'hybrid');
      assert.equal(app.sim.driveLayout, 'fwd');
      assert.equal($('#hybrid-controls').hidden, false);
      assert.equal($('#gear-control')?.hidden ?? $('.gear-control').hidden, true);
      assert.equal($('#quick-gear').options.length, 3);
      assert.ok(!$('#hybrid-controls').textContent.includes('NaN'));
      select('#vehicle-layer', 'electric');
      assert.match($('.scene-legend').textContent, /DC.*AC/s);
      input('#quick-throttle', '30'); run(2);
      assert.ok(app.sim.hybrid.batteryPower > 0);
      assert.equal($('#energy-battery').dataset.direction, 'forward');
      select('#hybrid-range', 'P'); assert.equal(app.sim.hybrid.range, 'D');
    });
    await t.test('custom mounting is visible above the model and configuration updates remain consistent', () => {
      select('#transmission-type', 'manual');
      assert.equal($('#mount-settings').contains($('#drive-layout')), true);
      assert.equal($('#mount-settings').contains($('#engine-orientation')), true);
      assert.equal($('#mount-settings').hidden, false);
      select('#engine-orientation', 'transverse');
      assert.equal(app.sim.driveLayout, 'fwd');
      assert.equal($('#drive-layout').value, 'fwd');
      select('#drive-layout', 'rwd');
      assert.equal(app.sim.engineOrientation, 'longitudinal');
      assert.equal($('#engine-orientation').value, 'longitudinal');
    });
    await t.test('head inspection and a partial-clutch launch explain force, slip and disconnection', () => {
      select('#transmission-type', 'manual');
      $('.view-tab[data-view="engine"]').click();
      assert.ok([...$('#inspect-section').options].some(option => option.value === 'cylinderHead'));
      select('#inspect-section', 'cylinderHead');
      $('#inspect-description').click();
      assert.match($('#part-description').textContent, /zawor|kanał/);
      $('.view-tab[data-view="clutch"]').click();
      assert.equal($('#isolate-option').hidden, false);
      $('#clutch-slip-demo').click(); run(0.08);
      assert.equal(app.sim.gear, 1);
      assert.equal(app.sim.clutch, 0.5);
      assert.ok(app.sim.clutchSlip > 60);
      assert.ok(app.sim.slipPower > 0);
      assert.match($('#contact-detail').textContent, /Docisk.*poślizg.*ciepło/i);
      input('#quick-clutch', '80'); run(0.08);
      assert.equal(app.sim.transmittedTorque, 0);
      assert.match($('#drive-status').textContent, /rozłączone/);
      assert.match($('#mechanism-state').textContent, /brak docisku/);
      $('.view-tab[data-view="gearbox"]').click();
      select('#inspect-section', 'gear2'); app.updateUI();
      assert.match($('#shift-detail').textContent, /Koło biegu 2 obraca się swobodnie.*Bieg 1 jest włączony/);
      assert.equal($('[data-shift-stage="idle"]').classList.contains('active'), false);
      $('#reset').click();
    });
    await t.test('8AT hides the clutch, exposes eight gears and converter inspections', () => {
      $('.view-tab[data-view="hybrid"]').click();
      select('#transmission-type', 'automatic');
      assert.equal(app.sim.transmission, 'automatic', 'changing transmission leaves the hybrid-only view');
      select('#car-preset', '508-eat8-2018');
      assert.equal(app.sim.transmission, 'automatic');
      assert.equal(app.sim.engineOrientation, 'transverse');
      assert.equal(app.sim.driveLayout, 'fwd');
      assert.equal($('#quick-gear').options.length, 9);
      assert.equal($('#clutch-control').hidden, true);
      assert.equal($('#automatic-auto-option').hidden, false);
      $('.view-tab[data-view="clutch"]').click();
      assert.match($('.view-tab[data-view="clutch"]').textContent, /Konwerter/);
      assert.ok([...$('#inspect-section').options].some(option => option.value === 'stator'));
      $('#automatic-auto').checked = false;
      $('#automatic-auto').dispatchEvent(new window.Event('change', { bubbles: true }));
      $('[data-gear="8"]').click(); run(1.3);
      assert.equal(app.sim.gear, 8);
      assert.match($('#automatic-state').textContent, /Bieg 8/);
    });
    await t.test('911 and Corolla presets keep their real architecture and custom changes clear the preset', () => {
      select('#car-preset', '911-carrera-s-2025');
      assert.equal(app.sim.engineId, 'boxer6');
      assert.equal(app.sim.enginePlacement, 'rear');
      assert.equal($('#car-preset').value, '911-carrera-s-2025');
      select('#engine-placement', 'mid');
      assert.equal($('#car-preset').value, '');
      select('#car-preset', 'corolla-hybrid-2025');
      assert.equal(app.sim.transmission, 'hybrid');
      assert.equal(app.sim.engineOrientation, 'transverse');
      assert.equal(app.sim.engineId, 'r4');
    });
    await t.test('Ibiza preset and whole FWD differential expose cornering controls', () => {
      select('#car-preset', 'ibiza-mpi-2016');
      assert.equal(app.sim.engineId, 'r3');
      assert.equal(app.sim.transmission, 'manual');
      assert.equal(app.sim.driveLayout, 'fwd');
      select('#inspect-section', 'differential');
      assert.equal($('#diff-lesson').hidden, false);
      assert.equal($('#diff-demo').hidden, false);
      assert.match($('.scene-legend').textContent, /Lewa półoś.*Prawa półoś.*Satelity/);
      $('[data-turn="1"]').click();
      assert.equal(app.sim.turn, 1);
      assert.match($('#diff-detail').textContent, /mechanicznie.*satelity.*jedna półoś/s);
      $('[data-turn="0"]').click();
      assert.match($('#diff-detail').textContent, /bez obrotu na własnych osiach/);
      select('#car-preset', 'corolla-hybrid-2025');
    });
    await t.test('regeneration reverses the battery arrow and its guided scenario reaches the full-battery step', () => {
      select('#scenario-select', 'regen'); $('#scenario-start').click();
      assert.equal(app.sim.paused, true);
      assert.equal(app.player.id, 'regen');
      $('#scenario-next').click();
      assert.ok(app.sim.hybrid.batteryPower < 0);
      assert.equal($('#energy-battery').dataset.direction, 'reverse');
      $('#scenario-next').click();
      assert.equal(app.sim.hybrid.soc, 0.85);
      assert.equal($('#energy-battery').dataset.active, 'false');
    });
    await t.test('4WD selector enforces stopped low-range changes and reset restores the original configuration', () => {
      select('#transmission-type', 'manual'); select('#drive-layout', 'partTime');
      assert.equal($('#transfer-mode-option').hidden, false);
      select('#transfer-mode', '4L'); assert.equal(app.sim.transferRatio, 2.5);
      app.sim.speed = 5; select('#transfer-mode', '4H'); assert.equal(app.sim.driveMode, '4L');
      $('#reset').click();
      assert.equal(app.sim.transmission, 'manual');
      assert.equal(app.sim.driveLayout, 'rwd');
      assert.equal($('#cycle-panel').hidden, false);
      assert.equal($('#hybrid-controls').hidden, true);
    });
    assert.deepEqual(errors, []);
    const ids = [...window.document.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    console.error = originalError;
    clearTimeout(app?.toastTimer);
    await window.happyDOM.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
