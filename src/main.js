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
import { EngineScene } from './scene.js';
import { Simulation, STROKES, GEAR_RATIOS, cycleDegrees, strokeIndex } from './simulation.js';

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
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const sim = new Simulation();
let selectedCylinder = 0;
let mode = 'engine';
let scene;
let selectedPart = null;
let toastTimer;
let disposed = false;

const PARTS = {
  piston: ['Tłok i korbowód', 'Tłok porusza się w górę i w dół. Korbowód łączy go z wykorbieniem wału, zamieniając ten ruch na obrót. W silniku R4 tłoki 1 i 4 poruszają się razem, podobnie jak 2 i 3 — ale wykonują różne suwy.'],
  crank: ['Wał korbowy', 'Odbiera siłę z korbowodów i przekazuje obrót do koła zamachowego. Na pełny cykl czterosuwowy przypadają dwa obroty wału, czyli 720°. Kolejność zapłonu w tym modelu: 1 → 3 → 4 → 2.'],
  valves: ['Zawory i rozrząd', 'Zawór dolotowy wpuszcza ładunek, wydechowy wypuszcza spaliny. Wałek rozrządu obraca się dwa razy wolniej od wału korbowego. Model pomija wyprzedzenia, opóźnienia i współotwarcie zaworów.'],
  spark: ['Świeca zapłonowa', 'Iskra pojawia się pod koniec sprężania i inicjuje spalanie mieszanki. Ciśnienie rośnie, a gazy wykonują pracę na tłoku. W rzeczywistym silniku wyprzedzenie zapłonu zależy m.in. od obrotów i obciążenia.'],
  block: ['Blok silnika', 'W bloku znajdują się cylindry prowadzące tłoki. Przekrój odsłania wnętrze; wyłącz go, żeby zobaczyć osłonę cylindrów. To schemat edukacyjny, bez pełnego układu chłodzenia i smarowania.'],
  clutch: ['Sprzęgło cierne', 'Zwolniony pedał: docisk zaciska tarczę na kole zamachowym, przekazując moment do skrzyni. Wciśnięty pedał: tarcza jest zwolniona, więc można zmienić bieg. Pośrednie położenie pozwala ruszać z poślizgiem. Odstęp tarcz jest powiększony dla czytelności.'],
  gearbox: ['Manualna skrzynia biegów', 'Na niższym biegu koła obracają się wolniej, ale dostają większy moment. Pary kół są stale zazębione; wybrana para zostaje połączona z wałem wyjściowym. Złoty pierścień oznacza wybrany bieg. Bieg N nie przekazuje napędu na koła.'],
  wheel: ['Napęd kół', 'Za skrzynią działa przekładnia główna 3,9:1, zmniejszająca obroty i zwiększająca moment na kołach. Nie jest narysowana; widoczne koło przedstawia wynikowy ruch pojazdu. Model zakłada masę 1250 kg i promień koła 0,31 m.'],
  intake: ['Dolot', 'Niebieski kanał doprowadza powietrze do zaworu dolotowego. Przy wtrysku pośrednim paliwo jest dodawane przed zaworem. Złote drobiny przedstawiają paliwo, niebieskie — powietrze.'],
  exhaust: ['Wydech', 'Spaliny uchodzą przez otwarty zawór wydechowy do kolektora. W silniku z turbo ich energia napędza turbinę połączoną wałkiem ze sprężarką.'],
  injection: ['Miejsce wtrysku', 'MPI: paliwo jest wtryskiwane do kanału przed zaworem dolotowym. GDI: wtryskiwacz podaje paliwo bezpośrednio do cylindra. Pokazany wtrysk GDI podczas sprężania jest jednym z wariantów; rzeczywiste układy mogą wtryskiwać także podczas ssania i wielokrotnie.'],
  turbo: ['Turbosprężarka', 'Spaliny obracają turbinę (kolor miedziany), a wspólny wałek napędza sprężarkę (kolor niebieski). Sprężarka wtłacza więcej powietrza do silnika. Doładowanie narasta z opóźnieniem; zwiększ gaz i obroty, żeby to zobaczyć. Pokazujemy osobny, uproszczony przekrój bez intercoolera i zaworu wastegate.']
};

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="app-header">
    <a class="brand" href="./" aria-label="Engine Lab — strona główna"><span class="brand-symbol">${icon('piston')}</span><span>ENGINE<span class="brand-light"> / LAB</span></span></a>
    <span class="header-note">INTERAKTYWNE LABORATORIUM MECHANIKI</span>
    <button class="quiet-button" id="help-button">${icon('info')}<span>Jak to działa</span></button>
  </header>
  <main>
    <div class="page-heading"><div><div class="eyebrow">OD SPALANIA DO RUCHU</div><h1>Silnik benzynowy<span class="title-dot">.</span></h1></div><div class="model-spec"><span>R4</span><span>2.0 l</span><span>4 suwy</span></div></div>
    <div class="workspace">
      <section class="visual-panel" aria-label="Model i cykl silnika">
        <div class="view-toolbar"><div class="view-tabs" role="group" aria-label="Widok modelu">
          <button class="view-tab active" data-view="engine" aria-pressed="true">Cały silnik</button><button class="view-tab" data-view="cylinder" aria-pressed="false">Jeden cylinder</button><button class="view-tab" data-view="drive" aria-pressed="false">Napęd</button><button class="view-tab" data-view="turbo" aria-pressed="false">Turbo</button>
        </div><button class="icon-button" id="fullscreen" aria-label="Pełny ekran modelu" title="Pełny ekran">${icon('expand')}</button></div>
        <div class="scene" id="scene">
          <div class="scene-caption"><span class="live-status" id="engine-status">SILNIK PRACUJE</span><span id="view-caption">Przekrój rzędowej czwórki</span></div>
          <div class="scene-options"><label><input id="cutaway" type="checkbox" checked><span>Przekrój</span></label><label><input id="labels" type="checkbox" checked><span>Opisy</span></label></div>
          <div class="scene-legend"><span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#ed7e77"></i>Spaliny</span></div>
          <div class="camera-tools"><button id="zoom-in" class="icon-button" aria-label="Przybliż">${icon('plus')}</button><button id="zoom-out" class="icon-button" aria-label="Oddal">${icon('minus')}</button><button id="camera-reset" class="icon-button" aria-label="Przywróć kamerę">${icon('focus')}</button></div>
          <div class="orbit-hint">${icon('rotate')}<span>Przeciągnij, by obrócić · przybliż dwoma palcami lub kółkiem myszy</span></div>
          <div id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="quick-controls" aria-label="Sterowanie przy modelu"><label for="quick-throttle">Gaz <output id="quick-throttle-value">0%</output><input id="quick-throttle" type="range" min="0" max="100" value="0"></label><label for="quick-clutch">Sprzęgło <output id="quick-clutch-value">0%</output><input id="quick-clutch" class="blue-range" type="range" min="0" max="100" value="0"></label><label for="quick-gear">Bieg<select id="quick-gear"><option value="0">N</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div>
        <div class="playback"><div class="playback-left"><button id="pause" class="play-button" aria-label="Wstrzymaj symulację">${icon('pause')}</button><button id="next-stroke" class="quiet-button" title="Zatrzymaj i przejdź o jeden suw">Następny suw ${icon('chevron')}</button></div><label class="speed-select">Tempo animacji<select id="animation-speed"><option value="0.01">1%</option><option value="0.02" selected>2%</option><option value="0.05">5%</option><option value="0.1">10%</option><option value="1">100%</option></select></label></div>
        <div class="cycle-panel" id="cycle-panel">
          <div class="section-heading"><span>CYKL CZTEROSUWOWY</span><label class="cylinder-select">Cylinder <select id="cylinder-number" aria-label="Numer cylindra"><option value="0">01</option><option value="1">02</option><option value="2">03</option><option value="3">04</option></select></label></div>
          <div class="stroke-tabs" role="group" aria-label="Wybierz suw i zatrzymaj animację">${STROKES.map((stroke, i) => `<button data-stroke="${i}" style="--stroke:${stroke.color}" aria-pressed="false"><span class="stroke-number">0${i + 1}</span><span>${stroke.name}</span><span class="stroke-direction">${i % 2 ? '↑' : '↓'}</span></button>`).join('')}</div>
          <div class="cycle-track"><input id="cycle-angle" type="range" min="0" max="719" value="30" aria-label="Kąt wału w cyklu, 0 do 719 stopni"><div><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></div></div>
          <div class="stroke-description"><span class="stroke-badge" id="stroke-badge">01</span><p id="stroke-description"></p><span class="angle-readout" id="angle-readout">30°</span></div>
        </div>
        <div class="part-panel" id="part-panel" hidden><div class="section-heading"><span>POZNAJ ELEMENT</span><button id="close-part" class="quiet-button">Zamknij ×</button></div><h2 id="part-title"></h2><p id="part-description"></p></div>
      </section>
      <aside class="control-panel" aria-label="Sterowanie silnikiem">
        <div class="control-heading"><span class="section-heading">STANOWISKO STEROWANIA</span><button class="icon-button" id="reset" aria-label="Zresetuj symulację" title="Reset symulacji">${icon('reset')}</button></div>
        <div class="rpm-display"><span class="metric-label">Obroty silnika</span><div><strong id="rpm">900</strong><span>obr./min</span></div><div class="rpm-bar"><i id="rpm-bar"></i></div><div class="rpm-scale"><span>0</span><span>2 000</span><span>4 000</span><span>6 500</span></div></div>
        <div class="secondary-metrics"><div><span class="metric-label">Prędkość</span><strong><span id="speed">0</span><small> km/h</small></strong></div><div><span class="metric-label">Moment silnika</span><strong><span id="torque">0</span><small> Nm</small></strong></div></div>
        <div class="pedal-control"><div class="control-label"><label for="throttle">Gaz</label><output id="throttle-value">0<span>%</span></output></div><input class="accent-range" id="throttle" type="range" min="0" max="100" value="0"><div class="range-caption"><span>Bieg jałowy</span><span>Pełny gaz</span></div></div>
        <div class="pedal-control"><div class="control-label"><label for="clutch">Pedał sprzęgła</label><output id="clutch-value">0<span>%</span></output></div><input id="clutch" class="blue-range" type="range" min="0" max="100" value="0"><div class="range-caption"><span>Zwolniony</span><span>Wciśnięty</span></div><button id="clutch-toggle" class="clutch-button" aria-pressed="false">Wciśnij sprzęgło <kbd>Shift</kbd></button></div>
        <div class="gear-control"><div class="control-label"><span>Bieg</span><span class="small-label" id="ratio-label">Luz</span></div><div class="gear-buttons" role="group" aria-label="Wybór biegu">${GEAR_RATIOS.map((_, i) => `<button data-gear="${i}" class="${i === 0 ? 'active' : ''}" aria-pressed="${i === 0}">${i || 'N'}</button>`).join('')}</div><p class="control-hint" id="drive-status">Luz: silnik nie napędza kół.</p></div>
        <div class="engine-actions"><button id="ignition" class="secondary-button">${icon('power')}<span>Wyłącz silnik</span></button><button id="brake" class="secondary-button brake-button" aria-pressed="false">Hamulec</button></div>
        <div class="configuration"><div class="section-heading">KONFIGURACJA SILNIKA</div><div class="setting-label">Wtrysk paliwa</div><div class="segmented" role="group" aria-label="Rodzaj wtrysku"><button data-injection="mpi" class="active" aria-pressed="true">Pośredni <span>MPI</span></button><button data-injection="gdi" aria-pressed="false">Bezpośredni <span>GDI</span></button></div><p id="injection-note" class="control-hint">Paliwo trafia do kanału przed zaworem dolotowym.</p><label class="turbo-setting"><span>Turbodoładowanie<small id="turbo-label">Silnik wolnossący</small></span><input id="turbo" type="checkbox" role="switch"><span class="switch" aria-hidden="true"></span></label><div class="boost-readout" id="boost-row" hidden><span>Ciśnienie doładowania</span><strong id="boost">0,00 bar</strong></div></div>
        <div class="control-footer">${icon('info')}<span>Parametry orientacyjne. Animacja jest spowolniona, wskazania odpowiadają symulacji.</span></div>
      </aside>
    </div>
    <section class="learning-strip"><div class="learning-number">SPRÓBUJ SAM</div><p><strong>Poczuj różnicę między biegami.</strong> Wciśnij sprzęgło, wybierz 1, dodaj gazu i powoli zwalniaj pedał. Przejdź do widoku „Napęd”, żeby zobaczyć, jak moment dociera do koła.</p><button id="try-drive" class="quiet-button">Zobacz napęd ${icon('arrow')}</button></section>
    <footer class="page-footer"><span>ENGINE / LAB <span class="footer-separator">·</span> Model edukacyjny</span><span>Obróć. Przybliż. Zrozum.</span></footer>
  </main>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>Twoje małe laboratorium</h2><button id="close-help" class="icon-button" aria-label="Zamknij instrukcję">×</button></div><p>Obracaj model palcem lub myszą. Przybliżaj dwoma palcami, kółkiem myszy albo przyciskami + i −. Klikaj części, aby poznać ich działanie.</p><ol><li><strong>Odkryj cztery suwy.</strong> Kliknij suw, aby zatrzymać model w jego środku. Suwak kąta pozwala ręcznie przesuwać wał przez pełny cykl.</li><li><strong>Rusz z miejsca.</strong> Wciśnij sprzęgło, wybierz pierwszy bieg, ustaw około 25% gazu i powoli zwalniaj sprzęgło suwakiem.</li><li><strong>Zmień bieg.</strong> Odejmij gaz, wciśnij sprzęgło, wybierz następny bieg i płynnie zwolnij pedał.</li><li><strong>Porównaj konfiguracje.</strong> Zmień MPI na GDI i zobacz położenie wtryskiwacza. Włącz turbo, dodaj gazu i obserwuj narastające doładowanie.</li></ol><p><strong>Skróty:</strong> spacja — pauza, Shift — sprzęgło (przytrzymaj), strzałki góra/dół — gaz, N i 1–5 — bieg. Skróty nie działają podczas edycji pól.</p><p class="dialog-note">To uproszczona symulacja dydaktyczna, a nie model konkretnego samochodu. Pomijamy m.in. szczegółową termodynamikę spalania, synchronizatory, chłodzenie i smarowanie. GDI może w rzeczywistości wtryskiwać paliwo w różnych fazach; tutaj pokazano wtrysk przy sprężaniu. Dwuwałkowa skrzynia jest schematem zasady zmiany przełożeń; nie jest rysunkiem konstrukcyjnym. Widok turbo jest osobnym przekrojem.</p></dialog>
