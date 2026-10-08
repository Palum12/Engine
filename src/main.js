import { POWERTRAIN_CONTROLS, VEHICLE_TOOLS, SCENARIO_TOOLS } from './powertrain-ui.js';
import { appTemplate } from './ui/app-template.js';
import { PARTS } from './ui/part-descriptions.js';
import { updateDrivingHelp } from './ui/driving-help.js';
import { createTelemetry } from './ui/telemetry.js';
import { createFrameLoop } from './frame-loop.js';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-ext-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-ext-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-ext-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-sans/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-ext-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import './style.css';
import './layout.css';
import './inspection.css';
import './cycle.css';
import './powertrain.css';
import './camera.css';
import './suspension.css';
import './clutch.css';
import { getInspections } from './inspection.js';
import { TRANSMISSIONS, DRIVE_LAYOUTS, evaluateTraction } from './powertrain.js';
import { ScenarioPlayer, SCENARIOS } from './scenarios.js';
import { EngineScene } from './scene.js';
import { getEngine } from './engines.js';
import { manualClutchState } from './manual-clutch.js';
import { SUSPENSION_CONTROLS, SUSPENSION_TELEMETRY, suspensionPartDescription } from './suspension-ui.js';
import { CAR_PRESETS, getCarPreset } from './car-presets.js';
import { applyCarPreset } from './car-configuration.js';
import { Simulation, cycleDegrees, strokeIndex } from './simulation.js';

