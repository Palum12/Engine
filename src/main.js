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
import { EngineScene } from './scene.js';
import { getEngine } from './engines.js';
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
  rod: ['Korbowód', 'Łączy sworzeń tłoka z czopem wału korbowego. Zmienia kąt podczas obrotu wału, zachowując stałą długość. W modelach V korbowody obu banków napędzają jeden wspólny wał.'],
  banks: ['Dwa banki cylindrów', 'W silniku widlastym cylindry są pochylone w dwóch rzędach, ale napędzają jeden wał korbowy.'],
  flywheel: ['Koło zamachowe', 'Jest połączone z wałem silnika. Jego bezwładność wygładza nierównomierność pracy między zapłonami. Płaska powierzchnia styka się z okładziną tarczy sprzęgła; zewnętrzny wieniec służy rozrusznikowi.'],
  friction: ['Tarcza sprzęgła i okładziny', 'Brązowy pierścień to okładzina cierna. Docisk zaciska tarczę pomiędzy sobą a kołem zamachowym. Jej piasta jest osadzona na wieloklinie wału wejściowego skrzyni, więc tarcza obraca się z tym wałem, a nie zawsze z silnikiem.'],
  discHub: ['Piasta i wieloklin', 'Wieloklin przekazuje moment z tarczy sprzęgła do wału wejściowego. Pozwala też tarczy minimalnie przesuwać się osiowo podczas wysprzęglania.'],
  torsionSprings: ['Sprężyny tłumiące w tarczy', 'Sprężyny pomiędzy okładziną a piastą łagodzą pulsacje momentu i szarpnięcia napędu. To inne sprężyny niż sprężyna talerzowa docisku. Ich ugięcia nie są osobno symulowane.'],
  pressurePlate: ['Docisk', 'Obraca się z kołem zamachowym. Sprężyna talerzowa naciska płytę docisku, zaciskając tarczę cierną. Po wciśnięciu pedału płyta odsuwa się, a silnik może obracać się niezależnie od skrzyni.'],
  diaphragm: ['Sprężyna talerzowa', 'Jej palce są naciskane przez łożysko oporowe. Ugięcie środka zmienia nacisk zewnętrznej części sprężyny na docisk. Ruch został powiększony, aby był widoczny.'],
  releaseBearing: ['Łożysko oporowe i widełki', 'Wciśnięcie pedału przesuwa widełki i łożysko w stronę obracającej się sprężyny talerzowej. Łożysko pozwala przenieść nacisk pomiędzy nieruchomym mechanizmem sterowania a obracającym się dociskiem.'],
  inputShaft: ['Wał wejściowy', 'Jest połączony z tarczą sprzęgła. Niebieskie koła są osadzone na tym wale i obracają się razem z nim. Po wciśnięciu sprzęgła wał nie musi obracać się z prędkością silnika.'],
  outputShaft: ['Wał wyjściowy', 'Przekazuje napęd do przekładni głównej i kół. Na luzie duże koła zębate obracają się swobodnie względem wału. Dopiero przesuwka łączy wybrane koło z wałem.'],
  gearPair: ['Stale zazębiona para kół', 'Koła zębate nie przesuwają się, aby wybrać bieg: pozostają zazębione. Zmienia się połączenie wybranego koła z wałem wyjściowym. Większe koło odbierające daje mniejsze obroty i większy moment. Zęby są uproszczone, a ich liczby zachowują podane przełożenia.'],
  synchronizer: ['Przesuwka i sprzęgło kłowe', 'Złota przesuwka zazębia się z bocznymi zębami wybranego koła i łączy je z wałem wyjściowym. W rzeczywistej skrzyni synchronizator wcześniej wyrównuje obroty; tutaj pokazujemy połączenie bez szczegółowej fazy tarciowej. Dla czytelności każdy bieg ma własną przesuwkę.'],
  shiftFork: ['Widełki zmiany biegów', 'Przesuwają tuleję wzdłuż wału, wybierając połączenie koła z wałem wyjściowym. Same widełki nie obracają się razem z tuleją.'],
  bearing: ['Łożyska wałów', 'Podpierają wały, utrzymują odległość między nimi i pozwalają na obrót. Stała odległość osi utrzymuje zazębienie wszystkich par kół.'],

  piston: ['Tłok i korbowód', 'Tłok porusza się w górę i w dół. Korbowód łączy go z wykorbieniem wału, zamieniając ten ruch na obrót. W R4 cylindry tworzą jeden rząd. W V6 i V12 są dwa banki pod kątem 60°, połączone z jednym wałem. Kolory pokazują aktualny suw wybranego cylindra.'],
  crank: ['Wał korbowy', 'Odbiera siłę z korbowodów i przekazuje obrót do koła zamachowego. Na pełny cykl czterosuwowy przypadają dwa obroty wału, czyli 720°.'],
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
    <div class="page-heading"><div><div class="eyebrow">OD SPALANIA DO RUCHU</div><h1>Silnik benzynowy<span class="title-dot">.</span></h1></div><div class="engine-picker"><div class="engine-buttons" role="group" aria-label="Układ cylindrów"><button data-engine="r4" class="active" aria-pressed="true">R4</button><button data-engine="v6" aria-pressed="false">V6</button><button data-engine="v12" aria-pressed="false">V12</button></div><div class="model-spec"><span id="engine-displacement">2.0 l</span><span id="engine-bank-angle">Rzędowy</span></div></div></div>
    <div class="workspace">
      <section class="visual-panel" aria-label="Model i cykl silnika">
        <div class="view-toolbar"><div class="view-tabs" role="group" aria-label="Widok modelu">
          <button class="view-tab active" data-view="engine" aria-pressed="true">Cały silnik</button><button class="view-tab" data-view="cylinder" aria-pressed="false">Jeden cylinder</button><button class="view-tab" data-view="drive" aria-pressed="false">Napęd</button><button class="view-tab" data-view="clutch" aria-pressed="false">Sprzęgło</button><button class="view-tab" data-view="gearbox" aria-pressed="false">Skrzynia biegów</button><button class="view-tab" data-view="turbo" aria-pressed="false">Turbo</button>
        </div><button class="icon-button" id="fullscreen" aria-label="Pełny ekran modelu" title="Pełny ekran">${icon('expand')}</button></div>
        <div class="scene" id="scene">
          <div class="scene-caption"><span class="live-status" id="engine-status">SILNIK PRACUJE</span><span id="view-caption">Przekrój rzędowej czwórki</span></div>
          <div class="mechanism-readout" id="mechanism-readout" hidden><strong id="mechanism-state"></strong><div><span>Silnik <b id="mechanism-engine-rpm"></b></span><span>Wejście skrzyni <b id="mechanism-input-rpm"></b></span><span>Wyjście skrzyni <b id="mechanism-output-rpm"></b></span></div><small id="mechanism-detail"></small></div>
          <div class="scene-options"><label><input id="cutaway" type="checkbox" checked><span>Przekrój</span></label><label><input id="labels" type="checkbox" checked><span>Opisy</span></label></div>
          <div class="scene-legend"><span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#ed7e77"></i>Spaliny</span></div>
          <div class="camera-tools"><button id="zoom-in" class="icon-button" aria-label="Przybliż">${icon('plus')}</button><button id="zoom-out" class="icon-button" aria-label="Oddal">${icon('minus')}</button><button id="camera-reset" class="icon-button" aria-label="Przywróć kamerę">${icon('focus')}</button></div>
          <div class="orbit-hint">${icon('rotate')}<span>Przeciągnij, by obrócić · przybliż dwoma palcami lub kółkiem myszy</span></div>
          <div id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="quick-controls" aria-label="Sterowanie przy modelu"><label for="quick-throttle">Gaz <output id="quick-throttle-value">0%</output><input id="quick-throttle" type="range" min="0" max="100" value="0"></label><label for="quick-clutch">Sprzęgło <output id="quick-clutch-value">0%</output><input id="quick-clutch" class="blue-range" type="range" min="0" max="100" value="0"></label><label for="quick-gear">Bieg<select id="quick-gear"><option value="0">N</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div>
        <div class="playback"><div class="playback-left"><button id="pause" class="play-button" aria-label="Wstrzymaj symulację">${icon('pause')}</button><button id="next-stroke" class="quiet-button" title="Zatrzymaj i przejdź o jeden suw">Następny suw ${icon('chevron')}</button></div><label id="explode-control" class="explode-control" hidden>Rozsuń części<input id="explode" type="range" min="0" max="100" value="65"><output id="explode-value">65%</output></label><label class="speed-select">Tempo animacji<select id="animation-speed"><option value="0.01">1%</option><option value="0.02" selected>2%</option><option value="0.05">5%</option><option value="0.1">10%</option><option value="1">100%</option></select></label></div>
        <div class="cycle-panel" id="cycle-panel">
          <div class="section-heading"><span>CYKL CZTEROSUWOWY</span><label class="cylinder-select">Cylinder <select id="cylinder-number" aria-label="Numer cylindra"><option value="0">01</option><option value="1">02</option><option value="2">03</option><option value="3">04</option></select></label></div>
          <div class="cylinder-strip"><div id="cylinder-states" role="group" aria-label="Fazy cylindrów"></div><span id="firing-interval">Zapłon co 180°</span></div>
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
        <div class="configuration"><div class="section-heading">KONFIGURACJA SILNIKA</div><p id="engine-summary" class="engine-summary"></p><div class="setting-label">Wtrysk paliwa</div><div class="segmented" role="group" aria-label="Rodzaj wtrysku"><button data-injection="mpi" class="active" aria-pressed="true">Pośredni <span>MPI</span></button><button data-injection="gdi" aria-pressed="false">Bezpośredni <span>GDI</span></button></div><p id="injection-note" class="control-hint">Paliwo trafia do kanału przed zaworem dolotowym.</p><label class="turbo-setting"><span>Turbodoładowanie<small id="turbo-label">Silnik wolnossący</small></span><input id="turbo" type="checkbox" role="switch"><span class="switch" aria-hidden="true"></span></label><div class="boost-readout" id="boost-row" hidden><span>Ciśnienie doładowania</span><strong id="boost">0,00 bar</strong></div></div>
        <div class="control-footer">${icon('info')}<span>Parametry orientacyjne. Animacja jest spowolniona, wskazania odpowiadają symulacji.</span></div>
      </aside>
    </div>
    <section class="learning-strip"><div class="learning-number">SPRÓBUJ SAM</div><p><strong>Poczuj różnicę między biegami.</strong> Wciśnij sprzęgło, wybierz 1, dodaj gazu i powoli zwalniaj pedał. Przejdź do widoku „Napęd”, żeby zobaczyć, jak moment dociera do koła.</p><button id="try-drive" class="quiet-button">Zobacz napęd ${icon('arrow')}</button></section>
    <footer class="page-footer"><span>ENGINE / LAB <span class="footer-separator">·</span> Model edukacyjny</span><span>Obróć. Przybliż. Zrozum.</span></footer>
  </main>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>Twoje małe laboratorium</h2><button id="close-help" class="icon-button" aria-label="Zamknij instrukcję">×</button></div><p>Obracaj model palcem lub myszą. Przybliżaj dwoma palcami, kółkiem myszy albo przyciskami + i −. Klikaj części, aby poznać ich działanie.</p><ol><li><strong>Odkryj cztery suwy.</strong> Kliknij suw, aby zatrzymać model w jego środku. Suwak kąta pozwala ręcznie przesuwać wał przez pełny cykl.</li><li><strong>Rusz z miejsca.</strong> Wciśnij sprzęgło, wybierz pierwszy bieg, ustaw około 25% gazu i powoli zwalniaj sprzęgło suwakiem.</li><li><strong>Zmień bieg.</strong> Odejmij gaz, wciśnij sprzęgło, wybierz następny bieg i płynnie zwolnij pedał.</li><li><strong>Porównaj konfiguracje.</strong> Zmień MPI na GDI i zobacz położenie wtryskiwacza. Włącz turbo, dodaj gazu i obserwuj narastające doładowanie.</li></ol><p><strong>Skróty:</strong> spacja — pauza, Shift — sprzęgło (przytrzymaj), strzałki góra/dół — gaz, N i 1–5 — bieg. Skróty nie działają podczas edycji pól.</p><p class="dialog-note">To uproszczona symulacja dydaktyczna, a nie model konkretnego samochodu. Pomijamy m.in. szczegółową termodynamikę spalania, tarciową fazę synchronizacji biegów, chłodzenie i smarowanie. GDI może w rzeczywistości wtryskiwać paliwo w różnych fazach; tutaj pokazano wtrysk przy sprężaniu. Dwuwałkowa skrzynia pokazuje stale zazębione pary, przesuwki i widełki. Używa osobnej przesuwki na bieg, aby ułatwić obserwację. Modele V mają kąt 60° oraz przykładową numerację i kolejność zapłonu. To schematy dydaktyczne, nie rysunki konstrukcyjne. Widok turbo jest osobnym przekrojem.</p></dialog>
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
  let [title, description] = PARTS[part] || PARTS.block;
  if (part === 'crank') description += ` Przykładowa kolejność zapłonu ${getEngine(sim.engineId).name}: ${getEngine(sim.engineId).firingOrder.join(' → ')}.`;
  if (part === 'banks') description = sim.engineId === 'r4' ? 'W R4 wszystkie cztery cylindry leżą w jednym rzędzie.' : `W ${getEngine(sim.engineId).name} są dwa banki ustawione pod kątem 60°. W tej ilustracji bank A ma numery nieparzyste, a bank B — parzyste. Numeracja i kolejność zapłonu są przykładowe.`;
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
  $('#view-caption').textContent = { engine: `Przekrój ${getEngine(sim.engineId).name} · ${getEngine(sim.engineId).cylinders} cylindrów`, cylinder: 'Komora spalania, zawory i wtryskiwacz', drive: 'Od wału korbowego do kół', clutch: 'Tarcza, docisk i mechanizm wysprzęglania', gearbox: 'Stałe zazębienie i wybór przełożenia', turbo: 'Energia spalin napędza sprężarkę' }[value];
  $('#cycle-panel').hidden = false;
  $('#mechanism-readout').hidden = !['drive', 'clutch', 'gearbox'].includes(value);
  $('.scene-legend').innerHTML = ['drive', 'clutch', 'gearbox'].includes(value)
    ? '<span><i style="--dot:#ffc35a"></i>Przepływ momentu</span><span><i style="--dot:#68c9ed"></i>Wejście skrzyni</span>'
    : '<span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#ed7e77"></i>Spaliny</span>';
  $('#explode-control').hidden = value !== 'clutch';
  $('#next-stroke').hidden = false;
  $('#part-panel').hidden = true;
  selectedPart = null;
  updateUI();
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
  const current = cycleDegrees(sim.angle, selectedCylinder, sim.engineId);
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
$$('.view-tab[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
$('#try-drive').addEventListener('click', () => { changeView('drive'); $('.visual-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$$('[data-stroke]').forEach(button => button.addEventListener('click', () => setCycle(Number(button.dataset.stroke) * 180 + 90)));
$('#cycle-angle').addEventListener('input', event => setCycle(Number(event.target.value)));
$('#cylinder-number').addEventListener('change', event => {
  selectedCylinder = Number(event.target.value);
  scene?.selectCylinder(selectedCylinder);
  updateUI();
});
$('#pause').addEventListener('click', () => pause());
$('#next-stroke').addEventListener('click', () => setCycle(((strokeIndex(sim.angle, selectedCylinder, sim.engineId) + 1) % 4) * 180 + 90));
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
function updateEngineUI() {
  const engine = getEngine(sim.engineId);
  selectedCylinder = Math.min(selectedCylinder, engine.cylinders - 1);
  $('#engine-displacement').textContent = engine.displacement;
  $('#engine-bank-angle').textContent = engine.bankAngle ? `V · ${engine.bankAngle}°` : 'Rzędowy';
  $('#firing-interval').textContent = `Zapłon co ${engine.interval}°`;
  $('#engine-summary').textContent = `${engine.name} · ${engine.cylinders} cylindrów · ${engine.displacement}. Przykładowa kolejność zapłonu: ${engine.firingOrder.join(' → ')}.`;
  $('#cylinder-number').innerHTML = Array.from({ length: engine.cylinders }, (_, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')}</option>`).join('');
  $('#cylinder-number').value = selectedCylinder;
  $('#cylinder-states').innerHTML = Array.from({ length: engine.cylinders }, (_, i) => `<button data-cylinder="${i}" aria-label="Obserwuj cylinder ${i + 1}">${i + 1}</button>`).join('');
  $$('[data-cylinder]').forEach(button => button.addEventListener('click', () => {
    selectedCylinder = Number(button.dataset.cylinder);
    $('#cylinder-number').value = selectedCylinder;
    scene?.selectCylinder(selectedCylinder);
    lastStroke = -1;
    updateUI();
  }));
  $$('.engine-buttons [data-engine]').forEach(button => {
    const active = button.dataset.engine === engine.id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  lastStroke = -1;
}
$$('.engine-buttons [data-engine]').forEach(button => button.addEventListener('click', () => {
  sim.setEngine(button.dataset.engine);
  selectedCylinder = 0;
  scene?.setEngine(sim.engineId);
  updateEngineUI();
  changeView(mode);
}));
$('#explode').addEventListener('input', event => {
  if (scene) scene.drive.exploded = Number(event.target.value) / 100;
  $('#explode-value').textContent = `${event.target.value}%`;
});
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
  $$('[data-cylinder]').forEach(button => {
    const i = Number(button.dataset.cylinder);
    const phase = strokeIndex(sim.angle, i, sim.engineId);
    button.style.setProperty('--cylinder-color', STROKES[phase].color);
    button.classList.toggle('selected', i === selectedCylinder);
    button.setAttribute('aria-pressed', i === selectedCylinder);
    button.title = `Cylinder ${i + 1}: ${STROKES[phase].name}`;
  });
  $('#mechanism-engine-rpm').textContent = `${Math.round(sim.rpm)} obr./min`;
  $('#mechanism-input-rpm').textContent = `${Math.round(sim.inputOmega * 30 / Math.PI)} obr./min`;
  $('#mechanism-output-rpm').textContent = `${Math.round(sim.speed / 0.31 * 3.9 * 30 / Math.PI)} obr./min`;
  $('#mechanism-state').textContent = sim.clutch > 0.95 ? 'Sprzęgło rozłączone' : sim.clutchSlip > 80 ? 'Sprzęgło pracuje z poślizgiem' : 'Tarcza sprzęgła zaciśnięta';
  $('#mechanism-detail').textContent = mode === 'clutch' ? `Poślizg: ${Math.round(sim.clutchSlip)} obr./min. Wciśnij pedał i obserwuj łożysko, sprężynę oraz docisk.` : sim.gear ? `Bieg ${sim.gear}: wejście obraca się ${GEAR_RATIOS[sim.gear].toFixed(2).replace('.', ',')} raza na obrót wyjścia. Złote drobiny pokazują drogę momentu.` : 'Luz: koła zębate obracają się swobodnie. Żadna para nie jest połączona z wałem wyjściowym.';
  const phase = strokeIndex(sim.angle, selectedCylinder, sim.engineId);
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
  const degrees = Math.round(cycleDegrees(sim.angle, selectedCylinder, sim.engineId));
  if (document.activeElement !== $('#cycle-angle')) $('#cycle-angle').value = Math.min(719, degrees);
  $('#angle-readout').textContent = `${degrees}°`;
}

updateEngineUI();
setPedal('throttle', 0);
setPedal('clutch', 0);
updateUI();
let previousTime = performance.now();
let uiTime = 0;
function animate(time) {
  if (disposed) return;
  const dt = Math.max(0, Math.min((time - previousTime) / 1000, 0.1));
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