`;

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
  const [title, description] = PARTS[part] || PARTS.block;
  $('#part-title').textContent = title;
  $('#part-description').textContent = description;
  $('#part-panel').hidden = false;
}
function changeView(value) {
  mode = value;
  scene?.setView(value);
  $$('.view-tab').forEach(button => {
    const active = button.dataset.view === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#view-caption').textContent = { engine: 'Przekrój rzędowej czwórki', cylinder: 'Zobacz każdy etap spalania', drive: 'Od wału korbowego do kół', turbo: 'Energia spalin napędza sprężarkę' }[value];
  $('#cycle-panel').hidden = value === 'turbo' || value === 'drive';
  if (value === 'turbo') choosePart('turbo');
  else if (value === 'drive') choosePart('gearbox');
  else { $('#part-panel').hidden = true; selectedPart = null; }
}
function setPedal(name, value) {
  sim[name] = Math.max(0, Math.min(1, value));
  $(`#${name}`).value = Math.round(sim[name] * 100);
  $(`#${name}-value`).innerHTML = `${Math.round(sim[name] * 100)}<span>%</span>`;
  $(`#${name}`).style.setProperty('--fill', `${sim[name] * 100}%`);
  $(`#quick-${name}`).value = Math.round(sim[name] * 100);
  $(`#quick-${name}-value`).textContent = `${Math.round(sim[name] * 100)}%`;
  $(`#quick-${name}`).style.setProperty('--fill', `${sim[name] * 100}%`);
  if (name === 'clutch') {
    $('#clutch-toggle').setAttribute('aria-pressed', sim.clutch >= 0.85);
    $('#clutch-toggle').innerHTML = `${sim.clutch >= 0.85 ? 'Zwolnij sprzęgło' : 'Wciśnij sprzęgło'} <kbd>Shift</kbd>`;
  }
}
function shift(value) {
  if (!sim.shift(value)) toast('Najpierw wciśnij sprzęgło co najmniej do 85%.');
  updateUI();
}
function pause(value = !sim.paused) {
  sim.paused = value;
  $('#pause').innerHTML = icon(sim.paused ? 'play' : 'pause');
  $('#pause').setAttribute('aria-label', sim.paused ? 'Wznów symulację' : 'Wstrzymaj symulację');
  updateUI();
}
function setCycle(angle) {
  pause(true);
  const current = cycleDegrees(sim.angle, selectedCylinder);
  sim.angle = ((sim.angle + angle - current) % 720 + 720) % 720;
  updateUI();
}