const icons = {
  piston: '<path d="M6 3h12v7H6zM9 6h6M12 10v8m-3 0h6v3H9z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  power: '<path d="M12 2v10M6.5 5a9 9 0 1 0 11 0"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  rotate: '<path d="M4 12a8 8 0 0 1 14-5l3 3M21 4v6h-6M20 13a8 8 0 0 1-14 5l-3-3m0 6v-6h6"/>',
  pan: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const sim = new Simulation();
const player = new ScenarioPlayer(sim);
let selectedCylinder = 0;
let mode = 'engine';
let scene;
let selectedPart = null;
let toastTimer;
let frameLoop = null;
let readoutMuted = window.matchMedia('(max-width:600px)').matches;
let mechanismReadoutRequested = false;
let selectedPresetId = '';
let manualClutchExplosion = 0;

const app = document.querySelector('#app');



document.querySelector('#app').innerHTML = appTemplate(icon);

const controlsTemplate = document.createElement('template');
controlsTemplate.innerHTML = POWERTRAIN_CONTROLS;
document.querySelector('#mount-settings').append(controlsTemplate.content.querySelector('.powertrain-config'));
document.querySelector('.gear-control').after(controlsTemplate.content.querySelector('.hybrid-controls'), controlsTemplate.content.querySelector('.traction-settings'));
document.querySelector('#scene').insertAdjacentHTML('beforebegin', VEHICLE_TOOLS);
document.querySelector('.playback').insertAdjacentHTML('beforebegin', SCENARIO_TOOLS);
document.querySelector('.view-tabs').insertAdjacentHTML('beforeend', '<button class="view-tab" data-view="hybrid" aria-pressed="false">Hybryda</button><button class="view-tab" data-view="suspension" aria-pressed="false">Zawieszenie</button>');
document.querySelector('.workspace').insertAdjacentHTML('beforeend', SUSPENSION_CONTROLS);
document.querySelector('#cycle-panel').insertAdjacentHTML('afterend', SUSPENSION_TELEMETRY);
document.querySelector('#quick-clutch').closest('label').id = 'quick-clutch-control';
document.querySelector('#clutch').closest('.pedal-control').id = 'clutch-control';
document.querySelector('#quick-gear').closest('label').insertAdjacentHTML('beforebegin', '<button id="quick-brake" class="secondary-button" aria-pressed="false" hidden>Hamulec</button>');
document.querySelector('#inspection-toolbar').insertAdjacentHTML('beforeend', '<div class="lesson-tools" id="dct-lesson" hidden><span id="dct-k1"></span><span id="dct-k2"></span><strong id="dct-state"></strong><button id="dct-shift-step" class="secondary-button">Następny etap</button></div>');
document.querySelector('#inspection-toolbar').insertAdjacentHTML('beforeend', '<div class="lesson-tools" id="automatic-lesson" hidden><span id="automatic-slip"></span><span id="automatic-lockup"></span><strong id="automatic-state"></strong></div>');
document.querySelector('.clutch-actions').insertAdjacentHTML('beforeend', '<button class="secondary-button" id="clutch-slip-demo">Pokaż ruszanie z poślizgiem</button>');
document.querySelector('#gear-lesson').insertAdjacentHTML('afterbegin', '<label>Obserwowany bieg<select id="synchronizer-gear">' + [1,2,3,4,5].map(n => `<option value="${n}"${n === 2 ? ' selected' : ''}>${n}</option>`).join('') + '</select></label><button class="secondary-button" id="synchronizer-demo">Pokaż zmianę biegu</button>');
document.querySelector('#dct-lesson').insertAdjacentHTML('beforeend', '<small id="dct-layout-note">Schemat DCT ma 6 biegów i pokazuje zasadę dwóch gałęzi. Nazwa F1 DCT w drogowych Ferrari oznacza dwusprzęgłową skrzynię; model nie odwzorowuje przekładni bolidu ani dokładnej konstrukcji Ferrari.</small>');
document.querySelector('#inspect-description').insertAdjacentHTML('afterend', '<button class="quiet-button" id="show-head" hidden>Zobacz głowicę</button>');
document.querySelector('#diff-lesson').insertAdjacentHTML('beforeend', '<label>Rozłóż mechanizm<input id="diff-explode" type="range" min="0" max="100" value="0" aria-label="Rozłożenie mechanizmu różnicowego"></label>');

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const fmt = new Intl.NumberFormat('pl-PL');
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200);
}
function choosePart(part, cylinder) {
  selectedPart = part;
  if (cylinder !== undefined) {
    selectedCylinder = cylinder;
    $('#cylinder-number').value = cylinder;
    scene?.selectCylinder(cylinder);
  }
  let [title, description] = suspensionPartDescription(part, sim.suspension.type) || PARTS[part] || PARTS.block;
  if (part === 'crank') description += ` Przykładowa kolejność zapłonu ${getEngine(sim.engineId).name}: ${getEngine(sim.engineId).firingOrder.join(' → ')}.`;
  if (part === 'banks' || part === 'timing') description = `${getEngine(sim.engineId).architecture}. ${getEngine(sim.engineId).note} Wałki obracają się dwa razy wolniej od wału korbowego. Trasa napędu, przekładnie pośrednie i dźwigienki są schematyczne; nie służą do ustawiania rozrządu w samochodzie.`;
  $('#part-title').textContent = title;
  $('#part-description').textContent = description;
  $('#part-panel').hidden = false;
}
function changeView(value) {
  stopDifferentialDemo();
  if (value === 'suspension') { player.stop(); cycleTransition = null; }
  if (value === 'hybrid' && sim.transmission !== 'hybrid') { player.stop(); sim.setTransmission('hybrid'); updateEngineUI(); updatePowertrainConfiguration(); updateConfiguration(); }
  if (value === 'transfer' && !['awd', 'quattro', 'partTime'].includes(sim.driveLayout)) { sim.setDriveLayout('partTime'); updatePowertrainConfiguration(); }
  if (sim.transmission === 'hybrid' && ['clutch', 'gearbox'].includes(value)) value = 'hybrid';
  if (value === 'clutch' && sim.transmission === 'manual') setClutchExplosion(manualClutchExplosion, false);
  mode = value;
  sim.suspensionActive = value === 'suspension';
  scene?.setView(value);
  $$('.view-tab').forEach(button => {
    const active = button.dataset.view === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#view-caption').textContent = { engine: `Przekrój ${getEngine(sim.engineId).name} · ${getEngine(sim.engineId).cylinders} cylindrów`, cylinder: 'Komora spalania, zawory i wtryskiwacz', drive: 'Cały pojazd · od silnika do czterech kół', 'drive-detail': 'Cały pojazd · wybierz mechanizm i zbliżenie', clutch: sim.transmission === 'automatic' ? 'Konwerter · pompa, turbina, kierownica i lock-up' : sim.transmission === 'dct' ? 'Mokre pakiety K1 / K2 · sterowanie dociskiem' : 'Tarcza, docisk i mechanizm wysprzęglania', gearbox: sim.transmission === 'automatic' ? 'Automat hydrokinetyczny · osiem przełożeń planetarnych' : sim.transmission === 'dct' ? 'DCT · bieg aktywny i przygotowany' : 'Stałe zazębienie i wybór przełożenia', turbo: 'Energia spalin napędza sprężarkę', differential: 'Dwa koła · różne prędkości · wspólny kosz', timing: 'Dwa obroty wału na jeden obrót wałka', oil: 'Obieg smarowania · kierunki przepływu', fuel: 'Droga paliwa i przygotowanie mieszanki', hybrid: 'e-CVT · mechanika, bateria i prąd', transfer: 'Przednia / tylna oś · reduktor lub dyferencjał' }[value];
  const whole = ['drive', 'drive-detail'].includes(value);
  const suspension = value === 'suspension';
  if (suspension) $('#view-caption').textContent = 'Koło → prowadzenie → sprężyna i amortyzator → nadwozie';
  $('.visual-panel').classList.toggle('vehicle-mode', whole);
  $('.visual-panel').classList.toggle('suspension-mode', suspension);
  $('.visual-panel').classList.toggle('manual-clutch-mode', value === 'clutch' && sim.transmission === 'manual');
  $('.control-panel').hidden = suspension;
  $('#suspension-controls').hidden = !suspension;
  $('#suspension-telemetry').hidden = !suspension;
  $('#mount-settings').hidden = suspension;
  $('.engine-picker').hidden = suspension;
  $('.quick-controls').hidden = suspension;
  $('.speed-select').hidden = suspension;
  $('.learning-strip').hidden = suspension;
  $('#vehicle-tools').hidden = !whole;
  $('#scenario-panel').hidden = !['drive', 'drive-detail', 'clutch', 'gearbox', 'differential', 'transfer', 'hybrid'].includes(value);
  $('#cycle-panel').hidden = suspension || ['clutch', 'gearbox'].includes(value);
  configureInspection(value);
  updateReadouts();
  $('#flow-option').hidden = !['drive', 'drive-detail', 'clutch', 'gearbox', 'turbo', 'oil', 'fuel', 'hybrid'].includes(value);
  $('.scene-legend').innerHTML = ['drive', 'drive-detail', 'clutch', 'gearbox'].includes(value)
    ? '<span><i style="--dot:#ffc35a"></i>Przepływ momentu</span><span><i style="--dot:#68c9ed"></i>Wejście skrzyni</span>'
    : value === 'turbo' ? '<span><i style="--dot:#e68565"></i>Spaliny</span><span><i style="--dot:#f5b74e"></i>Ciepłe powietrze</span><span><i style="--dot:#69d5ee"></i>Chłodne powietrze</span>' : '<span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#c4d0dc"></i>Spaliny</span>';
  if (value === 'clutch' && sim.transmission === 'manual') $('.scene-legend').innerHTML = '<span><i style="--dot:#75efad"></i>Styk z zaciskiem</span><span><i style="--dot:#ffa24f"></i>Poślizg i ciepło</span><span><i style="--dot:#9fb8ca"></i>Szczelina: brak zacisku</span><span><i style="--dot:#ffffff"></i>Moment</span><span><i style="--dot:#68c9ed"></i>Nacisk łożyska / ruch docisku</span>';
  if (value === 'oil') $('.scene-legend').innerHTML = '<span><i style="--dot:#70edb1"></i>Olej pod ciśnieniem</span><span><i style="--dot:#319b74"></i>Spływ oleju</span>';
  if (value === 'differential') $('.scene-legend').innerHTML = '<span><i style="--dot:#69d5ff"></i>Lewe koło</span><span><i style="--dot:#f7ba55"></i>Prawe koło</span><span><i style="--dot:#e68565"></i>Satelity</span>';
  if (suspension) $('.scene-legend').innerHTML = '<span><i style="--dot:#f5be4f"></i>Sprężyna / resor</span><span><i style="--dot:#d68a6e"></i>Amortyzator</span><span><i style="--dot:#68c9ed"></i>Prowadzenie koła</span>';
  if (whole || value === 'hybrid') updateVehicleLegend();
  $('#explode-control').hidden = value !== 'clutch' || sim.transmission === 'automatic';
  $('#next-stroke').hidden = suspension || ['clutch', 'gearbox'].includes(value);
  $('#part-panel').hidden = true;
  selectedPart = null;
  updateUI();
}
function configureInspection(view) {
  const entries = getInspections(view, sim);
  $('#inspection-toolbar').hidden = !entries;
  $('.visual-panel').classList.toggle('inspecting', Boolean(entries));
  updateLessons();
  if (!entries) return;
  $('#inspect-section').innerHTML = entries.map(entry => `<option value="${entry.id}">${entry.label}</option>`).join('');
  const section = entries.some(entry => entry.id === scene?.inspection) ? scene.inspection : 'all';
  if (scene) scene.inspection = section;
  $('#inspect-section').value = section;
  $('.visual-panel').dataset.inspection = section;
  $('#isolate-option').hidden = ['differential', 'transfer'].includes(view) || view === 'clutch' && sim.transmission !== 'manual' || view === 'gearbox' && sim.transmission === 'manual';
  $('#isolate').checked = scene?.isolate || false;
  $('#inspection-note').textContent = (entries.find(entry => entry.id === $('#inspect-section').value) || entries[0]).hint;
}
function inspectSection() {
  if (mode !== 'differential' && !['differential', 'finalDrive', 'frontAxle', 'rearAxle'].includes($('#inspect-section').value)) stopDifferentialDemo();
  if (mode === 'fuel' && ['carburetor','highPressurePump'].includes($('#inspect-section').value)) {
    sim.injection = $('#inspect-section').value === 'carburetor' ? 'carb' : 'gdi';
    updateConfiguration();
  }
  scene?.inspect($('#inspect-section').value, $('#isolate').checked);
  $('.visual-panel').dataset.inspection = $('#inspect-section').value;
  const entry = getInspections(mode, sim).find(entry => entry.id === $('#inspect-section').value);
  $('#inspection-note').textContent = entry.hint;
  $('#part-panel').hidden = true;
  updateReadouts();
  updateLessons();
  if (['drive', 'drive-detail'].includes(mode)) updateVehicleLegend();
}
function updateReadouts() {
  const relevant = ['clutch', 'gearbox', 'turbo'].includes(mode) || ['drive', 'drive-detail'].includes(mode) && ['clutch','converter','gearbox','planetary','automaticClutches','valveBody','turbo'].includes(scene?.inspection);
  const turbo = mode === 'turbo' || mode === 'drive-detail' && scene?.inspection === 'turbo';
  const explodedClutch = mode === 'clutch' && sim.transmission === 'manual' && Number($('#explode').value) > 0;
  const detailLesson = sim.transmission === 'manual' && (mode === 'clutch' || mode === 'gearbox' && ['selector', 'synchronizer'].includes($('#inspect-section').value));
  const visible = relevant && $('#labels').checked && !readoutMuted && (!(explodedClutch || detailLesson) || mechanismReadoutRequested);
  $('#mechanism-readout').hidden = !visible || turbo;
  $('#turbo-readout').hidden = !visible || !turbo;
  $('#show-readout').hidden = !relevant || visible;
}
function lessonView() {
  return ['drive', 'drive-detail'].includes(mode) ? scene?.inspection ?? $('#inspect-section').value : mode;
}
function updateLessons() {
  const view = lessonView();
  const manualClutchLesson = view === 'clutch' && sim.transmission === 'manual';
  $('#show-head').hidden = !['engine', 'timing', 'drive', 'drive-detail'].includes(mode);
  $('#spread-clutch').hidden = !['clutch'].includes(mode);
  $('#clutch-lesson').hidden = !manualClutchLesson;
  $('#clutch-status').hidden = !manualClutchLesson || mode !== 'clutch';
  $('#contact-detail').hidden = !manualClutchLesson;
  $('#gear-lesson').hidden = view !== 'gearbox' || sim.transmission !== 'manual';
  $('#dct-lesson').hidden = sim.transmission !== 'dct' || !['clutch', 'gearbox'].includes(view);
  $('#automatic-lesson').hidden = sim.transmission !== 'automatic' || !['clutch', 'converter', 'gearbox', 'planetary', 'automaticClutches', 'valveBody', 'pump', 'turbine', 'stator', 'lockup'].includes(view);
  $('#diff-lesson').hidden = !['differential','finalDrive','frontAxle','rearAxle'].includes(view);
  $('#diff-demo').hidden = !['differential','finalDrive','frontAxle','rearAxle'].includes(view);
}

function inspectedDifferential() {
  return mode === 'differential' ? scene?.finalDrive : scene?.vehicle[scene?.inspection === 'rearAxle' ? 'rear' : sim.driveLayout === 'fwd' || scene?.inspection === 'frontAxle' ? 'front' : 'rear'];
}
function stopDifferentialDemo() {
  if (scene) [scene.finalDrive, scene.vehicle.front, scene.vehicle.rear].forEach(diff => { diff.demo = false; });
}
function setPedal(name, value) {
  if (name === 'clutch' && sim.transmission !== 'manual') return;
  player.stop();
  sim[name] = Math.max(0, Math.min(1, value));
  $(`#${name}`).value = Math.round(sim[name] * 100);
  $(`#${name}-value`).innerHTML = `${Math.round(sim[name] * 100)}<span>%</span>`;
  $(`#${name}`).style.setProperty('--fill', `${sim[name] * 100}%`);
  $(`#quick-${name}`).value = Math.round(sim[name] * 100);
  $(`#quick-${name}-value`).textContent = `${Math.round(sim[name] * 100)}%`;
  $(`#quick-${name}`).style.setProperty('--fill', `${sim[name] * 100}%`);
  if (name === 'clutch') {
    $('#clutch-toggle').setAttribute('aria-pressed', sim.clutch >= 0.85);
    $('#clutch-toggle').innerHTML = `${sim.clutch >= 0.85 ? 'Zwolnij pedał' : 'Wciśnij pedał'} <kbd>Shift</kbd>`;
  }
  updateUI();
}
function shift(value) {
  player.stop();
  if (!sim.shift(value)) toast(sim.shiftTarget !== null ? 'Dokończ obecną zmianę biegu.' : 'Najpierw wciśnij sprzęgło co najmniej do 85%.');
  else if (value && sim.transmission === 'manual' && mode === 'gearbox' && scene?.inspection !== 'all') {
    $('#inspect-section').value = `gear${value}`;
    inspectSection();
  }
  updateUI();
}
let cycleTransition = null;
function pause(value = !sim.paused) {
  cycleTransition = null;
  sim.paused = value;
  $('#pause').innerHTML = icon(sim.paused ? 'play' : 'pause');
  $('#pause').setAttribute('aria-label', sim.paused ? 'Wznów symulację' : 'Wstrzymaj symulację');
  updateUI();
}
function setCycle(angle, animate = false) {
  pause(true);
  const current = cycleDegrees(sim.angle, selectedCylinder, sim.engineId);
  const delta = (angle - current + 720) % 720;
  if (animate && delta > 0.1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cycleTransition = { start: sim.angle, delta, elapsed: 0, duration: Math.max(0.7, delta / 220) };
  } else sim.angle = ((sim.angle + angle - current) % 720 + 720) % 720;
  updateUI();
}

try {
  scene = new EngineScene($('#scene'), choosePart, sim);
} catch (error) {
  console.error(error);
  const fallback = document.createElement('div');
  fallback.className = 'webgl-fallback';
  fallback.innerHTML = '<h2>Model 3D wymaga WebGL 2</h2><p>Włącz akcelerację sprzętową lub otwórz aplikację w aktualnej wersji Chrome, Edge, Firefox albo Safari. Sterowanie i opisy pozostają dostępne.</p>';
  $('#scene').append(fallback);
}
$('#scene').addEventListener('renderlost', () => { pause(true); toast('Utracono kontekst grafiki. Odśwież stronę, aby przywrócić model.'); });
$$('.view-tab[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
$('#try-drive').addEventListener('click', () => { changeView('drive-detail'); $('.visual-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$$('[data-stroke]').forEach(button => button.addEventListener('click', () => setCycle(Number(button.dataset.stroke) * 180 + 90, true)));
$('#cycle-angle').addEventListener('input', event => setCycle(Number(event.target.value)));
$('#cylinder-number').addEventListener('change', event => {
  cycleTransition = null;
  selectedCylinder = Number(event.target.value);
  scene?.selectCylinder(selectedCylinder);
  updateUI();
});
$('#pause').addEventListener('click', () => pause());
$('#next-stroke').addEventListener('click', () => setCycle(((strokeIndex(sim.angle, selectedCylinder, sim.engineId) + 1) % 4) * 180 + 90, true));
$('#animation-speed').addEventListener('change', event => { sim.animationScale = Number(event.target.value); });
$('#suspension-type').addEventListener('change', event => {
  sim.suspension.setType(event.target.value);
  scene?.suspension.update(sim);
  scene?.refreshLabels();
  configureInspection(mode);
  scene?.setView(mode, true);
  updateSuspensionUI();
  if (selectedPart?.startsWith('suspension') && !$('#part-panel').hidden) {
    if (selectedPart === 'suspensionRocker' && !['pushrod', 'pullrod'].includes(sim.suspension.type)) {
      $('#part-panel').hidden = true;
      selectedPart = null;
    } else choosePart(selectedPart);
  }
});
$('#suspension-road').addEventListener('change', event => { sim.suspension.setRoad(event.target.value); updateSuspensionUI(); });
for (const [name, setter, divisor] of [['speed', 'setSpeed', 1], ['amplitude', 'setAmplitude', 100], ['spring', 'setSpring', 100], ['damping', 'setDamping', 100]]) {
  $(`#suspension-${name}`).addEventListener('input', event => {
    sim.suspension[setter](Number(event.target.value) / divisor);
    updateSuspensionUI();
  });
}
$('#suspension-tempo').addEventListener('change', event => { sim.suspensionTempo = Number(event.target.value); });
$('#suspension-reset').addEventListener('click', () => { sim.suspension.reset(); scene?.suspension.update(sim); updateSuspensionUI(); });
$('#suspension-step').addEventListener('click', () => {
  pause(true);
  sim.suspension.update(0.1);
  scene?.suspension.update(sim);
  updateSuspensionUI();
});
['throttle', 'clutch'].forEach(name => $(`#${name}`).addEventListener('input', event => setPedal(name, Number(event.target.value) / 100)));
['throttle', 'clutch'].forEach(name => $(`#quick-${name}`).addEventListener('input', event => setPedal(name, Number(event.target.value) / 100)));
$('#quick-gear').addEventListener('change', event => { player.stop(); if (sim.transmission === 'hybrid') setHybridRange(event.target.value); else shift(Number(event.target.value)); });
$('#clutch-toggle').addEventListener('click', () => setPedal('clutch', sim.clutch >= 0.85 ? 0 : 1));
$$('[data-gear]').forEach(button => button.addEventListener('click', () => shift(Number(button.dataset.gear))));
$$('[data-injection]').forEach(button => button.addEventListener('click', () => {
  player.stop();
  stopDifferentialDemo();
  sim.injection = button.dataset.injection;
  updateConfiguration();
  if (mode === 'fuel' && ['carburetor','highPressurePump'].includes(scene?.inspection)) {
    $('#inspect-section').value = sim.injection === 'carb' ? 'carburetor' : sim.injection === 'gdi' ? 'highPressurePump' : 'fuel';
    inspectSection();
  }
}));
function updateConfiguration() {

  $$('[data-injection]').forEach(button => {
    const active = button.dataset.injection === sim.injection;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#injection-note').textContent = sim.injection === 'carb' ? 'Gaźnik zasysa paliwo w zwężce przed kolektorem. Obejrzyj widok „Paliwo / gaźnik”.' : sim.injection === 'mpi' ? 'Paliwo trafia do kanału przed zaworem dolotowym.' : 'Paliwo trafia wprost do cylindra — tutaj przy sprężaniu.';
  $('#turbo').checked = sim.turbo;
  $('#turbo-label').textContent = sim.turbo ? 'Turbosprężarka aktywna' : 'Silnik wolnossący';
  $('#boost-row').hidden = !sim.turbo;
  updatePresetUI();
}
$('#timing-type').addEventListener('change', event => { player.stop(); sim.timing = event.target.value; updateTimingNote(); updatePresetUI(); });
function setClutchExplosion(value, frame = true) {
  if (sim.transmission === 'manual') manualClutchExplosion = value;
  if (scene) {
    scene.drive.exploded = value;
    scene.dct.exploded = value;
    if (frame) scene.setView(mode);
  }
  $('#explode').value = Math.round(value * 100);
  $('#explode-value').textContent = `${Math.round(value * 100)}%`;
  updateReadouts();
  updateLessonState();
}
$$('[data-clutch-pedal]').forEach(button => button.addEventListener('click', () => setPedal('clutch', Number(button.dataset.clutchPedal))));
$('#assemble-clutch').addEventListener('click', () => setClutchExplosion(0));
$('#spread-clutch').addEventListener('click', () => setClutchExplosion(0.7));
$('#show-head').addEventListener('click', () => {
  changeView('engine');
  $('#inspect-section').value = 'cylinderHead';
  $('#isolate').checked = true;
  inspectSection();
  choosePart('cylinderHead');
});
$('#shift-step').addEventListener('click', () => {
  if (sim.shiftTarget === null) return;
  pause(true);
  const next = sim.shiftProgress < 0.25 ? 0.5 : sim.shiftProgress < 0.75 ? 0.875 : 1.001;
  const duration = (next - sim.shiftProgress) * 2.4;
  for (let t = 0; t < duration; t += 0.002) sim.integrate(Math.min(0.002,duration-t));
  updateUI();
});
$('#synchronizer-gear').addEventListener('change', event => {
  scene?.drive.setSynchronizerGear(Number(event.target.value));
  if (scene?.inspection === 'synchronizer') scene.setView(mode, true);
  updateUI();
});
$('#synchronizer-demo').addEventListener('click', () => {
  if (sim.transmission !== 'manual') return;
  player.stop(); stopDifferentialDemo();
  const target = Number($('#synchronizer-gear').value);
  const from = target === 1 ? 2 : 1;
  Object.assign(sim, { speed: 6, gear: from, shiftTarget: null, shiftProgress: 0, throttle: 0, clutch: 1, brake: 0, rpm: 2000, running: true, stalled: false });
  sim.traction = evaluateTraction(sim, 0);
  sim.inputOmega = sim.outputOmega * sim.ratios[from];
  sim.refreshClutchState();
  sim.shift(target);
  changeView('gearbox');
  scene?.drive.setSynchronizerGear(target);
  $('#inspect-section').value = 'synchronizer';
  inspectSection();
  pause(true);
  updateUI();
});
$('#diff-demo').addEventListener('click', () => {
  if (!scene) return;
  player.stop();
  const diff = inspectedDifferential();
  const active = !diff.demo;
  stopDifferentialDemo();
  diff.demo = active;
  if (active) {
    if (!sim.turn) sim.turn = 1;
    diff.openCarrier = true;
    $('#diff-open').checked = true;
    pause(false);
  }
  updateUI();
});
$('#clutch-slip-demo').addEventListener('click', () => {
  if (sim.transmission !== 'manual') return;
  player.stop(); stopDifferentialDemo();
  Object.assign(sim, { speed: 0, gear: 1, shiftTarget: null, shiftProgress: 0, throttle: 0.32, clutch: 0.5, brake: 0, rpm: 1800, running: true, stalled: false, inputOmega: 0 });
  sim.traction = evaluateTraction(sim, 0);
  setClutchExplosion(0);
  pause(false);
  toast('Półsprzęgło: porównaj obroty silnika i tarczy. Zmieniaj pedał; mniejszy docisk ogranicza moment, a poślizg wytwarza ciepło.');
});
$$('[data-turn]').forEach(button => button.addEventListener('click', () => { player.stop(); sim.turn = Number(button.dataset.turn); updateUI(); }));
$('#diff-open').addEventListener('change', event => { if (scene) [scene.finalDrive, scene.vehicle.front, scene.vehicle.rear].forEach(diff => { diff.openCarrier = event.target.checked; }); });
$('#turbo').addEventListener('change', event => {
  player.stop();
  sim.turbo = event.target.checked;
  updateConfiguration();
  if (sim.turbo) toast('Turbo włączone. Dodaj gazu: doładowanie wzrośnie wraz z obrotami.');
});
$('#cutaway').addEventListener('change', event => { if (scene) scene.cutaway = event.target.checked; });
window.matchMedia('(max-width:600px)').addEventListener('change', event => { if (event.matches) readoutMuted = true; updateReadouts(); });
$('#labels').addEventListener('change', event => { if (scene) scene.labels = event.target.checked; updateReadouts(); });
$$('.close-readout').forEach(button => button.addEventListener('click', () => { readoutMuted = true; mechanismReadoutRequested = false; updateReadouts(); }));
$('#show-readout').addEventListener('click', () => { readoutMuted = false; mechanismReadoutRequested = true; $('#labels').checked = true; if (scene) scene.labels = true; updateReadouts(); });
$('#flow').addEventListener('change', event => { if (scene) { [scene.drive, scene.turbo, scene.systems, scene.dct, scene.automatic, scene.hybrid].forEach(model => { model.showFlow = event.target.checked; }); } });
$('#inspect-section').addEventListener('change', inspectSection);
$('#isolate').addEventListener('change', inspectSection);
$('#inspect-description').addEventListener('click', () => choosePart(getInspections(mode, sim).find(entry => entry.id === $('#inspect-section').value).part));
$('#turbo-activate').addEventListener('click', () => { player.stop(); sim.turbo = !sim.turbo; updateConfiguration(); updateUI(); });
$('#zoom-in').addEventListener('click', () => scene?.zoom(0.8));
$('#zoom-out').addEventListener('click', () => scene?.zoom(1.25));
function updateCameraInput() {
  const pan = $('#camera-pan').getAttribute('aria-pressed') === 'true';
  const device = $('#camera-input').value;
  scene?.cameraInput.setPan(pan);
  scene?.cameraInput.setDevice(device);
  $('#scene').dataset.cameraPan = pan;
  $('#camera-pan').title = pan ? 'Wyłącz, aby przeciąganie obracało model' : 'Włącz, aby przeciąganie przesuwało kamerę';
  $('.orbit-hint span').textContent = `Przeciągnij: ${pan ? 'przesuwanie' : 'obrót'} · ${device === 'mouse' ? 'kółko: zoom' : '2 palce: przesuwanie · szczypnięcie: zoom'}`;
}
$('#camera-pan').addEventListener('click', () => {
  $('#camera-pan').setAttribute('aria-pressed', $('#camera-pan').getAttribute('aria-pressed') !== 'true');
  updateCameraInput();
});
$('#camera-input').addEventListener('change', updateCameraInput);
$('#camera-reset').addEventListener('click', () => { if (getInspections(mode, sim)) { $('#inspect-section').value = 'all'; $('#isolate').checked = false; inspectSection(); } else scene?.setView(mode); });
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('.visual-panel').requestFullscreen) await $('.visual-panel').requestFullscreen();
    else toast('Pełny ekran nie jest dostępny w tej przeglądarce. Obróć telefon poziomo.');
  } catch { toast('Przeglądarka nie pozwoliła włączyć pełnego ekranu.'); }
});
$('#ignition').addEventListener('click', () => {
  player.stop();
  if (sim.transmission === 'hybrid') sim.hybridEnabled = !sim.hybridEnabled;
  else if (sim.running) { sim.running = false; sim.stalled = false; }
  else if (!sim.start()) toast('Aby uruchomić silnik, wybierz N lub wciśnij sprzęgło.');
  updateUI();
});
$('#brake').addEventListener('click', () => {
  player.stop();
  sim.brake = sim.brake ? 0 : 1;
  $('#brake').setAttribute('aria-pressed', Boolean(sim.brake));
});
$('#reset').addEventListener('click', () => {
  player.stop();
  sim.reset();
  if (scene) { scene.finalDrive.demo = false; [scene.finalDrive, scene.vehicle.front, scene.vehicle.rear].forEach(diff => { diff.openCarrier = false; diff.exploded = 0; }); scene.dct.exploded = 0; scene.drive.exploded = 0; }
  $('#diff-open').checked = false;
  $('#diff-explode').value = 0;
  manualClutchExplosion = 0;
  $('#explode').value = 0;
  $('#explode-value').textContent = '0%';
  $('#timing-type').value = 'belt';
  scene?.setEngine('r4');
  updateEngineUI();
  selectedCylinder = 0;
  scene?.selectCylinder(0);
  $('#cylinder-number').value = 0;
  setPedal('throttle', 0);
  setPedal('clutch', 0);
  pause(false);
  $('#animation-speed').value = 0.02;
  $('#brake').setAttribute('aria-pressed', 'false');
  updateConfiguration();
  updatePowertrainConfiguration();
  updateUI();
  changeView('engine');
  toast('Przywrócono silnik wolnossący z wtryskiem pośrednim.');
});
$('#close-part').addEventListener('click', () => { $('#part-panel').hidden = true; selectedPart = null; });
$('#explain-cycle').addEventListener('click', () => { $('.visual-panel').append($('#cycle-dialog')); $('#cycle-dialog').showModal(); });
$('#close-cycle').addEventListener('click', () => $('#cycle-dialog').close());
$('#cycle-dialog').addEventListener('click', event => { if (event.target === $('#cycle-dialog')) $('#cycle-dialog').close(); });
$('#render-quality').addEventListener('change', event => scene?.setQuality(event.target.value));
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('click', event => { if (event.target === $('#help-dialog')) $('#help-dialog').close(); });
let previousClutch = null;
window.addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName) || $('#help-dialog').open || $('#cycle-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) pause(); }
  if (mode === 'suspension') return;
  if (event.key === 'Shift' && !event.repeat && sim.transmission === 'manual') { previousClutch = sim.clutch; setPedal('clutch', 1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); setPedal('throttle', sim.throttle + 0.05); }
  if (event.key === 'ArrowDown') { event.preventDefault(); setPedal('throttle', sim.throttle - 0.05); }
  if (sim.transmission !== 'hybrid' && (/^[1-8]$/.test(event.key) && Number(event.key) < sim.ratios.length || event.key.toLowerCase() === 'n')) shift(event.key.toLowerCase() === 'n' ? 0 : Number(event.key));
});
function releaseKeyboardClutch() {
  if (previousClutch !== null) { setPedal('clutch', previousClutch); previousClutch = null; }
}
window.addEventListener('keyup', event => { if (event.key === 'Shift') releaseKeyboardClutch(); });
window.addEventListener('blur', releaseKeyboardClutch);

function updateTimingNote() {
  const engine = getEngine(sim.engineId);
  $('#timing-note').textContent = `${engine.headAngles.length} ${engine.headAngles.length === 1 ? 'głowica' : 'głowice'} · ${engine.headAngles.length * 2} wałki · ${engine.cylinders * 4} zawory. ${sim.timing !== engine.timing ? 'Eksperyment: zmieniony rodzaj napędu względem wybranego wariantu. ' : ''}Schemat trasy; proporcja obrotów wał : wałek = 2 : 1.`;
}
function updateEngineUI() {
  cycleTransition = null;
  const engine = getEngine(sim.engineId);
  selectedCylinder = Math.min(selectedCylinder, engine.cylinders - 1);
  $('#engine-displacement').textContent = `Model · ${engine.displacement}`;
  $('#engine-bank-angle').textContent = engine.architecture;
  $('#firing-interval').textContent = `Zapłon co ${engine.interval}°`;
  $('#engine-summary').textContent = `${engine.architecture}. ${engine.note} Kolejność w modelu: ${engine.firingOrder.join(' → ')}.`;
  $('#timing-type').value = sim.timing;
  updateTimingNote();
  $('#cylinder-number').innerHTML = Array.from({ length: engine.cylinders }, (_, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')}</option>`).join('');
  $('#cylinder-number').value = selectedCylinder;
  $('#cylinder-states').innerHTML = Array.from({ length: engine.cylinders }, (_, i) => `<button data-cylinder="${i}" aria-label="Obserwuj cylinder ${i + 1}">${i + 1}</button>`).join('');
  $$('[data-cylinder]').forEach(button => button.addEventListener('click', () => {
    cycleTransition = null;
    selectedCylinder = Number(button.dataset.cylinder);
    $('#cylinder-number').value = selectedCylinder;
    scene?.selectCylinder(selectedCylinder);

    updateUI();
  }));
  $$('.engine-buttons [data-engine]').forEach(button => {
    const active = button.dataset.engine === engine.id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });

}
$$('.engine-buttons [data-engine]').forEach(button => button.addEventListener('click', () => {
  player.stop();
  sim.setEngine(button.dataset.engine);
  selectedCylinder = 0;
  scene?.setEngine(sim.engineId);
  updateEngineUI();
  updatePowertrainConfiguration();
  changeView(mode);
}));
$('#explode').addEventListener('change', () => scene?.setView(mode));
$('#explode').addEventListener('input', event => {
  setClutchExplosion(Number(event.target.value) / 100, false);
});

let configuredTransmission = null;
function updatePowertrainConfiguration() {
  updateDrivingHelp(sim.transmission, document);
  const automatic = sim.transmission !== 'manual';
  if (scene && scene.engine.id !== sim.engineId) scene.setEngine(sim.engineId);
  $('#transmission-type').value = sim.transmission;
  $('#drive-layout').value = sim.driveLayout;
  [...$('#drive-layout').options].forEach(option => { option.disabled = sim.transmission === 'hybrid' && option.value !== 'fwd'; });
  $('#engine-orientation').value = sim.engineOrientation;
  $('#engine-placement').value = sim.enginePlacement;
  [...$('#engine-orientation').options].forEach(option => { option.disabled = !getEngine(sim.engineId).mountOrientations.includes(option.value) || sim.transmission === 'hybrid' && option.value !== 'transverse'; });
  [...$('#engine-placement').options].forEach(option => { option.disabled = sim.transmission === 'hybrid' && option.value !== 'front'; });
  $('#powertrain-note').textContent = `${TRANSMISSIONS[sim.transmission].hint} ${DRIVE_LAYOUTS[sim.driveLayout].hint}`;
  $('#clutch-control').hidden = automatic;
  $('#quick-clutch-control').hidden = automatic;
  $('#quick-brake').hidden = !automatic;
  $('.quick-controls').classList.toggle('automatic', automatic);
  $('.gear-control').hidden = sim.transmission === 'hybrid';
  $('#hybrid-controls').hidden = sim.transmission !== 'hybrid';
  $('#dct-auto-option').hidden = sim.transmission !== 'dct';
  $('#dct-auto').checked = sim.dct.automatic;
  $('#automatic-auto-option').hidden = sim.transmission !== 'automatic';
  $('#automatic-auto').checked = sim.automatic.automatic;
  $('.view-tab[data-view="clutch"]').textContent = sim.transmission === 'automatic' ? 'Konwerter' : sim.transmission === 'hybrid' ? 'Podział mocy' : 'Sprzęgło';
  $('.view-tab[data-view="gearbox"]').textContent = sim.transmission === 'hybrid' ? 'e-CVT' : 'Skrzynia';
  $$('.engine-buttons [data-engine]').forEach(button => { button.disabled = sim.transmission === 'hybrid' && button.dataset.engine !== 'r4'; });
  $('#transfer-mode-option').hidden = sim.driveLayout !== 'partTime';
  $('#transfer-mode').value = sim.driveMode;
  $('#center-lock-option').hidden = sim.driveLayout !== 'awd';
  $('#front-lock').checked = sim.frontLock;
  $('#rear-lock').checked = sim.rearLock;
  $('#center-lock').checked = sim.centerLock;
  $('#hybrid-mode').value = sim.hybrid.mode;
  $('#hybrid-range').value = sim.hybrid.range;
  $('#turbo').disabled = sim.transmission === 'hybrid';
  $('#focus-transfer').hidden = !['awd', 'partTime', 'quattro'].includes(sim.driveLayout);
  $('#focus-battery').hidden = sim.transmission !== 'hybrid';
  $('#focus-transmission').dataset.focus = sim.transmission === 'hybrid' ? 'psd' : 'gearbox';
  $('#focus-transmission').textContent = sim.transmission === 'hybrid' ? 'e-CVT' : sim.transmission === 'dct' ? 'DCT' : sim.transmission === 'automatic' ? '8AT' : 'Skrzynia';
  $('#vehicle-layer option[value="electric"]').disabled = sim.transmission !== 'hybrid';
  if (sim.transmission !== 'hybrid' && $('#vehicle-layer').value === 'electric') $('#vehicle-layer').value = 'mechanical';
  if (scene) scene.vehicle.layer = $('#vehicle-layer').value;
  $$('[data-surface]').forEach(select => { select.value = sim.surfaces[Number(select.dataset.surface)]; });
  if (configuredTransmission !== sim.transmission) {
    if (sim.transmission === 'hybrid' || configuredTransmission === 'hybrid') {
      $('#vehicle-layer').value = sim.transmission === 'hybrid' ? 'electric' : 'mechanical';
      if (scene) scene.vehicle.layer = $('#vehicle-layer').value;
    }
    configuredTransmission = sim.transmission;
    const options = sim.transmission === 'hybrid' ? ['D', 'N', 'P'] : sim.ratios.map((_, i) => i);
    $('#quick-gear').innerHTML = options.map(value => `<option value="${value}">${value === 0 ? 'N' : value}</option>`).join('');
    $('.gear-buttons').innerHTML = sim.ratios.map((_, i) => `<button data-gear="${i}" aria-pressed="false">${i || 'N'}</button>`).join('');
    if (scene) { scene.inspection = 'all'; scene.isolate = false; }
  }
  const previousScenario = $('#scenario-select').value;
  const available = Object.entries(SCENARIOS).filter(([, entry]) => entry.types.includes(sim.transmission));
  $('#scenario-select').innerHTML = available.map(([id, entry]) => `<option value="${id}">${entry.name}</option>`).join('');
  $('#scenario-select').value = available.some(([id]) => id === previousScenario) ? previousScenario : sim.transmission === 'hybrid' ? 'ev' : 'launch';
  updatePresetUI();
}

function updatePresetUI() {
  const preset = getCarPreset(selectedPresetId);
  const fields = ['engineId', 'transmission', 'driveLayout', 'engineOrientation', 'enginePlacement', 'turbo', 'injection', 'timing'];
  const matches = preset && fields.every(field => preset[field] === sim[field]);
  if (!matches) selectedPresetId = '';
  $('#car-preset').value = selectedPresetId;
  $('#car-preset-summary').textContent = matches ? `${preset.name} · ${preset.year} — ${preset.summary}` : 'Własna konfiguracja napędu';
  $('#car-preset-note').textContent = matches ? `Auto: ${preset.factoryDisplacement}, ${preset.factoryTransmission}. ${preset.note}` : 'Presety ustawiają architekturę napędu. Parametry i mechanizmy symulacji są dydaktyczne.';
}

$('#car-preset').addEventListener('change', event => {
  const id = event.target.value;
  if (!id) { selectedPresetId = ''; updatePresetUI(); return; }
  player.stop();
  stopDifferentialDemo();
  if (!applyCarPreset(sim, id)) return;
  selectedPresetId = id;
  selectedCylinder = 0;
  if (scene) { scene.inspection = 'all'; scene.isolate = false; scene.vehicle.restoreDetail(); scene.setEngine(sim.engineId); }
  updateEngineUI();
  updateConfiguration();
  updatePowertrainConfiguration();
  changeView('drive-detail');
});

for (const [id, method] of [['engine-orientation', 'setEngineOrientation'], ['engine-placement', 'setEnginePlacement']]) {
  $(`#${id}`).addEventListener('change', event => {
    player.stop();
    stopDifferentialDemo();
    sim[method](event.target.value);
    updatePowertrainConfiguration();
    scene?.setView(mode);
    configureInspection(mode);
    updateUI();
  });
}

function focusAssembly(section) {
  const entries = getInspections(mode, sim);
  if (!entries?.some(entry => entry.id === section)) return;
  $('#inspect-section').value = section;
  inspectSection();
  $$('[data-focus]').forEach(button => button.classList.toggle('active', button.dataset.focus === section));
}

function setHybridRange(range) {
  if (!['D', 'N', 'P'].includes(range)) return;
  if (range === 'P' && sim.speed > 0.2) { toast('P wybierz na postoju. Najpierw zahamuj.'); $('#hybrid-range').value = sim.hybrid.range; $('#quick-gear').value = sim.hybrid.range; return; }
  sim.hybrid.range = range;
  $('#hybrid-range').value = range;
  updateUI();
}

$('#transmission-type').addEventListener('change', event => {
  player.stop();
  stopDifferentialDemo();
  sim.setTransmission(event.target.value);
  updateEngineUI();
  updatePowertrainConfiguration();
  updateConfiguration();
  changeView(mode === 'hybrid' && sim.transmission !== 'hybrid' ? 'drive-detail' : sim.transmission === 'hybrid' && ['clutch', 'gearbox'].includes(mode) ? 'hybrid' : mode);
});
$('#drive-layout').addEventListener('change', event => { player.stop(); stopDifferentialDemo(); sim.setDriveLayout(event.target.value); updatePowertrainConfiguration(); scene?.setView(mode); configureInspection(mode); updateUI(); });
$('#dct-auto').addEventListener('change', event => { player.stop(); sim.dct.automatic = event.target.checked; });
$('#automatic-auto').addEventListener('change', event => { player.stop(); sim.automatic.automatic = event.target.checked; });
$('#transfer-mode').addEventListener('change', event => {
  player.stop();
  if ((event.target.value === '4L' || sim.driveMode === '4L') && (sim.speed > 0.2 || sim.transmission === 'manual' && sim.gear > 0 && sim.clutch < 0.85)) {
    event.target.value = sim.driveMode;
    toast('Reduktor przełączaj na postoju, z wciśniętym sprzęgłem lub na N.');
    return;
  }
  sim.driveMode = event.target.value;
  sim.traction = evaluateTraction(sim, sim.traction.requestedTorque);
  updateUI();
});
$('#hybrid-mode').addEventListener('change', event => { player.stop(); sim.hybrid.mode = event.target.value; });
$('#hybrid-range').addEventListener('change', event => { player.stop(); setHybridRange(event.target.value); });
$('#battery-soc').addEventListener('input', event => { player.stop(); sim.hybrid.soc = Number(event.target.value) / 100; updateUI(); });
$('#quick-brake').addEventListener('click', () => $('#brake').click());
$('.gear-buttons').addEventListener('click', event => { const button = event.target.closest('[data-gear]'); if (button) shift(Number(button.dataset.gear)); });
$$('[data-surface]').forEach(select => select.addEventListener('change', event => { player.stop(); sim.surfaces[Number(event.target.dataset.surface)] = event.target.value; sim.traction = evaluateTraction(sim, sim.traction.requestedTorque); updateUI(); }));
for (const [id, property] of [['front-lock', 'frontLock'], ['rear-lock', 'rearLock'], ['center-lock', 'centerLock']]) $( `#${id}`).addEventListener('change', event => { player.stop(); sim[property] = event.target.checked; sim.traction = evaluateTraction(sim, sim.traction.requestedTorque); updateUI(); });
$('#vehicle-turn').addEventListener('input', event => { player.stop(); sim.turn = Number(event.target.value) / 100; sim.traction = evaluateTraction(sim, sim.traction.requestedTorque); updateUI(); });
function updateVehicleLegend() {
  if (['drive', 'drive-detail'].includes(mode) && ['differential', 'frontAxle', 'rearAxle', 'finalDrive'].includes($('#inspect-section').value)) {
    $('.scene-legend').innerHTML = '<span><i style="--dot:#69d5ff"></i>Lewa półoś i koło boczne</span><span><i style="--dot:#f7ba55"></i>Prawa półoś i koło boczne</span><span><i style="--dot:#e68565"></i>Satelity</span>';
    return;
  }
  const layer = mode === 'hybrid' ? 'electric' : $('#vehicle-layer').value;
  $('.scene-legend').innerHTML = layer === 'electric' ? '<span><i style="--dot:#f5ae58"></i>DC · prąd baterii</span><span><i style="--dot:#68c9ed"></i>AC · energia MG1</span><span><i style="--dot:#85e2b3"></i>AC · energia MG2</span>' : layer === 'oil' ? '<span><i style="--dot:#76d5ac"></i>Smarowanie</span>' : layer === 'fuel' ? '<span><i style="--dot:#f5be4f"></i>Paliwo</span>' : layer === 'gases' ? '<span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#e68565"></i>Spaliny</span>' : '<span><i style="--dot:#ffc35a"></i>Moment napędowy</span><span><i style="--dot:#68c9ed"></i>Przód / lewa strona</span>';
}
$('#vehicle-layer').addEventListener('change', event => {
  if (scene) { scene.vehicle.layer = event.target.value; scene.vehicle.applyVisibility(sim); }
  updateVehicleLegend();
});
$('#vehicle-detail').addEventListener('change', event => { if (scene) { scene.vehicle.restoreDetail(); scene.vehicle.detail = event.target.value; } });
$$('[data-focus]').forEach(button => button.addEventListener('click', () => focusAssembly(button.dataset.focus)));
$$('[data-camera]').forEach(button => button.addEventListener('click', () => scene?.setCamera(button.dataset.camera)));
$('#diff-explode').addEventListener('input', event => { if (scene) [scene.finalDrive, scene.vehicle.front, scene.vehicle.rear].forEach(diff => { diff.exploded = Number(event.target.value) / 100; }); });
$('#dct-shift-step').addEventListener('click', () => {
  if (sim.shiftTarget === null) return;
  player.stop(); pause(true);
  const target = sim.shiftProgress < 0.2 ? 0.45 : sim.shiftProgress < 0.8 ? 0.9 : 1.001;
  const duration = (target - sim.shiftProgress) * 1.6;
  for (let t = 0; t < duration; t += 0.002) sim.integrate(Math.min(0.002, duration - t));
  updateUI();
});
function prepareScenario() {
  if (!player.start($('#scenario-select').value)) return;
  updatePowertrainConfiguration();
  updateConfiguration();
  if (sim.transmission === 'hybrid') { $('#vehicle-layer').value = 'electric'; if (scene) scene.vehicle.layer = 'electric'; }
  scene?.setView(mode);
  configureInspection(mode);
  updateVehicleLegend();
  updateUI();
}
$('#scenario-start').addEventListener('click', prepareScenario);
$('#scenario-play').addEventListener('click', () => { if (!player.id) prepareScenario(); pause(); });
$('#scenario-next').addEventListener('click', () => { if (player.next()) { updatePowertrainConfiguration(); scene?.setView(mode); configureInspection(mode); updateUI(); } });

const telemetry = createTelemetry({ sim, player, $, $$, icon, fmt, lessonView, inspectedDifferential,
  get mode() { return mode; }, get scene() { return scene; }, get selectedCylinder() { return selectedCylinder; }
});
function updateUI(visibleOnly = false) { telemetry.updateUI(visibleOnly); if (!visibleOnly) frameLoop?.invalidate(); }
function updateSuspensionUI() { telemetry.updateSuspensionUI(); }
function updateLessonState() { telemetry.updateLessonState(); }

updateEngineUI();
updatePowertrainConfiguration();
setPedal('throttle', 0);
setPedal('clutch', 0);
updateUI();
changeView('drive-detail');
frameLoop = createFrameLoop({
  isActive: () => !!cycleTransition || !sim.paused && (sim.suspensionActive || !!player.id || sim.running ||
    sim.transmission === 'hybrid' && sim.hybridEnabled || sim.rpm > .1 || sim.speed > .001 || Math.abs(sim.inputOmega) > .01 || !!inspectedDifferential()?.demo),
  maxFps: () => scene?.quality.settings().maxFps || 60,
  advance(dt) {
    if (!sim.paused) scene?.quality.observe(Math.max(dt * 1000, scene.lastRenderCost || 0), dt);
    const wasRunning = sim.running;
    sim.update(dt);
    if (player.update(dt)) { updatePowertrainConfiguration(); scene?.setView(mode); configureInspection(mode); }
    if (cycleTransition) {
      cycleTransition.elapsed += dt;
      const t = Math.min(1, cycleTransition.elapsed / cycleTransition.duration);
      const eased = t * t * (3 - 2 * t);
      sim.angle = (cycleTransition.start + cycleTransition.delta * eased) % 720;
      if (t === 1) cycleTransition = null;
    }
    if (wasRunning && sim.stalled) toast('Silnik zgasł pod obciążeniem. Wciśnij sprzęgło, uruchom silnik i zwalniaj pedał powoli.');
  },
  render: dt => scene?.render(sim, dt),
  updateUI: () => updateUI(true)
});
const wake = () => frameLoop.invalidate();
const wakeEvents = ['input', 'change', 'click', 'keydown', 'keyup', 'pointerdown', 'pointerup', 'wheel', 'visibilitychange', 'fullscreenchange'];
for (const event of wakeEvents) document.addEventListener(event, wake, { passive: true });
if (scene) scene.onInvalidate = wake;
frameLoop.invalidate();
if (import.meta.hot) import.meta.hot.dispose(() => {
  frameLoop.dispose();
  for (const event of wakeEvents) document.removeEventListener(event, wake);
  clearTimeout(toastTimer);
  scene?.dispose();
});
