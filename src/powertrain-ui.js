import { TRANSMISSIONS, DRIVE_LAYOUTS, SURFACES, WHEEL_NAMES } from './powertrain.js';

export const POWERTRAIN_CONTROLS = `
  <div class="powertrain-config">
    <label>Zespół napędowy / skrzynia<select id="transmission-type">${Object.entries(TRANSMISSIONS).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('')}</select></label>
    <label>Napęd kół<select id="drive-layout">${Object.entries(DRIVE_LAYOUTS).map(([id, d]) => `<option value="${id}">${d.name}</option>`).join('')}</select></label>
    <p id="powertrain-note" class="control-hint"></p>
    <label id="dct-auto-option" hidden><input id="dct-auto" type="checkbox">Automatyczne zmiany biegów</label>
    <label id="transfer-mode-option" hidden>Tryb 4WD<select id="transfer-mode"><option>2H</option><option>4H</option><option>4L</option></select></label>
  </div>
  <div class="hybrid-controls" id="hybrid-controls" hidden>
    <label>Tryb hybrydy<select id="hybrid-mode"><option value="auto">Automatyczny</option><option value="ev">EV · silnik elektryczny</option><option value="hybrid">Podział mocy · silnik + MG2</option><option value="charge">Ładowanie baterii</option></select></label>
    <label>Wybierak<select id="hybrid-range"><option>D</option><option>N</option><option>P</option></select></label>
    <label>Naładowanie baterii · doświadczenie<output id="battery-soc-value">60%</output><input id="battery-soc" type="range" min="20" max="85" value="60"></label>
    <div class="battery-metrics"><span>Bateria HV <b id="battery-voltage">201,6 V</b></span><span>Prąd DC <b id="battery-current">0 A</b></span><span>Moc baterii <b id="battery-power">0 kW</b></span><span>Energia <b id="battery-energy">0,78 kWh</b></span></div>
    <strong id="hybrid-state"></strong>
    <svg class="energy-map" viewBox="0 0 320 210" role="img" aria-label="Przepływ energii między silnikiem, MG1, MG2, falownikiem, baterią i kołami">
      <defs><marker id="energy-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="context-stroke"/></marker></defs>
      <path id="energy-engine" class="power-line" d="M94 24H115" stroke="#f5be4f"/>
      <path id="energy-mechanical" class="power-line" d="M205 24H230" stroke="#f5be4f"/>
      <path id="energy-generation" class="power-line" d="M143 40V63H49V85" stroke="#68c9ed"/>
      <path id="energy-mg1" class="power-line" d="M94 101H115" stroke="#68c9ed"/>
      <path id="energy-mg2" class="power-line" d="M205 101H230" stroke="#85e2b3"/>
      <path id="energy-wheel" class="power-line" d="M273 85V40" stroke="#85e2b3"/>
      <path id="energy-battery" class="power-line" d="M160 163V117" stroke="#f5ae58"/>
      <g class="energy-node"><rect x="4" y="8" width="90" height="32"/><text x="49" y="28">Silnik</text></g>
      <g class="energy-node"><rect x="115" y="8" width="90" height="32"/><text x="160" y="28">Planeta</text></g>
      <g class="energy-node"><rect x="230" y="8" width="86" height="32"/><text x="273" y="28">Koła</text></g>
      <g class="energy-node"><rect x="4" y="85" width="90" height="32"/><text x="49" y="105">MG1</text></g>
      <g class="energy-node"><rect x="115" y="85" width="90" height="32"/><text x="160" y="105">Falownik</text></g>
      <g class="energy-node"><rect x="230" y="85" width="86" height="32"/><text x="273" y="105">MG2</text></g>
      <g class="energy-node battery-node"><rect x="115" y="163" width="90" height="38"/><text x="160" y="187" id="energy-battery-label">Bateria 60%</text></g>
      <text class="energy-value" x="49" y="135" id="energy-mg1-value"></text><text class="energy-value" x="273" y="135" id="energy-mg2-value"></text>
      <text class="energy-value" x="204" y="147" id="energy-battery-value"></text>
    </svg>
    <div class="hybrid-speeds"><span>MG1 <b id="mg1-rpm"></b></span><span>MG2 <b id="mg2-rpm"></b></span><span>Silnik <b id="hybrid-engine-rpm"></b></span></div>
    <p id="hybrid-balance" class="control-hint"></p>
    <p class="control-hint">DC: umowny kierunek prądu, dodatni przy rozładowaniu. AC: strzałki pokazują kierunek energii; prąd w fazach zmienia kierunek.</p>
  </div>
  <details class="traction-settings" id="traction-settings">
    <summary>Przyczepność i blokady</summary>
    <div class="surface-controls">${WHEEL_NAMES.map((name, i) => `<label>${name}<select data-surface="${i}" aria-label="Nawierzchnia: ${name.toLowerCase()}">${Object.entries(SURFACES).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="axle-locks"><label id="center-lock-option" hidden><input id="center-lock" type="checkbox">Blokada centralna</label><label><input id="front-lock" type="checkbox">Blokada przedniej osi</label><label><input id="rear-lock" type="checkbox">Blokada tylnej osi</label></div>
    <label>Skręt<input id="vehicle-turn" type="range" min="-100" max="100" value="0" aria-label="Skręt pojazdu, lewo dodatnie"></label>
    <div class="wheel-telemetry">${WHEEL_NAMES.map((name, i) => `<div><span>${name}</span><b id="wheel-rpm-${i}">0 obr./min</b><small id="wheel-torque-${i}">0 Nm</small></div>`).join('')}</div>
    <p id="traction-note" class="control-hint"></p>
  </details>
`;

export const VEHICLE_TOOLS = `
  <div class="vehicle-tools" id="vehicle-tools" hidden>
    <label>Warstwa<select id="vehicle-layer"><option value="mechanical">Moment i mechanika</option><option value="electric">Prąd / energia hybrydy</option><option value="gases">Dolot / spaliny / turbo</option><option value="oil">Smarowanie</option><option value="fuel">Paliwo</option></select></label>
    <label>Detal<select id="vehicle-detail"><option value="auto">Automatycznie przy zbliżeniu</option><option value="overview">Podzespoły</option><option value="mechanics">Mechanizmy</option><option value="service">Pełny przekrój</option></select></label>
    <div class="vehicle-camera" role="group" aria-label="Ustawienie kamery pojazdu"><button data-camera="perspective">Perspektywa</button><button data-camera="top">Z góry</button><button data-camera="side">Z boku</button></div>
    <nav class="drive-map" aria-label="Podzespoły całego napędu"><button data-focus="all">Całość</button><button data-focus="engine">Silnik</button><button data-focus="gearbox" id="focus-transmission">Skrzynia</button><button data-focus="transfer" id="focus-transfer" hidden>Rozdział</button><button data-focus="frontAxle">Przód</button><button data-focus="rearAxle">Tył</button><button data-focus="battery" id="focus-battery" hidden>Bateria</button></nav>
  </div>
`;

export const SCENARIO_TOOLS = `
  <div class="scenario-panel" id="scenario-panel" hidden>
    <div><label>Doświadczenie<select id="scenario-select"></select></label><button class="secondary-button" id="scenario-start">Przygotuj</button><button class="secondary-button" id="scenario-play">Odtwórz</button><button class="secondary-button" id="scenario-next">Następny krok</button></div>
    <p id="scenario-description">Wybierz doświadczenie. Możesz odtworzyć animację lub przechodzić krokami.</p>
  </div>
`;

export const POWERTRAIN_PARTS = {
  vehicle: ['Przekrój pojazdu', 'Obrys pomaga rozróżnić przód, tył i położenie podzespołów. Warstwy oddzielają mechanikę, przepływy płynów i energię elektryczną. Rozmiary, przebieg przewodów i obudowy są dydaktyczne.'],
  driveDetail: ['Cały zespół napędowy', 'Wszystkie mechanizmy korzystają z tego samego stanu symulacji. Przejdź od silnika do wybranej skrzyni, rozdziału napędu i czterech kół. Wybierz część, aby ją przybliżyć, albo uruchom doświadczenie. Obroty, moment i moc są różnymi wielkościami.'],
  dct: ['DCT · dwie drogi napędu', 'K1 obsługuje biegi 1, 3 i 5, K2 biegi 2, 4 i 6. Wały wejściowe są współosiowe, ale obracają się niezależnie. Dwa wały wyjściowe prowadzą do wspólnego wyjścia. Synchronizatory wybierają bieg, a sprzęgła decydują o połączeniu z silnikiem. Schemat inspirowany mokrą DSG 02E, z umownymi przełożeniami i osobną przesuwką na bieg; nie jest repliką fabrycznej skrzyni.'],
  dctClutches: ['Mokre pakiety K1 / K2', 'Tarcze wejściowe są połączone z silnikiem; tarcze wyjściowe z odpowiednim wałem. Olej pod ciśnieniem przesuwa tłok i dociska tarcze. Sterownik reguluje przenoszony moment oraz poślizg. Odstępy podczas rozłączania i rozłożenia są powiększone.'],
  k1: ['K1 · biegi nieparzyste', 'Zewnętrzny pakiet K1 łączy silnik z wewnętrznym wałem. Biegi 1, 3 i 5. Gdy K2 napędza pojazd, na odciążonej gałęzi K1 można przygotować następny bieg.'],
  k2: ['K2 · biegi parzyste', 'Wewnętrzny pakiet K2 łączy silnik z rurowym wałem zewnętrznym. Biegi 2, 4 i 6. Wybrana dwójka pozostaje bez napędu, dopóki docisk K2 nie przenosi momentu.'],
  dctShafts: ['Dwa wały wejściowe', 'Niebieski wał K1 biegnie wewnątrz rurowego, miedzianego wału K2. Każdy może mieć inne obroty. To nie dwie bryły przenikające się: zewnętrzny wał ma otwór.'],
  dctGearPair: ['Bieg aktywny i przygotowany', 'Pary kół są stale zazębione. Przesuwka przygotowuje połączenie koła z wałem, ale napęd od silnika dociera przez właściwe sprzęgło. Jasny bieg aktywny przenosi moment; wybrany bieg drugiej gałęzi czeka z otwartym sprzęgłem.'],
  dctPiston: ['Tłok docisku DCT', 'Ciśnienie oleju dociska pakiet tarcz. Większy docisk pozwala przenieść większy moment. Sterownik nie blokuje sztywno obu sprzęgieł przy dwóch różnych przełożeniach — reguluje ich poślizg podczas przejmowania napędu.'],
  mechatronics: ['Mechatronika', 'Sterownik, czujniki i elektrozawory dobierają bieg, sterują wybierakami oraz ciśnieniem pakietów K1/K2. Przewody ilustrują układ sterowania; ciśnienie, temperatura i zużycie oleju nie są obliczane.'],
  dctOil: ['Olej DCT', 'Pompa zasila układ hydrauliczny. Filtr zatrzymuje zanieczyszczenia, a chłodnica odbiera ciepło. Mokre sprzęgła są chłodzone i smarowane olejem. Zielone znaczniki ilustrują obieg.'],
  hybrid: ['Hybryda planetarna e-CVT', 'Przekładnia łączy trzy prędkości: silnik na jarzmie, MG1 na słońcu, wyjście na wieńcu. MG2 jest połączone z wyjściem. Sterowanie maszynami zmienia zależność między obrotami silnika a prędkością samochodu. Nie ma pasa CVT ani wybieranych par biegów. To model zasad THS, nie odwzorowanie pełnej konkretnej generacji Toyoty.'],
  psd: ['Planetarny rozdzielacz mocy', 'Jarzmo porusza osiami satelitów. Satelity zazębiają się jednocześnie ze słońcem i wewnętrznym wieńcem. Model ma 30 zębów słońca, 78 wieńca i standardowe geometrycznie satelity 24-zębowe. Fabryczne profile oraz korekcje zębów są inne. Zależność obrotów: 30 × MG1 + 78 × wyjście = 108 × silnik.'],
  sun: ['Słońce · MG1', 'Centralne koło jest połączone z MG1. Przy nieruchomym silniku i obracającym się wyjściu MG1 musi obracać się przeciwnie. Może wtedy obracać się biernie, bez generowania prądu.'],
  carrier: ['Jarzmo · silnik benzynowy', 'Silnik obraca jarzmo, które przenosi osie satelitów. Moc może trafić mechanicznie na wyjście oraz do MG1. Podział momentu wynika z geometrii, natomiast podział mocy zależy także od prędkości obrotowych.'],
  ringGear: ['Wieniec · wyjście', 'Wewnętrzny wieniec jest połączony z wyjściem do przekładni głównej i MG2. Zmiana obrotów MG1 pozwala dobrać inne obroty silnika przy tej samej prędkości wyjścia.'],
  mg1: ['MG1 · generator / rozrusznik', 'Może uruchamiać silnik benzynowy albo przekształcać część jego mocy w energię elektryczną. Może także pracować jako silnik lub obracać się biernie. Kolorowe uzwojenia są nieruchome, wirnik z magnesami obraca się na wale.'],
  mg2: ['MG2 · silnik / generator', 'Przy przyspieszaniu pobiera energię z falownika i napędza koła. Przy rekuperacji koła obracają MG2, które oddaje energię przez falownik do baterii. Nie cała energia hamowania jest odzyskiwana; ograniczają ją przyczepność, moc maszyn i miejsce w baterii.'],
  battery: ['Bateria trakcyjna HV', 'Moduły magazynują energię. W modelu pakiet ma 201,6 V i umowną pojemność 1,3 kWh; sterownik pracuje w zakresie 20–85% naładowania. Pomarańczowy kabel przedstawia dodatni przewód DC, jasny przewód powrotny. W czasie ładowania umowny kierunek prądu w obu przewodach się odwraca. Styczniki rozłączają pakiet. Nie symulujemy temperatury, chemii ogniw ani spadku napięcia.'],
  inverter: ['Falownik · prąd stały i przemienny', 'Łączy baterię DC z trójfazowymi maszynami MG1/MG2. Przy napędzaniu zamienia DC na AC; podczas generowania prostuje AC na DC. MG1 może zasilać MG2 bez magazynowania całej energii w baterii. Strzałki AC pokazują średni kierunek energii, nie chwilowy kierunek prądu każdej fazy.'],
  transfer: ['Skrzynia rozdzielcza / reduktor', '2H napędza tylną oś. 4H dołącza przednią poprzez sprzęgło kłowe i napęd łańcuchowy. 4L dodaje redukcję 2,5:1. Sztywne połączenie wiąże obroty osi; nie narzuca stałego podziału momentu 50:50. Przełączanie reduktora wykonuj na postoju i bez obciążenia. To schemat funkcjonalny.'],
  centerDifferential: ['Centralny dyferencjał AWD', 'Pozwala przedniej i tylnej osi obracać się z różnymi prędkościami. Otwarta wersja przekazuje zbliżony moment na oba wyjścia, a jego dostępna wartość może być ograniczona słabszą osią. Blokada sprzęga obroty obu wyjść.'],
  centerLock: ['Blokada centralna', 'Łączy mechanicznie wyjścia do przedniej i tylnej osi. Podział momentu zależy wtedy od oporu osi. W zakręcie na przyczepnej nawierzchni pojawiają się naprężenia i konieczny poślizg opon.'],
  quattro: ['quattro · mechaniczne 40:60', 'Wybrany schemat ma planetarny mechanizm samoblokujący. Przekazuje bazowo 40% momentu na przód i 60% na tył. Skośne zęby wywołują siły osiowe, a pakiety cierne ograniczają różnicę obrotów. W modelu przyjęto opisany przez Audi zakres 20–60% na przód. Liczby zębów są dydaktyczne. Nie przedstawiamy quattro ultra ani sprzęgła Haldex.'],
  frontAxle: ['Przednia oś', 'W RWD przednie koła toczą się bez momentu napędowego. W FWD/AWD moment dociera do mechanizmu różnicowego i półosi. Podczas skrętu geometria toru zmienia wymagane prędkości kół.'],
  rearAxle: ['Tylna oś', 'W RWD tylna oś odbiera cały napęd. W AWD współpracuje z przednią osią poprzez mechanizm centralny lub sztywne połączenie. Otwarty dyferencjał pozwala półosiom mieć różne obroty; blokada sprzęga ich prędkości.'],
  differential: ['Otwarty mechanizm różnicowy', 'Koło talerzowe obraca kosz z satelitami. Satelity współpracują z kołami bocznymi połączonymi z półosiami. Średnia obrotów półosi równa się obrotom kosza. W quasi-statycznym modelu otwarty mechanizm ma równy moment na obu wyjściach, ograniczony przyczepnością słabszego koła. Blokada zmienia więzy prędkości i pozwala silniejszej stronie przenieść więcej momentu. Wybierz pokaz stołowy do nauki ruchu albo doświadczenie z lodem do porównania przyczepności.'],
  finalDrive: ['Przekładnia główna · 3,9:1', 'Przekładnia zmniejsza obroty i zwiększa moment przed mechanizmem różnicowym. W układzie wzdłużnym pokazano parę stożkową 10/39 zębów ze wspólnym wierzchołkiem stożków, zamiast prostopadle ustawionych kół walcowych. W FWD pokazano koła walcowe o równoległych osiach. Profile są schematyczne i nie odwzorowują fabrycznej przekładni hipoidalnej.']
};