try {
  scene = new EngineScene($('#scene'), choosePart);
} catch (error) {
  console.error(error);
  const fallback = document.createElement('div');
  fallback.className = 'webgl-fallback';
  fallback.innerHTML = '<h2>Model 3D wymaga WebGL 2</h2><p>Włącz akcelerację sprzętową lub otwórz aplikację w aktualnej wersji Chrome, Edge, Firefox albo Safari. Sterowanie i opisy pozostają dostępne.</p>';
  $('#scene').append(fallback);
}
$('#scene').addEventListener('renderlost', () => { pause(true); toast('Utracono kontekst grafiki. Odśwież stronę, aby przywrócić model.'); });
$$('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
$('#try-drive').addEventListener('click', () => { changeView('drive'); $('.visual-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$$('[data-stroke]').forEach(button => button.addEventListener('click', () => setCycle(Number(button.dataset.stroke) * 180 + 90)));
$('#cycle-angle').addEventListener('input', event => setCycle(Number(event.target.value)));
$('#cylinder-number').addEventListener('change', event => {
  selectedCylinder = Number(event.target.value);
  scene?.selectCylinder(selectedCylinder);
  updateUI();
});
$('#pause').addEventListener('click', () => pause());
$('#next-stroke').addEventListener('click', () => setCycle(((strokeIndex(sim.angle, selectedCylinder) + 1) % 4) * 180 + 90));
$('#animation-speed').addEventListener('change', event => { sim.animationScale = Number(event.target.value); });
['throttle', 'clutch'].forEach(name => $(`#${name}`).addEventListener('input', event => setPedal(name, Number(event.target.value) / 100)));
['throttle', 'clutch'].forEach(name => $(`#quick-${name}`).addEventListener('input', event => setPedal(name, Number(event.target.value) / 100)));
$('#quick-gear').addEventListener('change', event => shift(Number(event.target.value)));
$('#clutch-toggle').addEventListener('click', () => setPedal('clutch', sim.clutch >= 0.85 ? 0 : 1));
$$('[data-gear]').forEach(button => button.addEventListener('click', () => shift(Number(button.dataset.gear))));
$$('[data-injection]').forEach(button => button.addEventListener('click', () => {
  sim.injection = button.dataset.injection;
  updateConfiguration();
}));
function updateConfiguration() {
  lastStroke = -1;
  $$('[data-injection]').forEach(button => {
    const active = button.dataset.injection === sim.injection;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#injection-note').textContent = sim.injection === 'mpi' ? 'Paliwo trafia do kanału przed zaworem dolotowym.' : 'Paliwo trafia wprost do cylindra — tutaj przy sprężaniu.';
  $('#turbo').checked = sim.turbo;
  $('#turbo-label').textContent = sim.turbo ? 'Turbosprężarka aktywna' : 'Silnik wolnossący';
  $('#boost-row').hidden = !sim.turbo;
}
$('#turbo').addEventListener('change', event => {
  sim.turbo = event.target.checked;
  updateConfiguration();
  if (sim.turbo) toast('Turbo włączone. Dodaj gazu: doładowanie wzrośnie wraz z obrotami.');
});
$('#cutaway').addEventListener('change', event => { if (scene) scene.cutaway = event.target.checked; });
$('#labels').addEventListener('change', event => { if (scene) scene.labels = event.target.checked; });
$('#zoom-in').addEventListener('click', () => scene?.zoom(0.8));
$('#zoom-out').addEventListener('click', () => scene?.zoom(1.25));
$('#camera-reset').addEventListener('click', () => scene?.setView(mode));
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('.visual-panel').requestFullscreen) await $('.visual-panel').requestFullscreen();
    else toast('Pełny ekran nie jest dostępny w tej przeglądarce. Obróć telefon poziomo.');
  } catch { toast('Przeglądarka nie pozwoliła włączyć pełnego ekranu.'); }
});
$('#ignition').addEventListener('click', () => {
  if (sim.running) { sim.running = false; sim.stalled = false; }
  else if (!sim.start()) toast('Aby uruchomić silnik, wybierz N lub wciśnij sprzęgło.');
  updateUI();
});
$('#brake').addEventListener('click', () => {
  sim.brake = sim.brake ? 0 : 1;
  $('#brake').setAttribute('aria-pressed', Boolean(sim.brake));
});
$('#reset').addEventListener('click', () => {
  sim.reset();
  selectedCylinder = 0;
  scene?.selectCylinder(0);
  $('#cylinder-number').value = 0;
  setPedal('throttle', 0);
  setPedal('clutch', 0);
  pause(false);
  $('#animation-speed').value = 0.02;
  $('#brake').setAttribute('aria-pressed', 'false');
  updateConfiguration();
  updateUI();
  changeView('engine');
  toast('Przywrócono silnik wolnossący z wtryskiem pośrednim.');
});
$('#close-part').addEventListener('click', () => { $('#part-panel').hidden = true; selectedPart = null; });
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('click', event => { if (event.target === $('#help-dialog')) $('#help-dialog').close(); });
let previousClutch = null;
window.addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName) || $('#help-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) pause(); }
  if (event.key === 'Shift' && !event.repeat) { previousClutch = sim.clutch; setPedal('clutch', 1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); setPedal('throttle', sim.throttle + 0.05); }
  if (event.key === 'ArrowDown') { event.preventDefault(); setPedal('throttle', sim.throttle - 0.05); }
  if (/^[1-5]$/.test(event.key) || event.key.toLowerCase() === 'n') shift(event.key.toLowerCase() === 'n' ? 0 : Number(event.key));
});
function releaseKeyboardClutch() {
  if (previousClutch !== null) { setPedal('clutch', previousClutch); previousClutch = null; }
}
window.addEventListener('keyup', event => { if (event.key === 'Shift') releaseKeyboardClutch(); });
window.addEventListener('blur', releaseKeyboardClutch);

