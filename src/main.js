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
import { INSPECTIONS } from './inspection.js';
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
let readoutMuted = window.matchMedia('(max-width:600px)').matches;

const PARTS = {
  timing: ['Rozrząd: pasek lub łańcuch', 'Wał korbowy napędza wałki rozrządu. Koło wałka ma dwa razy więcej zębów, dlatego zawory wykonują jeden cykl na dwa obroty wału. Pasek ma zęby; łańcuch współpracuje z kołami łańcuchowymi i wymaga smarowania. Przełącznik zmienia ilustrację napędu, nie osiągi silnika. Trasa, napinacz i krzywki są schematyczne.'],
  tensioner: ['Napinacz rozrządu', 'Utrzymuje napięcie paska lub łańcucha i ogranicza drgania. Pomaga utrzymać właściwą współpracę z zębami kół. W rzeczywistym układzie łańcuchowym dochodzą prowadnice i często napinacz hydrauliczny.'],
  sump: ['Miska i smok olejowy', 'Miska zbiera olej spływający z silnika. Smok z sitkiem zasysa go do pompy. To układ z mokrą miską; olej nie wypełnia komory spalania.'],
  oilPump: ['Pompa oleju', 'Pompa zasysa olej ze smoka i tłoczy go do filtra oraz magistrali. Napęd pochodzi od silnika; pokazano schemat pompy zębatej. Zawór przelewowy ogranicza ciśnienie w realnym układzie, lecz jego pracy nie symulujemy.'],
  oilFilter: ['Filtr oleju', 'Zatrzymuje zanieczyszczenia przed podaniem oleju do kanałów smarujących. Filtr oleju i filtr paliwa należą do dwóch oddzielnych obiegów.'],
  oilGallery: ['Magistrala i łożyska', 'Kanały doprowadzają olej pod ciśnieniem do łożysk wału i wałków rozrządu. W rzeczywistym wale wewnętrzne wiercenia doprowadzają go też do czopów korbowodowych. Tutaj pokazano główne gałęzie; przewody są wyprowadzone na zewnątrz dla czytelności. Zielone strzałki ilustrują kierunek, nie obliczony wydatek pompy.'],
  oilReturn: ['Powrót oleju', 'Po smarowaniu olej spływa grawitacyjnie kanałami do miski. Pompa pobiera go ponownie. Ciemnozielona droga oznacza spływ, jasnozielona — dopływ pod ciśnieniem.'],
  fuelTank: ['Zbiornik paliwa', 'Magazynuje benzynę. W przykładzie pompa w zbiorniku przesyła paliwo przez filtr do układu zasilania. Położenie zbiornika obok silnika jest wyłącznie dydaktyczne.'],
  fuelPump: ['Pompa paliwa i zbiornik', 'Pompa niskiego ciśnienia przesyła benzynę przez filtr. MPI zasila wtryskiwacze w kanałach dolotowych. GDI potrzebuje dodatkowej pompy wysokiego ciśnienia. Gaźnik wymaga znacznie niższego ciśnienia i zaworu sterowanego pływakiem; pompa może być mechaniczna lub elektryczna.'],
  fuelFilter: ['Filtr paliwa', 'Usuwa zanieczyszczenia przed gaźnikiem lub układem wtryskowym. Nie jest połączony z układem smarowania.'],
  highPressurePump: ['Pompa wysokiego ciśnienia · GDI', 'Pompa tłoczkowa, zwykle napędzana krzywką wałka rozrządu, podnosi ciśnienie paliwa dla listwy i wtryskiwaczy GDI. Widoczny tłoczek obrazuje ruch roboczy. To dodatkowy stopień po pompie zasilającej; model nie oblicza ciśnienia paliwa.'],
  carburetor: ['Gaźnik: zwężka, dysza i pływak', 'Powietrze przyspiesza w zwężce Venturiego. Różnica ciśnień powoduje wypływ paliwa z dyszy zasilanej z komory pływakowej. Pływak z zaworem utrzymuje poziom paliwa, a przepustnica reguluje dopływ mieszanki. Gaźnik jest przed kolektorem; nie ma osobnego wtryskiwacza przy każdym cylindrze. To przekrój jednego gardzielowego układu, bez obwodu biegu jałowego, ssania i pompki przyspieszającej.'],
  airFilter: ['Filtr powietrza', 'Oczyszcza powietrze przed przepustnicą lub gaźnikiem. Paliwo płynie inną drogą; miesza się z powietrzem dopiero w gaźniku, przed zaworem MPI lub w cylindrze GDI.'],
  synchroCone: ['Stożek i pierścień synchronizatora', 'Tarcie między stożkiem koła a pierścieniem wyrównuje obroty koła i wału. Dopiero wtedy przesuwka może zazębić się z wieńcem kłowym koła. Pomarańczowy pierścień oznacza tę fazę tarciową.'],
  driveDetail: ['Napęd szczegółowy', 'Wszystkie podzespoły pracują na wspólnym stanie symulacji: silnik, rozbieralne sprzęgło, skrzynia, wał napędowy, przekładnia główna, półosie i koła. Układ dolotu oraz wydechu łączy silnik z turbosprężarką i intercoolerem. Wybierz podzespół z listy, obróć go i przybliż. Opcja „Odizoluj” ukrywa pozostałe zespoły. Układ przestrzenny i profile przekładni są schematyczne.'],
  finalDrive: ['Przekładnia główna 3,9:1', 'Mały zębnik odbiera obrót ze skrzyni i napędza koło talerzowe połączone z koszem mechanizmu różnicowego. Na 3,9 obrotu wału wejściowego przypada jeden obrót kosza. Oś obrotu zmienia kierunek o 90°. Zęby stożkowe są przedstawione schematycznie; to ilustracja przekładni, nie dokładny model zazębienia.'],
  differential: ['Mechanizm różnicowy', 'Koło talerzowe obraca kosz z satelitami. Satelity współpracują z kołami bocznymi połączonymi z półosiami. Podczas jazdy na wprost obie półosie obracają się jednakowo; na zakręcie mechanizm pozwala im obracać się z różnymi prędkościami. W widoku „Dyferencjał” wybierz zakręt i uruchom pokaz stołowy. Średnia prędkości półosi zawsze równa się prędkości kosza. Pokaz ilustruje kinematykę otwartego mechanizmu, bez modelu przyczepności opon.'],
  halfShaft: ['Półosie i przeguby', 'Przekazują moment od mechanizmu różnicowego do piast kół. Przeguby pozwalają przenosić obrót przy zmianach ustawienia zawieszenia. Ugięcia zawieszenia i kąty przegubów nie są tu symulowane.'],
  propShaft: ['Wał napędowy', 'Łączy wyjście skrzyni z przekładnią główną. Widoczne przeguby i kołnierze pokazują połączenia wału. To schemat układu wzdłużnego; w samochodzie z napędem przednim przekładnia główna jest zwykle zintegrowana ze skrzynią.'],
  wheelHub: ['Piasta, koło i hamulec', 'Półoś obraca piastę i koło. Tarcza hamulcowa obraca się razem z piastą, a zacisk pozostaje nieruchomy. Przycisk hamulca w symulacji zwiększa opór ruchu pojazdu.'],
  turbine: ['Turbina spalinowa · strona gorąca', 'Energia spalin napędza łopatki wirnika turbiny. Obudowa spiralna kieruje przepływ do wirnika, a spaliny uchodzą wzdłuż jego osi do wydechu. Spaliny nie przepływają do sprężarki; oba wirniki łączy wyłącznie wałek.'],
  compressor: ['Sprężarka · strona dolotowa', 'Świeże powietrze wpływa osiowo od strony filtra. Wirnik przyspiesza je i kieruje promieniowo na zewnątrz. Dyfuzor oraz obudowa spiralna spowalniają przepływ i podnoszą ciśnienie. Sprężone powietrze płynie dalej do intercoolera.'],
  turboShaft: ['Wspólny wałek turbo', 'Wirnik turbiny i wirnik sprężarki są sztywno połączone tym samym wałkiem, dlatego obracają się z tą samą prędkością. Turbo nie ma mechanicznego połączenia z wałem korbowym. Animacja wałka jest umownie spowolniona.'],
  turboBearing: ['Rdzeń turbo, wałek i łożyska', 'Przekrój odsłania wałek, dwa łożyska ślizgowe oraz element oporowy przejmujący obciążenie osiowe. Film olejowy oddziela powierzchnie. Uszczelnienia ograniczają przepływ oleju do obudów turbiny i sprężarki.'],
  turboOil: ['Smarowanie rdzenia turbo', 'Zielony przewód doprowadza olej pod ciśnieniem do łożysk. Grubszy przewód dolny odprowadza go do silnika. Olej smaruje i odprowadza ciepło. To ilustracja połączeń, bez obliczania przepływu oleju.'],
  wastegate: ['Wastegate · obejście turbiny', 'Zawór otwiera obejście po stronie spalin. Część spalin omija wtedy wirnik turbiny, ograniczając dostarczaną mu energię i narastanie doładowania. To nie zawór upustowy powietrza. W modelu otwarcie jest ilustracją zależną od doładowania, bez osobnego regulatora.'],
  intercooler: ['Intercooler · chłodnica powietrza', 'Sprężanie podnosi temperaturę powietrza. Intercooler odbiera część ciepła, zwiększając gęstość ładunku. Żółty kanał pokazuje cieplejsze powietrze ze sprężarki, a niebieski — schłodzone powietrze kierowane do silnika. Temperatury nie są obliczane w tej symulacji.'],
  throttleBody: ['Przepustnica', 'Obrotowa klapa reguluje dopływ powietrza do silnika benzynowego. Suwak gazu otwiera ją. Za przepustnicą powietrze dociera kolektorem do zaworów dolotowych; spaliny płyną osobnym układem.'],
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
  synchronizer: ['Przesuwka i sprzęgło kłowe', 'Złota przesuwka zazębia się z bocznymi zębami wybranego koła i łączy je z wałem wyjściowym. W rzeczywistej skrzyni synchronizator wcześniej wyrównuje obroty; pomarańczowy pierścień pokazuje wyrównywanie obrotów, a przesuwka przesuwa się dopiero potem do położenia zablokowanego. Dla czytelności każdy bieg ma własną przesuwkę.'],
  shiftFork: ['Widełki zmiany biegów', 'Przesuwają tuleję wzdłuż wału, wybierając połączenie koła z wałem wyjściowym. Same widełki nie obracają się razem z tuleją.'],
  bearing: ['Łożyska wałów', 'Podpierają wały, utrzymują odległość między nimi i pozwalają na obrót. Stała odległość osi utrzymuje zazębienie wszystkich par kół.'],

  piston: ['Tłok i korbowód', 'Tłok porusza się w górę i w dół. Korbowód łączy go z wykorbieniem wału, zamieniając ten ruch na obrót. W R4 cylindry tworzą jeden rząd. W V6 i V12 są dwa banki pod kątem 60°, połączone z jednym wałem. Kolory pokazują aktualny suw wybranego cylindra.'],
  crank: ['Wał korbowy', 'Odbiera siłę z korbowodów i przekazuje obrót do koła zamachowego. Na pełny cykl czterosuwowy przypadają dwa obroty wału, czyli 720°.'],
  valves: ['Zawory i rozrząd', 'Zawór dolotowy wpuszcza ładunek, wydechowy wypuszcza spaliny. Wałek rozrządu obraca się dwa razy wolniej od wału korbowego. Model pomija wyprzedzenia, opóźnienia i współotwarcie zaworów.'],
  spark: ['Świeca zapłonowa', 'Iskra pojawia się pod koniec sprężania i inicjuje spalanie mieszanki. Ciśnienie rośnie, a gazy wykonują pracę na tłoku. W rzeczywistym silniku wyprzedzenie zapłonu zależy m.in. od obrotów i obciążenia.'],
  block: ['Blok silnika', 'W bloku znajdują się cylindry prowadzące tłoki. Przekrój odsłania wnętrze; wyłącz go, żeby zobaczyć osłonę cylindrów. To schemat edukacyjny, bez pełnego układu chłodzenia. Smarowanie pokazano w osobnym widoku „Olej”.'],
  clutch: ['Sprzęgło cierne', 'Zwolniony pedał: docisk zaciska tarczę na kole zamachowym, przekazując moment do skrzyni. Wciśnięty pedał: tarcza jest zwolniona, więc można zmienić bieg. Pośrednie położenie pozwala ruszać z poślizgiem. Odstęp tarcz jest powiększony dla czytelności.'],
  gearbox: ['Manualna skrzynia biegów', 'Na niższym biegu koła obracają się wolniej, ale dostają większy moment. Pary kół są stale zazębione; wybrana para zostaje połączona z wałem wyjściowym. Złoty pierścień oznacza wybrany bieg. Bieg N nie przekazuje napędu na koła.'],
  wheel: ['Napęd kół', 'Za skrzynią działa przekładnia główna 3,9:1, zmniejszająca obroty i zwiększająca moment na kołach. W widoku „Napęd szczegółowy” można obejrzeć przekładnię główną, mechanizm różnicowy i półosie; w zwykłym widoku koło przedstawia wynikowy ruch pojazdu. Model zakłada masę 1250 kg i promień koła 0,31 m.'],
  intake: ['Dolot', 'Niebieski kanał doprowadza powietrze do zaworu dolotowego. Przy wtrysku pośrednim paliwo jest dodawane przed zaworem. Złote drobiny przedstawiają paliwo, niebieskie — powietrze.'],
  exhaust: ['Wydech', 'Spaliny uchodzą przez otwarty zawór wydechowy do kolektora. W silniku z turbo ich energia napędza turbinę połączoną wałkiem ze sprężarką.'],
  injection: ['Miejsce wtrysku', 'MPI: paliwo jest wtryskiwane do kanału przed zaworem dolotowym. Gaźnik: paliwo miesza się z powietrzem w zwężce przed kolektorem. GDI: wtryskiwacz podaje paliwo bezpośrednio do cylindra. Pokazany wtrysk GDI podczas sprężania jest jednym z wariantów; rzeczywiste układy mogą wtryskiwać także podczas ssania i wielokrotnie.'],
  turbo: ['Turbosprężarka', 'Spaliny obracają turbinę (kolor miedziany), a wspólny wałek napędza sprężarkę (kolor niebieski). Sprężarka wtłacza więcej powietrza do silnika. Doładowanie narasta z opóźnieniem; zwiększ gaz i obroty, żeby to zobaczyć. Przekrój pokazuje obudowy spiralne, wirniki, wspólny wałek z łożyskami, smarowanie, zawór wastegate, intercooler i przepustnicę. Powietrze nie miesza się ze spalinami.']
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
          <button class="view-tab active" data-view="engine" aria-pressed="true">Cały silnik</button><button class="view-tab" data-view="cylinder" aria-pressed="false">Jeden cylinder</button><button class="view-tab" data-view="drive" aria-pressed="false">Napęd</button><button class="view-tab" data-view="drive-detail" aria-pressed="false">Napęd szczegółowy</button><button class="view-tab" data-view="clutch" aria-pressed="false">Sprzęgło</button><button class="view-tab" data-view="gearbox" aria-pressed="false">Skrzynia biegów</button><button class="view-tab" data-view="differential" aria-pressed="false">Dyferencjał</button><button class="view-tab" data-view="timing" aria-pressed="false">Rozrząd</button><button class="view-tab" data-view="oil" aria-pressed="false">Olej</button><button class="view-tab" data-view="fuel" aria-pressed="false">Paliwo / gaźnik</button><button class="view-tab" data-view="turbo" aria-pressed="false">Turbo</button>
        </div><button class="icon-button" id="fullscreen" aria-label="Pełny ekran modelu" title="Pełny ekran">${icon('expand')}</button></div>
        <div class="inspection-toolbar" id="inspection-toolbar" hidden><label>Przybliż podzespół<select id="inspect-section"></select></label><label class="isolate-option" id="isolate-option"><input id="isolate" type="checkbox">Odizoluj</label><button id="inspect-description" class="quiet-button">Opis podzespołu</button><span id="inspection-note"></span>
          <div class="lesson-tools" id="clutch-lesson" hidden><svg class="clutch-diagram" viewBox="0 0 270 52" role="img" aria-label="Przekrój styku koła zamachowego, tarczy i docisku"><path d="M0 26H80M180 26H270" stroke="#6ac5e9" stroke-width="5"/><rect x="70" y="4" width="20" height="44" fill="#a3b3c0"/><rect id="diagram-disc" x="90" y="7" width="12" height="38" fill="#e0b354"/><rect id="diagram-pressure" x="102" y="4" width="16" height="44" fill="#a3b3c0"/><path id="diagram-torque" d="M10 26H240m-10-7 10 7-10 7" fill="none" stroke="#78edab" stroke-width="3"/></svg><div><strong id="contact-state"></strong><small id="contact-detail"></small></div><button class="secondary-button" id="assemble-clutch">Złóż części</button></div>
          <div class="lesson-tools" id="gear-lesson" hidden><div class="shift-stages"><span data-shift-stage="release">1 · Rozłączenie</span><span data-shift-stage="synchronize">2 · Synchronizacja</span><span data-shift-stage="engage">3 · Przesuwka</span><span data-shift-stage="idle">4 · Połączenie</span></div><button class="secondary-button" id="shift-step">Następny etap</button><small id="shift-detail"></small></div>
          <div class="lesson-tools" id="diff-lesson" hidden><button class="secondary-button" id="diff-demo" aria-pressed="false">Uruchom pokaz stołowy</button><div class="turn-buttons" role="group" aria-label="Kierunek jazdy"><button data-turn="1">Zakręt w lewo</button><button data-turn="0" class="active">Na wprost</button><button data-turn="-1">Zakręt w prawo</button></div><label><input id="diff-open" type="checkbox">Odsłoń satelity</label><div class="diff-speeds"><span>L <b id="diff-left"></b></span><span>Kosz <b id="diff-carrier"></b></span><span>P <b id="diff-right"></b></span></div><small id="diff-detail"></small></div>
        </div>
        <div class="scene" id="scene">
          <div class="scene-caption"><span class="live-status" id="engine-status">SILNIK PRACUJE</span><span id="view-caption">Przekrój rzędowej czwórki</span><strong id="phase-overlay"></strong></div>
          <div class="mechanism-readout" id="mechanism-readout" hidden><button class="close-readout" aria-label="Ukryj parametry napędu">×</button><strong id="mechanism-state"></strong><div><span>Silnik <b id="mechanism-engine-rpm"></b></span><span>Wejście skrzyni <b id="mechanism-input-rpm"></b></span><span>Wyjście skrzyni <b id="mechanism-output-rpm"></b></span></div><small id="mechanism-detail"></small></div>
          <div class="mechanism-readout turbo-readout" id="turbo-readout" hidden><button class="close-readout" aria-label="Ukryj parametry turbo">×</button><strong id="turbo-state"></strong><div><span>Doładowanie<b id="turbo-pressure">0,00 bar</b></span><span>Wastegate<b id="wastegate-value">0%</b></span></div><small id="turbo-explanation"></small><button id="turbo-activate" class="secondary-button">Włącz turbo</button></div>
          <button id="show-readout" class="show-readout quiet-button" hidden>Pokaż parametry</button>
          <div class="scene-options"><label><input id="cutaway" type="checkbox" checked><span>Przekrój</span></label><label><input id="labels" type="checkbox" checked><span>Opisy</span></label><label id="flow-option" hidden><input id="flow" type="checkbox" checked><span>Przepływ</span></label></div>
          <div class="scene-legend"><span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#ed7e77"></i>Spaliny</span></div>
          <div class="camera-tools"><button id="zoom-in" class="icon-button" aria-label="Przybliż">${icon('plus')}</button><button id="zoom-out" class="icon-button" aria-label="Oddal">${icon('minus')}</button><button id="camera-reset" class="icon-button" aria-label="Przywróć kamerę">${icon('focus')}</button></div>
          <div class="orbit-hint">${icon('rotate')}<span>Przeciągnij, by obrócić · przybliż dwoma palcami lub kółkiem myszy</span></div>
          <div id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="quick-controls" aria-label="Sterowanie przy modelu"><label for="quick-throttle">Gaz <output id="quick-throttle-value">0%</output><input id="quick-throttle" type="range" min="0" max="100" value="0"></label><label for="quick-clutch">Sprzęgło <output id="quick-clutch-value">0%</output><input id="quick-clutch" class="blue-range" type="range" min="0" max="100" value="0"></label><label for="quick-gear">Bieg<select id="quick-gear"><option value="0">N</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div>
        <div class="playback"><div class="playback-left"><button id="pause" class="play-button" aria-label="Wstrzymaj symulację">${icon('pause')}</button><button id="next-stroke" class="quiet-button" title="Zatrzymaj i przejdź o jeden suw">Następny suw ${icon('chevron')}</button></div><label id="explode-control" class="explode-control" hidden>Widok rozstrzelony<input id="explode" type="range" min="0" max="100" value="0"><output id="explode-value">0%</output></label><label class="speed-select">Tempo animacji<select id="animation-speed"><option value="0.01">1%</option><option value="0.02" selected>2%</option><option value="0.05">5%</option><option value="0.1">10%</option><option value="1">100%</option></select></label></div>
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
        <div class="configuration"><div class="section-heading">KONFIGURACJA SILNIKA</div><p id="engine-summary" class="engine-summary"></p><div class="setting-label">Zasilanie paliwem</div><div class="segmented" role="group" aria-label="Zasilanie paliwem"><button data-injection="mpi" class="active" aria-pressed="true">Pośredni <span>MPI</span></button><button data-injection="gdi" aria-pressed="false">Bezpośredni <span>GDI</span></button><button data-injection="carb" aria-pressed="false">Gaźnik<span>Zwężka</span></button></div><p id="injection-note" class="control-hint">Paliwo trafia do kanału przed zaworem dolotowym.</p><label class="timing-setting">Napęd rozrządu<select id="timing-type"><option value="belt">Pasek zębaty</option><option value="chain">Łańcuch</option></select></label><label class="turbo-setting"><span>Turbodoładowanie<small id="turbo-label">Silnik wolnossący</small></span><input id="turbo" type="checkbox" role="switch"><span class="switch" aria-hidden="true"></span></label><div class="boost-readout" id="boost-row" hidden><span>Ciśnienie doładowania</span><strong id="boost">0,00 bar</strong></div></div>
        <div class="control-footer">${icon('info')}<span>Parametry orientacyjne. Animacja jest spowolniona, wskazania odpowiadają symulacji.</span></div>
      </aside>
    </div>
    <section class="learning-strip"><div class="learning-number">SPRÓBUJ SAM</div><p><strong>Poczuj różnicę między biegami.</strong> Wciśnij sprzęgło, wybierz 1, dodaj gazu i powoli zwalniaj pedał. Przejdź do widoku „Napęd”, żeby zobaczyć, jak moment dociera do koła.</p><button id="try-drive" class="quiet-button">Zobacz napęd ${icon('arrow')}</button></section>
    <footer class="page-footer"><span>ENGINE / LAB <span class="footer-separator">·</span> Model edukacyjny</span><span>Obróć. Przybliż. Zrozum.</span></footer>
  </main>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>Twoje małe laboratorium</h2><button id="close-help" class="icon-button" aria-label="Zamknij instrukcję">×</button></div><p>Obracaj model palcem lub myszą. Przybliżaj dwoma palcami, kółkiem myszy albo przyciskami + i −. Klikaj części, aby poznać ich działanie.</p><ol><li><strong>Odkryj cztery suwy.</strong> Kliknij suw, aby zatrzymać model w jego środku. Suwak kąta pozwala ręcznie przesuwać wał przez pełny cykl.</li><li><strong>Rusz z miejsca.</strong> Wciśnij sprzęgło, wybierz pierwszy bieg, ustaw około 25% gazu i powoli zwalniaj sprzęgło suwakiem.</li><li><strong>Zmień bieg.</strong> Odejmij gaz, wciśnij sprzęgło, wybierz następny bieg i płynnie zwolnij pedał.</li><li><strong>Porównaj konfiguracje.</strong> Zmień MPI na GDI i zobacz położenie wtryskiwacza. Włącz turbo, dodaj gazu i obserwuj narastające doładowanie.</li></ol><p><strong>Skróty:</strong> spacja — pauza, Shift — sprzęgło (przytrzymaj), strzałki góra/dół — gaz, N i 1–5 — bieg. Skróty nie działają podczas edycji pól.</p><p class="dialog-note">To uproszczona symulacja dydaktyczna, a nie model konkretnego samochodu. Pomijamy m.in. szczegółową termodynamikę spalania oraz szczegółową dynamikę tarcia synchronizatora. Etapy zmiany biegów są celowo spowolnione do 2,4 s; obroty wejścia są wyrównywane przed połączeniem. Chłodzenie powietrza, smarowanie turbo oraz sterowanie wastegate są zilustrowane, ale nie obliczane fizycznie. GDI może w rzeczywistości wtryskiwać paliwo w różnych fazach; tutaj pokazano wtrysk przy sprężaniu. Dwuwałkowa skrzynia pokazuje stale zazębione pary, przesuwki i widełki. Używa osobnej przesuwki na bieg, aby ułatwić obserwację. Modele V mają kąt 60° oraz przykładową numerację i kolejność zapłonu. To schematy dydaktyczne, nie rysunki konstrukcyjne. Widok turbo jest osobnym przekrojem.</p></dialog>
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
  $('#view-caption').textContent = { engine: `Przekrój ${getEngine(sim.engineId).name} · ${getEngine(sim.engineId).cylinders} cylindrów`, cylinder: 'Komora spalania, zawory i wtryskiwacz', drive: 'Od wału korbowego do kół', 'drive-detail': 'Pełny układ · wybierz podzespół do inspekcji', clutch: 'Tarcza, docisk i mechanizm wysprzęglania', gearbox: 'Stałe zazębienie i wybór przełożenia', turbo: 'Energia spalin napędza sprężarkę', differential: 'Dwa koła · różne prędkości · wspólny kosz', timing: 'Dwa obroty wału na jeden obrót wałka', oil: 'Obieg smarowania · kierunki przepływu', fuel: 'Droga paliwa i przygotowanie mieszanki' }[value];
  $('#cycle-panel').hidden = false;
  configureInspection(value);
  updateReadouts();
  $('#flow-option').hidden = !['drive', 'drive-detail', 'clutch', 'gearbox', 'turbo', 'oil', 'fuel'].includes(value);
  $('.scene-legend').innerHTML = ['drive', 'drive-detail', 'clutch', 'gearbox'].includes(value)
    ? '<span><i style="--dot:#ffc35a"></i>Przepływ momentu</span><span><i style="--dot:#68c9ed"></i>Wejście skrzyni</span>'
    : value === 'turbo' ? '<span><i style="--dot:#e68565"></i>Spaliny</span><span><i style="--dot:#f5b74e"></i>Ciepłe powietrze</span><span><i style="--dot:#69d5ee"></i>Chłodne powietrze</span>' : '<span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#ed7e77"></i>Spaliny</span>';
  if (value === 'oil') $('.scene-legend').innerHTML = '<span><i style="--dot:#70edb1"></i>Olej pod ciśnieniem</span><span><i style="--dot:#319b74"></i>Spływ oleju</span>';
  if (value === 'differential') $('.scene-legend').innerHTML = '<span><i style="--dot:#69d5ff"></i>Lewe koło</span><span><i style="--dot:#f7ba55"></i>Prawe koło</span><span><i style="--dot:#e68565"></i>Satelity</span>';
  $('#explode-control').hidden = !['clutch', 'drive-detail'].includes(value);
  $('#next-stroke').hidden = false;
  $('#part-panel').hidden = true;
  selectedPart = null;
  updateUI();
}
function configureInspection(view) {
  const entries = INSPECTIONS[view];
  $('#inspection-toolbar').hidden = !entries;
  $('.visual-panel').classList.toggle('inspecting', Boolean(entries));
  updateLessons();
  if (!entries) return;
  $('#inspect-section').innerHTML = entries.map(entry => `<option value="${entry.id}">${entry.label}</option>`).join('');
  $('#inspect-section').value = scene?.inspection || 'all';
  $('#isolate-option').hidden = ['clutch','gearbox','differential'].includes(view);
  $('#isolate').checked = scene?.isolate || false;
  $('#inspection-note').textContent = (entries.find(entry => entry.id === $('#inspect-section').value) || entries[0]).hint;
}
function inspectSection() {
  if (mode === 'fuel' && ['carburetor','highPressurePump'].includes($('#inspect-section').value)) {
    sim.injection = $('#inspect-section').value === 'carburetor' ? 'carb' : 'gdi';
    updateConfiguration();
  }
  scene?.inspect($('#inspect-section').value, $('#isolate').checked);
  const entry = INSPECTIONS[mode].find(entry => entry.id === $('#inspect-section').value);
  $('#inspection-note').textContent = entry.hint;
  $('#part-panel').hidden = true;
  updateReadouts();
  updateLessons();
}
function updateReadouts() {
  const relevant = ['drive', 'clutch', 'gearbox', 'turbo'].includes(mode) || mode === 'drive-detail' && ['all','clutch','gearbox','turbo'].includes(scene?.inspection);
  const turbo = mode === 'turbo' || mode === 'drive-detail' && scene?.inspection === 'turbo';
  const visible = relevant && $('#labels').checked && !readoutMuted;
  $('#mechanism-readout').hidden = !visible || turbo;
  $('#turbo-readout').hidden = !visible || !turbo;
  $('#show-readout').hidden = !relevant || visible;
}
function lessonView() {
  return mode === 'drive-detail' ? scene?.inspection : mode;
}
function updateLessons() {
  const view = lessonView();
  $('#clutch-lesson').hidden = view !== 'clutch';
  $('#gear-lesson').hidden = view !== 'gearbox';
  $('#diff-lesson').hidden = !['differential','finalDrive'].includes(view);
  $('#diff-demo').hidden = view !== 'differential';
}
function updateLessonState() {
  const separated = sim.clutch >= 0.85;
  const slipping = !separated && sim.clutchSlip > 60;
  $('#contact-state').textContent = separated ? 'ROZŁĄCZONE · brak docisku' : slipping ? 'STYK Z POŚLIZGIEM · obroty się różnią' : 'POŁĄCZONE · tarcza napędza wejście';
  $('#contact-detail').textContent = `${separated ? 0 : Math.round(sim.transmittedTorque)} Nm przez sprzęgło · różnica ${Math.round(sim.clutchSlip)} obr./min${scene?.drive.exploded > 0 ? ' · widok rozstrzelony: odstępy montażowe są umowne' : ' · zielony: powierzchnie przenoszące moment'}`;
  const release = Math.max(0, (sim.clutch - 0.85) / 0.15);
  $('#diagram-disc').setAttribute('x',90 + release * 25);
  $('#diagram-pressure').setAttribute('x',102 + release * 65);
  $('#diagram-torque').style.opacity = separated ? 0 : Math.max(0.15, 1 - sim.clutch);
  const stage = sim.shiftStage;
  $$('[data-shift-stage]').forEach(element => element.classList.toggle('active', element.dataset.shiftStage === stage && (sim.shiftTarget !== null || sim.gear > 0)));
  $('#shift-step').disabled = sim.shiftTarget === null;
  const selected = sim.shiftTarget || sim.gear;
  const output = sim.speed / 0.31 * 3.9 * 30 / Math.PI;
  const free = selected ? sim.inputOmega / GEAR_RATIOS[selected] * 30 / Math.PI : 0;
  $('#shift-detail').textContent = sim.shiftTarget !== null ? `${sim.shiftFrom || 'N'} → ${sim.shiftTarget || 'N'} · ${stage === 'release' ? 'Tuleja opuszcza zęby poprzedniego biegu.' : stage === 'synchronize' ? 'Pierścień trze o stożek, wyrównując obroty.' : 'Tuleja zachodzi na zęby kłowe koła.'} Koło ${Math.round(free)} / wał ${Math.round(output)} obr./min.` : sim.gear ? `Bieg ${sim.gear} połączony. Koło i wał: ${Math.round(output)} obr./min. Zwolnij sprzęgło, aby przekazać moment.` : 'Luz: wszystkie koła obracają się swobodnie na wale. Wciśnij sprzęgło i wybierz bieg; możesz zatrzymać zmianę i przejść etapami.';
  const diff = scene?.finalDrive;
  $('#diff-left').textContent = `${(diff?.leftSpeed || 0).toFixed(1)}`;
  $('#diff-carrier').textContent = `${(diff?.carrierSpeed || 0).toFixed(1)}`;
  $('#diff-right').textContent = `${(diff?.rightSpeed || 0).toFixed(1)}`;
  $('#diff-demo').textContent = diff?.demo ? 'Zakończ pokaz stołowy' : 'Uruchom pokaz stołowy';
  $('#diff-demo').setAttribute('aria-pressed', Boolean(diff?.demo));
  $$('[data-turn]').forEach(button => { const active = Number(button.dataset.turn) === sim.turn; button.classList.toggle('active',active); button.setAttribute('aria-pressed',active); });
  $('#diff-detail').textContent = `${diff?.demo ? 'Pokaz stołowy · umowne obroty, niezależne od samochodu.' : 'Napęd ze skrzyni; na postoju koła stoją.'} ${sim.turn === 0 ? 'Na wprost: obie półosie obracają się jednakowo.' : sim.turn > 0 ? 'Zakręt w lewo: prawe koło jest zewnętrzne i obraca się szybciej.' : 'Zakręt w prawo: lewe koło jest zewnętrzne i obraca się szybciej.'} (L + P) / 2 = kosz · obr./min.`;
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
    $('#clutch-toggle').innerHTML = `${sim.clutch >= 0.85 ? 'Zwolnij pedał' : 'Wciśnij pedał'} <kbd>Shift</kbd>`;
  }
  updateUI();
}
function shift(value) {
  if (!sim.shift(value)) toast(sim.shiftTarget !== null ? 'Dokończ obecną zmianę biegu.' : 'Najpierw wciśnij sprzęgło co najmniej do 85%.');
  else if (value && mode === 'gearbox' && scene.inspection !== 'all') {
    $('#inspect-section').value = `gear${value}`;
    inspectSection();
  }
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
  if (mode === 'fuel' && ['carburetor','highPressurePump'].includes(scene?.inspection)) {
    $('#inspect-section').value = sim.injection === 'carb' ? 'carburetor' : sim.injection === 'gdi' ? 'highPressurePump' : 'fuel';
    inspectSection();
  }
}));
function updateConfiguration() {
  lastStroke = -1;
  $$('[data-injection]').forEach(button => {
    const active = button.dataset.injection === sim.injection;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#injection-note').textContent = sim.injection === 'carb' ? 'Gaźnik zasysa paliwo w zwężce przed kolektorem. Obejrzyj widok „Paliwo / gaźnik”.' : sim.injection === 'mpi' ? 'Paliwo trafia do kanału przed zaworem dolotowym.' : 'Paliwo trafia wprost do cylindra — tutaj przy sprężaniu.';
  $('#turbo').checked = sim.turbo;
  $('#turbo-label').textContent = sim.turbo ? 'Turbosprężarka aktywna' : 'Silnik wolnossący';
  $('#boost-row').hidden = !sim.turbo;
}
$('#timing-type').addEventListener('change', event => { sim.timing = event.target.value; });
$('#assemble-clutch').addEventListener('click', () => {
  if (scene) { scene.drive.exploded = 0; scene.setView(mode); }
  $('#explode').value = 0;
  $('#explode-value').textContent = '0%';
});
$('#shift-step').addEventListener('click', () => {
  if (sim.shiftTarget === null) return;
  pause(true);
  const next = sim.shiftProgress < 0.25 ? 0.5 : sim.shiftProgress < 0.75 ? 0.875 : 1.001;
  const duration = (next - sim.shiftProgress) * 2.4;
  for (let t = 0; t < duration; t += 0.002) sim.integrate(Math.min(0.002,duration-t));
  updateUI();
});
$('#diff-demo').addEventListener('click', () => {
  if (!scene) return;
  scene.finalDrive.demo = !scene.finalDrive.demo;
  if (scene.finalDrive.demo) pause(false);
  updateUI();
});
$$('[data-turn]').forEach(button => button.addEventListener('click', () => { sim.turn = Number(button.dataset.turn); updateUI(); }));
$('#diff-open').addEventListener('change', event => { if (scene) scene.finalDrive.openCarrier = event.target.checked; });
$('#turbo').addEventListener('change', event => {
  sim.turbo = event.target.checked;
  updateConfiguration();
  if (sim.turbo) toast('Turbo włączone. Dodaj gazu: doładowanie wzrośnie wraz z obrotami.');
});
$('#cutaway').addEventListener('change', event => { if (scene) scene.cutaway = event.target.checked; });
window.matchMedia('(max-width:600px)').addEventListener('change', event => { if (event.matches) readoutMuted = true; updateReadouts(); });
$('#labels').addEventListener('change', event => { if (scene) scene.labels = event.target.checked; updateReadouts(); });
$$('.close-readout').forEach(button => button.addEventListener('click', () => { readoutMuted = true; updateReadouts(); }));
$('#show-readout').addEventListener('click', () => { readoutMuted = false; $('#labels').checked = true; if (scene) scene.labels = true; updateReadouts(); });
$('#flow').addEventListener('change', event => { if (scene) { scene.drive.showFlow = event.target.checked; scene.turbo.showFlow = event.target.checked; scene.systems.showFlow = event.target.checked; } });
$('#inspect-section').addEventListener('change', inspectSection);
$('#isolate').addEventListener('change', inspectSection);
$('#inspect-description').addEventListener('click', () => choosePart(INSPECTIONS[mode].find(entry => entry.id === $('#inspect-section').value).part));
$('#turbo-activate').addEventListener('click', () => { sim.turbo = !sim.turbo; updateConfiguration(); updateUI(); });
$('#zoom-in').addEventListener('click', () => scene?.zoom(0.8));
$('#zoom-out').addEventListener('click', () => scene?.zoom(1.25));
$('#camera-reset').addEventListener('click', () => { if (INSPECTIONS[mode]) { $('#inspect-section').value = 'all'; $('#isolate').checked = false; inspectSection(); } else scene?.setView(mode); });
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
  if (scene) { scene.finalDrive.demo = false; scene.finalDrive.openCarrier = false; }
  $('#diff-open').checked = false;
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
$('#explode').addEventListener('change', () => scene?.setView(mode));
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
  $('#quick-gear').value = sim.shiftTarget ?? sim.gear;
  $('#ratio-label').textContent = sim.gear ? `${GEAR_RATIOS[sim.gear].toFixed(2).replace('.', ',')} : 1` : 'Luz';
  $$('[data-gear]').forEach(button => {
    const active = Number(button.dataset.gear) === (sim.shiftTarget ?? sim.gear);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#drive-status').textContent = sim.shiftTarget !== null ? 'Zmiana biegu trwa. Obserwuj pierścień i przesuwkę; trzymaj pedał wciśnięty.' : sim.stalled ? 'Silnik zgasł. Wciśnij sprzęgło i uruchom go ponownie.' : sim.gear === 0 ? 'Luz: silnik nie napędza kół.' : sim.clutch >= 0.85 ? 'Sprzęgło rozłączone: silnik nie napędza kół.' : sim.clutch > 0.05 && sim.clutchSlip > 60 ? 'Poślizg sprzęgła: obroty wałów się wyrównują.' : 'Sprzęgło przenosi moment do kół.';
  $$('[data-cylinder]').forEach(button => {
    const i = Number(button.dataset.cylinder);
    const phase = strokeIndex(sim.angle, i, sim.engineId);
    button.style.setProperty('--cylinder-color', STROKES[phase].color);
    button.classList.toggle('selected', i === selectedCylinder);
    button.setAttribute('aria-pressed', i === selectedCylinder);
    button.title = `Cylinder ${i + 1}: ${STROKES[phase].name}`;
  });
  $('#turbo-state').textContent = !sim.turbo ? 'Turbo wyłączone' : !sim.running ? 'Silnik zatrzymany' : sim.boost > 0.05 ? 'Sprężarka zwiększa ciśnienie dolotu' : 'Turbo włączone · dodaj gazu';
  $('#turbo-pressure').textContent = `${sim.boost.toFixed(2).replace('.', ',')} bar`;
  $('#wastegate-value').textContent = `${Math.round((scene?.turbo.wastegateOpening || 0) * 100)}%`;
  $('#turbo-explanation').textContent = !sim.turbo ? 'Włącz turbo, aby zobaczyć obrót i przepływ. Potem zwiększ gaz.' : 'Spaliny i powietrze płyną osobno. Wirniki łączy jeden wałek; wastegate to obejście spalin.';
  $('#turbo-activate').textContent = sim.turbo ? 'Wyłącz turbo' : 'Włącz turbo';
  $('#mechanism-engine-rpm').textContent = `${Math.round(sim.rpm)} obr./min`;
  $('#mechanism-input-rpm').textContent = `${Math.round(sim.inputOmega * 30 / Math.PI)} obr./min`;
  $('#mechanism-output-rpm').textContent = `${Math.round(sim.speed / 0.31 * 3.9 * 30 / Math.PI)} obr./min`;
  $('#mechanism-state').textContent = sim.clutch >= 0.85 ? 'Pedał wciśnięty · sprzęgło rozłączone' : sim.clutch > 0.02 ? 'Pedał częściowo wciśnięty · poślizg' : 'Pedał zwolniony · sprzęgło połączone';
  $('#mechanism-detail').textContent = sim.shiftTarget !== null ? 'Trwa zmiana biegu: śledź etapy w pasku nad modelem. Skrzynia chwilowo jest na luzie.' : mode === 'clutch' ? `Poślizg: ${Math.round(sim.clutchSlip)} obr./min. Wciśnij pedał i obserwuj łożysko, sprężynę oraz docisk.` : sim.gear ? `Bieg ${sim.gear}: wejście obraca się ${GEAR_RATIOS[sim.gear].toFixed(2).replace('.', ',')} raza na obrót wyjścia. Złote strzałki pokazują drogę momentu.` : 'Luz: koła zębate obracają się swobodnie. Żadna para nie jest połączona z wałem wyjściowym.';
  const phase = strokeIndex(sim.angle, selectedCylinder, sim.engineId);
  if (phase !== lastStroke) {
    lastStroke = phase;
    $$('[data-stroke]').forEach(button => {
      const active = Number(button.dataset.stroke) === phase;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    $('#stroke-description').textContent = phase === 1 && sim.injection !== 'gdi' ? 'Tłok idzie w górę, a oba zawory są zamknięte. Mieszanka powietrza z paliwem zostaje sprężona. Pod koniec tego suwu świeca inicjuje spalanie.' : STROKES[phase].description;
    $('#stroke-badge').textContent = `0${phase + 1}`;
    $('#stroke-badge').style.color = STROKES[phase].color;
  }
  updateLessonState();
  $('#phase-overlay').hidden = !['engine','cylinder','timing'].includes(mode);
  $('#phase-overlay').textContent = `${String(selectedCylinder + 1).padStart(2,'0')} · ${STROKES[phase].name.toUpperCase()} ${phase % 2 ? '↑' : '↓'}`;
  $('#phase-overlay').style.color = STROKES[phase].color;
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