let lastStroke = -1;
function updateUI() {
  $('#rpm').textContent = fmt.format(Math.round(sim.rpm / 10) * 10);
  $('#rpm-bar').style.width = `${Math.min(100, sim.rpm / 6500 * 100)}%`;
  $('#speed').textContent = Math.round(sim.speed * 3.6);
  $('#torque').textContent = Math.round(sim.torque);
  $('#boost').textContent = `${sim.boost.toFixed(2).replace('.', ',')} bar`;
  const status = sim.paused ? 'SYMULACJA WSTRZYMANA' : sim.running ? 'SILNIK PRACUJE' : sim.stalled ? 'SILNIK ZGASŁ' : 'SILNIK WYŁĄCZONY';
  $('#engine-status').textContent = status;
  $('#engine-status').classList.toggle('inactive', !sim.running || sim.paused);
  $('#ignition span').textContent = sim.running ? 'Wyłącz silnik' : 'Uruchom silnik';
  $('#quick-gear').value = sim.gear;
  $('#ratio-label').textContent = sim.gear ? `${GEAR_RATIOS[sim.gear].toFixed(2).replace('.', ',')} : 1` : 'Luz';
  $$('[data-gear]').forEach(button => {
    const active = Number(button.dataset.gear) === sim.gear;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#drive-status').textContent = sim.stalled ? 'Silnik zgasł. Wciśnij sprzęgło i uruchom go ponownie.' : sim.gear === 0 ? 'Luz: silnik nie napędza kół.' : sim.clutch > 0.95 ? 'Sprzęgło rozłączone: silnik nie napędza kół.' : sim.clutch > 0.05 && sim.clutchSlip > 60 ? 'Poślizg sprzęgła: obroty wałów się wyrównują.' : 'Sprzęgło przenosi moment do kół.';
  const phase = strokeIndex(sim.angle, selectedCylinder);
  if (phase !== lastStroke) {
    lastStroke = phase;
    $$('[data-stroke]').forEach(button => {
      const active = Number(button.dataset.stroke) === phase;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    $('#stroke-description').textContent = phase === 1 && sim.injection === 'mpi' ? 'Tłok idzie w górę, a oba zawory są zamknięte. Mieszanka powietrza z paliwem zostaje sprężona. Pod koniec tego suwu świeca inicjuje spalanie.' : STROKES[phase].description;
    $('#stroke-badge').textContent = `0${phase + 1}`;
    $('#stroke-badge').style.color = STROKES[phase].color;
  }
  const degrees = Math.round(cycleDegrees(sim.angle, selectedCylinder));
  if (document.activeElement !== $('#cycle-angle')) $('#cycle-angle').value = Math.min(719, degrees);
  $('#angle-readout').textContent = `${degrees}°`;
}

setPedal('throttle', 0);
setPedal('clutch', 0);
updateUI();
let previousTime = performance.now();
let uiTime = 0;
function animate(time) {
  if (disposed) return;
  const dt = Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;
  if (!document.hidden) {
    const wasRunning = sim.running;
    sim.update(dt);
    if (wasRunning && sim.stalled) toast('Silnik zgasł pod obciążeniem. Wciśnij sprzęgło, uruchom silnik i zwalniaj pedał powoli.');
    scene?.render(sim, dt);
    uiTime += dt;
    if (uiTime >= 0.08) { updateUI(); uiTime = 0; }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; scene?.dispose(); });
