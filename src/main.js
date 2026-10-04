import { cycleVisuals } from './cycle-visuals.js';
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
import { getInspections } from './inspection.js';
import { TRANSMISSIONS, DRIVE_LAYOUTS, evaluateTraction } from './powertrain.js';
import { POWERTRAIN_CONTROLS, VEHICLE_TOOLS, SCENARIO_TOOLS, POWERTRAIN_PARTS } from './powertrain-ui.js';
import { ScenarioPlayer, SCENARIOS } from './scenarios.js';
import { EngineScene } from './scene.js';
import { ENGINES, getEngine } from './engines.js';
import { manualClutchState } from './manual-clutch.js';
import { SUSPENSION_CONTROLS, SUSPENSION_TELEMETRY, SUSPENSION_NOTES, SUSPENSION_PARTS } from './suspension-ui.js';
import { CAR_PRESETS, getCarPreset } from './car-presets.js';
import { applyCarPreset } from './car-configuration.js';
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
let disposed = false;
let readoutMuted = window.matchMedia('(max-width:600px)').matches;
let mechanismReadoutRequested = false;
let selectedPresetId = '';
let manualClutchExplosion = 0.55;

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
  banks: ['Rzędy cylindrów i głowice', 'W silniku widlastym cylindry są pochylone w dwóch rzędach, ale napędzają jeden wał korbowy.'],
  cylinderHead: ['Głowica silnika', 'Głowica zamyka cylindry od góry. Jej dolna powierzchnia tworzy sklepienie komory spalania, a uszczelka oddziela gazy, olej i płyn chłodzący. Niebieskoszary odlew obejmuje wszystkie cylindry danej głowicy. W nim biegną kanały dolotu, wydechu i chłodzenia. Zawory otwierają drogę gazom; krzywki przez dźwigienki wciskają zawory, sprężyny je zamykają. Niebieskie kanały oznaczają dolot, miedziane wydech. W przekroju usunięto przednią ścianę odlewu, aby było widać gniazda, prowadnice i sprężyny.'],
  headGasket: ['Uszczelka pod głowicą', 'Leży między blokiem a głowicą i uszczelnia komorę spalania. Oddziela też kanały oleju i chłodziwa. Pokazany pierścień wokół cylindra ilustruje jej położenie; rzeczywista uszczelka obejmuje całą powierzchnię głowicy.'],
  valveSeat: ['Gniazdo zaworu', 'Zamknięty zawór opiera się o pierścień gniazda, uszczelniając komorę. Krzywka wciska zawór w kierunku tłoka; powstaje szczelina, przez którą płyną gazy. Sprężyna przywraca styk zaworu z gniazdem.'],
  valveGuide: ['Prowadnica zaworu', 'Utrzymuje trzonek zaworu w osi i pozwala mu przesuwać się góra–dół. Nie obraca się z wałkiem rozrządu.'],
  valveSpring: ['Sprężyna zaworu', 'Zamyka zawór po zejściu krzywki z dźwigienki i utrzymuje kontakt części rozrządu. To inna sprężyna niż sprężyna talerzowa sprzęgła.'],
  coolantJacket: ['Kanał chłodzenia głowicy', 'Płyn odbiera ciepło z odlewu wokół komór i kanałów wydechu. Niebieskozielony fragment wskazuje położenie kanału; przepływ i temperatura chłodziwa nie są tu obliczane.'],
  headBolt: ['Śruba głowicy', 'Dociska głowicę do bloku przez uszczelkę. Utrzymuje połączenie szczelne mimo ciśnienia spalania. Model nie jest instrukcją dokręcania.'],
  flywheel: ['Koło zamachowe', 'Jest połączone z wałem silnika. Jego bezwładność wygładza nierównomierność pracy między zapłonami. Płaska powierzchnia styka się z okładziną tarczy sprzęgła; zewnętrzny wieniec służy rozrusznikowi.'],
  friction: ['Tarcza sprzęgła i okładziny', 'Brązowy pierścień to okładzina cierna. Docisk zaciska tarczę pomiędzy sobą a kołem zamachowym. Jej piasta jest osadzona na wieloklinie wału wejściowego skrzyni, więc tarcza obraca się z tym wałem, a nie zawsze z silnikiem.'],
  discHub: ['Piasta i wieloklin', 'Wieloklin przekazuje moment z tarczy sprzęgła do wału wejściowego. Pozwala też tarczy minimalnie przesuwać się osiowo podczas wysprzęglania.'],
  torsionSprings: ['Sprężyny tłumiące w tarczy', 'Sprężyny pomiędzy okładziną a piastą łagodzą pulsacje momentu i szarpnięcia napędu. To inne sprężyny niż sprężyna talerzowa docisku. Ich ugięcia nie są osobno symulowane.'],
  pressurePlate: ['Docisk', 'Obraca się z kołem zamachowym. Sprężyna talerzowa zaciska tarczę cierną. Wciskanie pedału najpierw zmniejsza siłę zacisku, choć powierzchnie nadal się stykają: pod obciążeniem mogą się ślizgać. Dopiero po odciążeniu sprężyste taśmy odsuwają płytę.'],
  diaphragm: ['Sprężyna talerzowa', 'Jej palce są naciskane przez łożysko oporowe. Ugięcie środka zmienia nacisk zewnętrznej części sprężyny na docisk. Ruch został powiększony, aby był widoczny.'],
  releaseBearing: ['Łożysko oporowe i widełki', 'Wciśnięcie pedału przesuwa widełki i łożysko w stronę obracającej się sprężyny talerzowej. Łożysko pozwala przenieść nacisk pomiędzy nieruchomym mechanizmem sterowania a obracającym się dociskiem.'],
  inputShaft: ['Wał wejściowy', 'Jest połączony z tarczą sprzęgła. Niebieskie koła są osadzone na tym wale i obracają się razem z nim. Po wciśnięciu sprzęgła wał nie musi obracać się z prędkością silnika.'],
  outputShaft: ['Wał wyjściowy', 'Przekazuje napęd do przekładni głównej i kół. Na luzie duże koła zębate obracają się swobodnie względem wału. Dopiero przesuwka łączy wybrane koło z wałem.'],
  gearPair: ['Stale zazębiona para kół', 'Koła zębate nie przesuwają się, aby wybrać bieg: pozostają zazębione. Zmienia się połączenie wybranego koła z wałem wyjściowym. Większe koło odbierające daje mniejsze obroty i większy moment. Zęby są uproszczone, a ich liczby zachowują podane przełożenia.'],
  synchronizer: ['Przesuwka i sprzęgło kłowe', 'Złota przesuwka zazębia się z bocznymi zębami wybranego koła i łączy je z wałem wyjściowym. W rzeczywistej skrzyni synchronizator wcześniej wyrównuje obroty; pomarańczowy pierścień pokazuje wyrównywanie obrotów, a przesuwka przesuwa się dopiero potem do położenia zablokowanego. Dla czytelności każdy bieg ma własną przesuwkę.'],
  shiftFork: ['Widełki zmiany biegów', 'Przesuwają tuleję wzdłuż wału, wybierając połączenie koła z wałem wyjściowym. Same widełki nie obracają się razem z tuleją.'],
  bearing: ['Łożyska wałów', 'Podpierają wały, utrzymują odległość między nimi i pozwalają na obrót. Stała odległość osi utrzymuje zazębienie wszystkich par kół.'],

  piston: ['Tłok i korbowód', 'Tłok porusza się wzdłuż osi cylindra, między głowicą a wałem. Korbowód zamienia ten ruch na obrót. R4 i R6 mają jeden rząd, V dwa rozchylone rzędy, VR6 dwa wąskie rzędy pod wspólną głowicą, a W16 cztery rzędy pod dwiema głowicami. W bokserze tłoki pracują poziomo po obu stronach wału.'],
  crank: ['Wał korbowy', 'Odbiera siłę z korbowodów i przekazuje obrót do koła zamachowego. Na pełny cykl czterosuwowy przypadają dwa obroty wału, czyli 720°.'],
  valves: ['Zawory i rozrząd', 'Zawór dolotowy wpuszcza ładunek, wydechowy wypuszcza spaliny. Wałek rozrządu obraca się dwa razy wolniej od wału korbowego. Model pomija wyprzedzenia, opóźnienia i współotwarcie zaworów.'],
  spark: ['Świeca zapłonowa', 'Iskra pojawia się pod koniec sprężania i inicjuje spalanie mieszanki. Ciśnienie rośnie, a gazy wykonują pracę na tłoku. W rzeczywistym silniku wyprzedzenie zapłonu zależy m.in. od obrotów i obciążenia.'],
  block: ['Blok silnika', 'W bloku znajdują się cylindry prowadzące tłoki. Przekrój odsłania wnętrze; wyłącz go, żeby zobaczyć osłonę cylindrów. To schemat edukacyjny, bez pełnego układu chłodzenia. Smarowanie pokazano w osobnym widoku „Olej”.'],
  clutch: ['Sprzęgło cierne', 'Koło zamachowe i docisk obracają się z silnikiem; tarcza przez wielowypust obraca wał wejściowy skrzyni. Wciskanie pedału przez łożysko i palce sprężyny zmniejsza docisk oraz limit przenoszonego momentu. Przy poślizgu powierzchnie nadal się stykają, ale mają różne obroty: tarcie przekazuje moment i wytwarza ciepło. Dopiero brak docisku i szczelina rozłączają napęd. Pedał zwolniony daje pełny docisk; wciśnięty pozwala zmienić bieg. Skok części jest powiększony dla czytelności.'],
  gearbox: ['Manualna skrzynia biegów', 'Na niższym biegu koła obracają się wolniej, ale dostają większy moment. Pary kół są stale zazębione; wybrana para zostaje połączona z wałem wyjściowym. Złoty pierścień oznacza wybrany bieg. Bieg N nie przekazuje napędu na koła.'],
  wheel: ['Napęd kół', 'Za skrzynią działa przekładnia główna 3,9:1, zmniejszająca obroty i zwiększająca moment na kołach. W widoku „Napęd szczegółowy” można obejrzeć przekładnię główną, mechanizm różnicowy i półosie; w zwykłym widoku koło przedstawia wynikowy ruch pojazdu. Model zakłada masę 1250 kg i promień koła 0,31 m.'],
  intake: ['Dolot', 'Niebieski kanał doprowadza powietrze do zaworu dolotowego. Przy wtrysku pośrednim paliwo jest dodawane przed zaworem. Złote drobiny przedstawiają paliwo, niebieskie — powietrze.'],
  exhaust: ['Wydech', 'Spaliny uchodzą przez otwarty zawór wydechowy do kolektora. W silniku z turbo ich energia napędza turbinę połączoną wałkiem ze sprężarką.'],
  injection: ['Miejsce wtrysku', 'MPI: paliwo jest wtryskiwane do kanału przed zaworem dolotowym. Gaźnik: paliwo miesza się z powietrzem w zwężce przed kolektorem. GDI: wtryskiwacz podaje paliwo bezpośrednio do cylindra. Pokazany wtrysk GDI podczas sprężania jest jednym z wariantów; rzeczywiste układy mogą wtryskiwać także podczas ssania i wielokrotnie.'],
  turbo: ['Turbosprężarka', 'Spaliny obracają turbinę (kolor miedziany), a wspólny wałek napędza sprężarkę (kolor niebieski). Sprężarka wtłacza więcej powietrza do silnika. Doładowanie narasta z opóźnieniem; zwiększ gaz i obroty, żeby to zobaczyć. Przekrój pokazuje obudowy spiralne, wirniki, wspólny wałek z łożyskami, smarowanie, zawór wastegate, intercooler i przepustnicę. Powietrze nie miesza się ze spalinami.']
};

const app = document.querySelector('#app');
Object.assign(PARTS, POWERTRAIN_PARTS);
Object.assign(PARTS, SUSPENSION_PARTS);
Object.assign(PARTS, {
  clutchCover: ['Obudowa sprzęgła', 'Obudowa jest przykręcona do koła zamachowego i obraca się z silnikiem. Podpiera sprężynę talerzową oraz przez sprężyste taśmy obraca docisk. W przekroju usunięto część obudowy, aby odsłonić sprężynę. Rozstrzelenie pokazuje kolejność części; nie jest skokiem roboczym sprzęgła.'],
  releaseActuator: ['Współosiowy wysprzęglik hydrauliczny', 'Cylinder jest zamocowany do obudowy skrzyni wokół wału wejściowego. Ciśnienie od pedału wysuwa tłok i przesuwa łożysko wysprzęglające. Łożysko przekazuje nacisk na obracające się palce sprężyny. To jeden z wariantów wysprzęglania; inne sprzęgła używają zewnętrznych widełek.'],
  releaseBearing: ['Łożysko wysprzęglające', 'Przesuwane osiowo łożysko naciska palce sprężyny talerzowej, zmniejszając docisk tarczy. Jedna bieżnia współpracuje z obracającą się sprężyną, druga z nieruchomym wysprzęglikiem. Pozwala to przekazać nacisk bez obracania cylindra hydraulicznego.'],
  gearSelector: ['Wybierak biegów', 'Ruch poprzeczny dźwigni wybiera wodzik, a ruch wzdłużny przesuwa go wraz z widełkami. Widełki obejmują rowek tulei synchronizatora. Tuleja przesuwa się po piaście związanej z wałem; dopiero po synchronizacji zachodzi na zęby kłowe koła. W modelu jeden wodzik obsługuje jeden bieg dla czytelności; w wielu skrzyniach para biegów współdzieli tuleję i widełki.'],
  shiftRail: ['Wodzik', 'Wodzik przesuwa widełki i tuleję wybranego synchronizatora. Ruch wybieraka jest tu przenoszony przez widoczne cięgno. W rzeczywistej skrzyni blokady wodzików chronią przed włączeniem dwóch przełożeń jednocześnie.'],
  dctOdd: ['Gałąź K1 · biegi nieparzyste', 'Pakiet K1 łączy silnik z wewnętrznym wałem wejściowym. Wybrana para kół napędza wał wyjściowy przez tuleję. Biegi 1, 3 i 5 należą do tej gałęzi; pozostałe koła obracają się swobodnie, dopóki tuleja ich nie połączy.'],
  dctEven: ['Gałąź K2 · biegi parzyste', 'Pakiet K2 napędza rurowy wał otaczający wał K1. Obsługuje biegi 2, 4 i 6. Przygotowany bieg ma połączoną tuleję, lecz bez docisku K2 silnik nie przekazuje tej gałęzi momentu.'],
  dctSelector: ['Hydrauliczny wybierak DCT', 'Sterownik uruchamia elektrozawory i reguluje ciśnienie siłowników. Tłok przesuwa wodzik, widełki i tuleję synchronizatora. Dzięki dwóm gałęziom sterownik może przygotować kolejny bieg, zanim zacznie zamykać jego sprzęgło.']
});
app.innerHTML = `
  <header class="app-header">
    <a class="brand" href="./" aria-label="Engine Lab — strona główna"><span class="brand-symbol">${icon('piston')}</span><span>ENGINE<span class="brand-light"> / LAB</span></span></a>
    <span class="header-note">INTERAKTYWNE LABORATORIUM MECHANIKI</span>
    <button class="quiet-button" id="help-button">${icon('info')}<span>Jak to działa</span></button>
  </header>
  <main>
    <div class="page-heading"><div><div class="eyebrow">OD SPALANIA DO RUCHU</div><h1>Silnik benzynowy<span class="title-dot">.</span></h1></div><div class="engine-picker"><div class="engine-buttons" role="group" aria-label="Układ cylindrów">${Object.values(ENGINES).map(engine => `<button data-engine="${engine.id}" class="${engine.id === 'r4' ? 'active' : ''}" aria-pressed="${engine.id === 'r4'}">${engine.name}</button>`).join('')}</div><div class="model-spec"><span id="engine-displacement">2.0 l</span><span id="engine-bank-angle">Rzędowy</span></div></div></div>
    <section class="car-presets" aria-label="Presety samochodów">
      <label>Samochód<select id="car-preset"><option value="">Własna konfiguracja</option>${CAR_PRESETS.map(car => `<option value="${car.id}">${car.name} · ${car.year} · ${car.variant}</option>`).join('')}</select></label>
      <div><strong id="car-preset-summary">Zbuduj własny napęd lub wybierz znany samochód.</strong><p id="car-preset-note">Presety ustawiają architekturę napędu. Parametry i mechanizmy symulacji są dydaktyczne.</p></div>
    </section>
    <section id="mount-settings" class="mount-settings" aria-label="Konfiguracja napędu"><strong>Konfiguracja napędu</strong></section>
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
          <div class="scene-legend"><span><i style="--dot:#68c9ed"></i>Powietrze</span><span><i style="--dot:#ffdc80"></i>Paliwo</span><span><i style="--dot:#c4d0dc"></i>Spaliny</span></div>
          <div class="camera-tools" role="group" aria-label="Sterowanie kamerą"><label class="camera-device">Gesty<select id="camera-input" aria-label="Urządzenie sterujące kamerą" title="Auto rozpoznaje touchpad i kółko. Wybierz urządzenie, jeśli przewijanie reaguje inaczej niż oczekujesz."><option value="auto">Auto</option><option value="touchpad">Touchpad</option><option value="mouse">Mysz</option></select></label><button id="camera-pan" class="icon-button camera-pan" aria-label="Przesuwanie kamery" aria-pressed="false" title="Włącz, aby przeciąganie przesuwało kamerę">${icon('pan')}<span>Przesuwanie</span></button><div class="camera-zoom"><button id="zoom-in" class="icon-button" aria-label="Przybliż">${icon('plus')}</button><button id="zoom-out" class="icon-button" aria-label="Oddal">${icon('minus')}</button><button id="camera-reset" class="icon-button" aria-label="Przywróć kamerę">${icon('focus')}</button></div></div>
          <div class="orbit-hint">${icon('rotate')}<span>Przeciągnij: obrót · 2 palce: przesuwanie · szczypnięcie: zoom</span></div>
          <div id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="quick-controls" aria-label="Sterowanie przy modelu"><label for="quick-throttle">Gaz <output id="quick-throttle-value">0%</output><input id="quick-throttle" type="range" min="0" max="100" value="0"></label><label for="quick-clutch">Sprzęgło <output id="quick-clutch-value">0%</output><input id="quick-clutch" class="blue-range" type="range" min="0" max="100" value="0"></label><label for="quick-gear">Bieg<select id="quick-gear"><option value="0">N</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div>
        <div class="playback"><div class="playback-left"><button id="pause" class="play-button" aria-label="Wstrzymaj symulację">${icon('pause')}</button><button id="next-stroke" class="quiet-button" title="Zatrzymaj i przejdź o jeden suw">Następny suw ${icon('chevron')}</button></div><label id="explode-control" class="explode-control" hidden>Widok rozstrzelony<input id="explode" type="range" min="0" max="100" value="0"><output id="explode-value">0%</output></label><label class="speed-select">Tempo animacji<select id="animation-speed"><option value="0.01">1%</option><option value="0.02" selected>2%</option><option value="0.05">5%</option><option value="0.1">10%</option><option value="1">100%</option></select></label></div>
        <div class="cycle-panel" id="cycle-panel">
          <div class="section-heading"><span>CYKL CZTEROSUWOWY</span><label class="cylinder-select">Cylinder <select id="cylinder-number" aria-label="Numer cylindra"><option value="0">01</option><option value="1">02</option><option value="2">03</option><option value="3">04</option></select></label></div>
          <div class="cylinder-strip"><div id="cylinder-states" role="group" aria-label="Fazy cylindrów"></div><span id="firing-interval">Zapłon co 180°</span></div>
          <div class="stroke-tabs" role="group" aria-label="Wybierz suw i zatrzymaj animację">${STROKES.map((stroke, i) => `<button data-stroke="${i}" style="--stroke:${stroke.color}" aria-pressed="false"><span class="stroke-number">0${i + 1}</span><span>${stroke.name}</span><span class="stroke-direction">${i % 2 ? '↑' : '↓'}</span></button>`).join('')}</div>
          <div class="cycle-track"><input id="cycle-angle" type="range" min="0" max="719" value="30" aria-label="Kąt wału w cyklu, 0 do 719 stopni"><div><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></div></div>
          <div class="cycle-status"><span id="intake-status"></span><span id="exhaust-status"></span><strong id="combustion-status"></strong></div>
          <div class="stroke-description"><span class="stroke-badge" id="stroke-badge">01</span><p id="stroke-description"></p><span class="angle-readout" id="angle-readout">30°</span></div>
          <button id="explain-cycle" class="quiet-button cycle-explain-button">Co oznaczają kolory i gdzie jest dym?</button>
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
        <div class="configuration"><div class="section-heading">KONFIGURACJA SILNIKA</div><p id="engine-summary" class="engine-summary"></p><div class="setting-label">Zasilanie paliwem</div><div class="segmented" role="group" aria-label="Zasilanie paliwem"><button data-injection="mpi" class="active" aria-pressed="true">Pośredni <span>MPI</span></button><button data-injection="gdi" aria-pressed="false">Bezpośredni <span>GDI</span></button><button data-injection="carb" aria-pressed="false">Gaźnik<span>Zwężka</span></button></div><p id="injection-note" class="control-hint">Paliwo trafia do kanału przed zaworem dolotowym.</p><label class="timing-setting">Napęd rozrządu<select id="timing-type"><option value="belt">Pasek zębaty</option><option value="chain">Łańcuch</option></select></label><p id="timing-note" class="control-hint"></p><label class="turbo-setting"><span>Turbodoładowanie<small id="turbo-label">Silnik wolnossący</small></span><input id="turbo" type="checkbox" role="switch"><span class="switch" aria-hidden="true"></span></label><div class="boost-readout" id="boost-row" hidden><span>Ciśnienie doładowania</span><strong id="boost">0,00 bar</strong></div></div>
        <div class="control-footer">${icon('info')}<span>Parametry orientacyjne. Animacja jest spowolniona, wskazania odpowiadają symulacji.</span></div>
      </aside>
    </div>
    <section class="learning-strip"><div class="learning-number">SPRÓBUJ SAM</div><p><strong>Poczuj różnicę między biegami.</strong> Wciśnij sprzęgło, wybierz 1, dodaj gazu i powoli zwalniaj pedał. Przejdź do widoku „Napęd”, żeby zobaczyć, jak moment dociera do koła.</p><button id="try-drive" class="quiet-button">Zobacz napęd ${icon('arrow')}</button></section>
    <footer class="page-footer"><span>ENGINE / LAB <span class="footer-separator">·</span> Model edukacyjny</span><span>Obróć. Przybliż. Zrozum.</span></footer>
  </main>
  <dialog id="cycle-dialog" class="cycle-explainer"><div class="dialog-heading"><h2>Co dzieje się w cylindrze?</h2><button id="close-cycle" class="icon-button" aria-label="Zamknij opis cyklu">×</button></div><p>Niebieskie znaczniki oznaczają powietrze, żółte paliwo. Podczas sprężania ta sama mieszanka zajmuje coraz mniej miejsca — nie zmienia się nagle w inny gaz. Przy GDI paliwo dodajemy dopiero w czasie sprężania.</p><p>Iskra przed górnym martwym punktem rozpoczyna spalanie. Front płomienia rozchodzi się od świecy, a gorące produkty spalania rozprężają się i naciskają na tłok. Płomień gaśnie przed końcem suwu pracy; spaliny pozostają do wydechu.</p><p>Jasnoszare znaczniki to umownie pokazane spaliny, nie dym. Rozgrzany, sprawny silnik benzynowy nie powinien stale kopcić na czarno. Czerń oznacza sadzę z niepełnego spalania; widoczna biała mgiełka przy zimnym wydechu może być skroploną wodą. Barwy i rozmiary cząstek są dydaktyczne, nie przedstawiają wyglądu cząsteczek.</p><p>Model pokazuje idealizowane suwy 0–180–360–540–720°. Rzeczywiste otwieranie zaworów wykracza poza te granice i zależy od silnika, obrotów i zmiennych faz rozrządu.</p><a href="https://www.grc.nasa.gov/www/k-12/airplane/combst1.html" target="_blank" rel="noreferrer">Spalanie — NASA</a> · <a href="https://github.com/Palum12/Engine/blob/main/docs/ENGINE_REFERENCES.md" target="_blank" rel="noreferrer">Źródła i zakres odwzorowania silników</a></dialog>
  <dialog id="help-dialog"><div class="dialog-heading"><h2>Twoje małe laboratorium</h2><button id="close-help" class="icon-button" aria-label="Zamknij instrukcję">×</button></div><p>Przeciąganie obraca model. Dwa palce przesuwane po touchpadzie przesuwają kamerę, a szczypnięcie przybliża tylko model. Na ekranie dotykowym użyj dwóch palców do przesuwania i powiększania. Przycisk Przesuwanie pozwala przesuwać kamerę zwykłym przeciąganiem. Kółko myszy i przyciski + / − przybliżają model. Jeśli Auto myli urządzenie, wybierz Touchpad lub Mysz w polu Gesty. Gesty przechwytujemy tylko nad sceną; poza nią powiększanie strony działa normalnie. Klikaj części, aby poznać ich działanie.</p><ol><li><strong>Odkryj cztery suwy.</strong> Kliknij suw, aby zatrzymać model w jego środku. Suwak kąta pozwala ręcznie przesuwać wał przez pełny cykl.</li><li><strong>Rusz z miejsca.</strong> Wciśnij sprzęgło, wybierz pierwszy bieg, ustaw około 25% gazu i powoli zwalniaj sprzęgło suwakiem.</li><li><strong>Zmień bieg.</strong> Odejmij gaz, wciśnij sprzęgło, wybierz następny bieg i płynnie zwolnij pedał.</li><li><strong>Porównaj konfiguracje.</strong> Zmień MPI na GDI i zobacz położenie wtryskiwacza. Włącz turbo, dodaj gazu i obserwuj narastające doładowanie.</li></ol><p><strong>Skróty:</strong> spacja — pauza, Shift — sprzęgło (przytrzymaj), strzałki góra/dół — gaz, N i 1–5 — bieg. Skróty nie działają podczas edycji pól.</p><p class="dialog-note">To uproszczona symulacja dydaktyczna, a nie model konkretnego samochodu. Pomijamy m.in. szczegółową termodynamikę spalania oraz szczegółową dynamikę tarcia synchronizatora. Etapy zmiany biegów są celowo spowolnione do 2,4 s; obroty wejścia są wyrównywane przed połączeniem. Chłodzenie powietrza, smarowanie turbo oraz sterowanie wastegate są zilustrowane, ale nie obliczane fizycznie. GDI może w rzeczywistości wtryskiwać paliwo w różnych fazach; tutaj pokazano wtrysk przy sprężaniu. Dwuwałkowa skrzynia pokazuje stale zazębione pary, przesuwki i widełki. Używa osobnej przesuwki na bieg, aby ułatwić obserwację. Modele V mają kąt 60° oraz przykładową numerację i kolejność zapłonu. To schematy dydaktyczne, nie rysunki konstrukcyjne. Widok turbo jest osobnym przekrojem.</p></dialog>
`;

const controlsTemplate = document.createElement('template');
controlsTemplate.innerHTML = POWERTRAIN_CONTROLS;
document.querySelector('#mount-settings').append(controlsTemplate.content.querySelector('.powertrain-config'));
document.querySelector('.gear-control').after(controlsTemplate.content.querySelector('.hybrid-controls'), controlsTemplate.content.querySelector('.traction-settings'));
document.querySelector('#scene').insertAdjacentHTML('beforebegin', VEHICLE_TOOLS);
document.querySelector('.playback').insertAdjacentHTML('beforebegin', SCENARIO_TOOLS);
document.querySelector('.view-tabs').insertAdjacentHTML('beforeend', '<button class="view-tab" data-view="transfer" aria-pressed="false">4WD / AWD</button><button class="view-tab" data-view="hybrid" aria-pressed="false">Hybryda / bateria</button><button class="view-tab" data-view="suspension" aria-pressed="false">Zawieszenie / droga</button>');
document.querySelector('.workspace').insertAdjacentHTML('beforeend', SUSPENSION_CONTROLS);
document.querySelector('#cycle-panel').insertAdjacentHTML('afterend', SUSPENSION_TELEMETRY);
document.querySelector('#quick-clutch').closest('label').id = 'quick-clutch-control';
document.querySelector('#clutch').closest('.pedal-control').id = 'clutch-control';
document.querySelector('#quick-gear').closest('label').insertAdjacentHTML('beforebegin', '<button id="quick-brake" class="secondary-button" aria-pressed="false" hidden>Hamulec</button>');
document.querySelector('#inspection-toolbar').insertAdjacentHTML('beforeend', '<div class="lesson-tools" id="dct-lesson" hidden><span id="dct-k1"></span><span id="dct-k2"></span><strong id="dct-state"></strong><button id="dct-shift-step" class="secondary-button">Następny etap</button></div>');
document.querySelector('#inspection-toolbar').insertAdjacentHTML('beforeend', '<div class="lesson-tools" id="automatic-lesson" hidden><span id="automatic-slip"></span><span id="automatic-lockup"></span><strong id="automatic-state"></strong></div>');
document.querySelector('#clutch-lesson').insertAdjacentHTML('beforeend', '<button class="secondary-button" id="clutch-slip-demo">Pokaż ruszanie z poślizgiem</button><small class="mechanics-explanation">Łożysko wciska palce sprężyny już przy częściowym wciśnięciu pedału. Spada docisk, choć tarcze nadal się stykają. Dopiero po odciążeniu powstaje szczelina. Poślizg oznacza różne obroty, a jego energia zamienia się w ciepło.</small>');
document.querySelector('#assemble-clutch').insertAdjacentHTML('beforebegin', '<button class="secondary-button" id="spread-clutch">Pokaż warstwy</button>');
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
  let [title, description] = PARTS[part] || PARTS.block;
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
  const detailLesson = mode === 'gearbox' && sim.transmission === 'manual' && ['selector', 'synchronizer'].includes($('#inspect-section').value);
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
  $('#show-head').hidden = !['engine', 'timing', 'drive', 'drive-detail'].includes(mode);
  $('#spread-clutch').hidden = !['clutch'].includes(mode);
  $('#clutch-lesson').hidden = view !== 'clutch' || sim.transmission !== 'manual';
  $('#gear-lesson').hidden = view !== 'gearbox' || sim.transmission !== 'manual';
  $('#dct-lesson').hidden = sim.transmission !== 'dct' || !['clutch', 'gearbox'].includes(view);
  $('#automatic-lesson').hidden = sim.transmission !== 'automatic' || !['clutch', 'converter', 'gearbox', 'planetary', 'automaticClutches', 'valveBody', 'pump', 'turbine', 'stator', 'lockup'].includes(view);
  $('#diff-lesson').hidden = !['differential','finalDrive','frontAxle','rearAxle'].includes(view);
  $('#diff-demo').hidden = !['differential','finalDrive','frontAxle','rearAxle'].includes(view);
}
function updateLessonState() {
  const clutchState = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
  const separated = !clutchState.contact;
  const slipping = !separated && sim.clutchSlip > 60;
  $('#contact-state').textContent = separated ? 'ROZŁĄCZONE · brak docisku' : slipping ? 'STYK Z POŚLIZGIEM · obroty się różnią' : 'POŁĄCZONE · tarcza napędza wejście';
  const torque = Math.min(Math.abs(sim.transmittedTorque), clutchState.capacity);
  const slipRpm = Math.abs(sim.rpm - sim.inputOmega * 30 / Math.PI);
  const heat = torque * slipRpm * Math.PI / 30;
  $('#contact-detail').textContent = `Docisk ${Math.round(clutchState.clampFactor * 100)}% · limit ${Math.round(clutchState.capacity)} Nm · przenoszone ${Math.round(torque)} Nm · poślizg ${Math.round(slipRpm)} obr./min · ciepło ${(heat / 1000).toFixed(2)} kW${scene?.drive.exploded > 0 ? ' · odstępy rozstrzelone są umowne' : ''}`;
  const release = clutchState.release;
  $('#diagram-disc').setAttribute('x',90 + release * 25);
  $('#diagram-pressure').setAttribute('x',102 + release * 65);
  $('#diagram-pressure').style.opacity = 0.35 + clutchState.clampFactor * 0.65;
  $('#diagram-torque').style.opacity = clutchState.clampFactor;
  const stage = sim.shiftStage;
  const inspectedGear = /^gear([1-5])$/.exec($('#inspect-section').value);
  const synchroView = $('#inspect-section').value === 'synchronizer';
  const selected = sim.shiftTarget || Number(inspectedGear?.[1] || (synchroView ? $('#synchronizer-gear').value : 0)) || sim.gear;
  const focusedFreeGear = Boolean((inspectedGear || synchroView) && selected !== sim.gear && sim.shiftTarget === null);
  $$('[data-shift-stage]').forEach(element => element.classList.toggle('active', element.dataset.shiftStage === stage && !focusedFreeGear && (sim.shiftTarget !== null || sim.gear > 0)));
  $('#shift-step').disabled = sim.shiftTarget === null;
  $('#synchronizer-gear').disabled = sim.shiftTarget !== null;
  const output = sim.outputOmega * 30 / Math.PI;
  const free = selected ? sim.inputOmega / sim.ratios[selected] * 30 / Math.PI : 0;
  $('#shift-detail').textContent = sim.shiftTarget !== null ? `${sim.shiftFrom || 'N'} → ${sim.shiftTarget || 'N'} · ${stage === 'release' ? 'Tuleja opuszcza zęby poprzedniego biegu.' : stage === 'synchronize' ? 'Pierścień trze o stożek, wyrównując obroty.' : 'Tuleja zachodzi na zęby kłowe koła.'} Koło ${Math.round(free)} / wał ${Math.round(output)} obr./min.` : focusedFreeGear ? `Koło biegu ${selected} obraca się swobodnie na łożysku: ${Math.round(free)} obr./min. Piasta i wał: ${Math.round(output)} obr./min. Tuleja nie łączy tego koła z wałem. ${sim.gear ? `Bieg ${sim.gear} jest włączony w innej parze.` : 'Skrzynia jest na luzie.'}` : sim.gear ? `Bieg ${sim.gear}: tuleja łączy zęby kłowe koła z piastą wału. Koło i wał ${Math.round(output)} obr./min. Pozostałe koła obracają się na łożyskach.` : 'Luz: koła obracają się na łożyskach, a piasty są związane z wałem. Zazębienie pary nie wystarcza: dopiero tuleja łączy koło z wałem.';
  const diff = inspectedDifferential();
  $('#diff-left').textContent = `${(diff?.leftSpeed || 0).toFixed(1)}`;
  $('#diff-carrier').textContent = `${(diff?.carrierSpeed || 0).toFixed(1)}`;
  $('#diff-right').textContent = `${(diff?.rightSpeed || 0).toFixed(1)}`;
  $('#diff-demo').textContent = diff?.demo ? 'Zakończ pokaz stołowy' : 'Uruchom pokaz stołowy';
  $('#diff-demo').setAttribute('aria-pressed', Boolean(diff?.demo));
  $$('[data-turn]').forEach(button => { const active = Number(button.dataset.turn) === sim.turn; button.classList.toggle('active',active); button.setAttribute('aria-pressed',active); });
  const front = mode === 'differential' ? sim.driveLayout === 'fwd' : diff === scene?.vehicle.front;
  const locked = front ? sim.frontLock : sim.rearLock;
  $('#diff-detail').textContent = `${diff?.demo ? 'Pokaz stołowy · umowne obroty, niezależne od jazdy auta.' : 'Otwarty dyferencjał działa mechanicznie: nie steruje nim komputer. Opory kół i długość toru wyznaczają różnicę obrotów.'} ${locked ? 'Blokada łączy półosie: wymusza wspólne obroty.' : sim.turn === 0 ? 'Na wprost: satelity krążą z koszem, bez obrotu na własnych osiach.' : 'W zakręcie satelity obracają się także na swoich osiach: jedna półoś zwalnia, druga przyspiesza.'} (L + P) / 2 = kosz · obr./min.`;
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
$('#try-drive').addEventListener('click', () => { changeView('drive'); $('.visual-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
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
  scene?.setView(mode, true);
  updateSuspensionUI();
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
}
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

let lastStroke = -1;
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
  $('.view-tab[data-view="gearbox"]').textContent = sim.transmission === 'hybrid' ? 'e-CVT' : 'Skrzynia biegów';
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

function updatePowertrainMetrics() {
  for (const name of ['throttle', 'clutch']) {
    const value = Math.round(sim[name] * 100);
    $(`#${name}`).value = $(`#quick-${name}`).value = value;
    $(`#${name}-value`).innerHTML = `${value}<span>%</span>`;
    $(`#quick-${name}-value`).textContent = `${value}%`;
    $(`#${name}`).style.setProperty('--fill', `${value}%`);
    $(`#quick-${name}`).style.setProperty('--fill', `${value}%`);
  }
  $('#vehicle-turn').value = sim.turn * 100;
  $('#quick-brake').setAttribute('aria-pressed', Boolean(sim.brake));
  $('#brake').setAttribute('aria-pressed', Boolean(sim.brake));
  $('#pause').innerHTML = icon(sim.paused ? 'play' : 'pause');
  $('#pause').setAttribute('aria-label', sim.paused ? 'Wznów symulację' : 'Wstrzymaj symulację');
  $('#clutch-toggle').setAttribute('aria-pressed', sim.clutch >= 0.85);
  $('#clutch-toggle').innerHTML = `${sim.clutch >= 0.85 ? 'Zwolnij pedał' : 'Wciśnij pedał'} <kbd>Shift</kbd>`;
  $('#scenario-play').textContent = player.id && !sim.paused ? 'Wstrzymaj' : 'Odtwórz';
  $('#scenario-next').disabled = !player.id || player.index >= player.steps.length - 1;
  $('#scenario-description').textContent = player.id ? `${player.index + 1}/${player.steps.length} · ${player.step.text}` : 'Wybierz doświadczenie. Możesz odtworzyć animację lub przechodzić krokami.';
  sim.traction.wheels.forEach((wheel, i) => {
    $(`#wheel-rpm-${i}`).textContent = `${Math.round(wheel.rpm)} obr./min`;
    $(`#wheel-torque-${i}`).textContent = `${Math.round(wheel.torque)} Nm${wheel.slip > 1 ? ' · poślizg' : ''}${wheel.driven ? '' : ' · toczy się'}`;
  });
  $('#traction-note').textContent = sim.traction.binding ? 'Sztywne połączenie osi + zakręt na asfalcie: wymagane drogi osi różnią się. Pojawia się wymuszony poślizg opon i naprężenie napędu.' : sim.traction.slip ? 'Przyczepność ogranicza moment docierający do podłoża. Porównaj otwarty dyferencjał z blokadą i obserwuj poślizg słabszego koła.' : 'Model przyczepności jest quasi-statyczny. W otwartym dyferencjale moment obu półosi jest równy; obroty mogą być różne.';
  $('#dct-k1').textContent = `K1 · bieg ${sim.dct.selected[0]} · docisk ${Math.round(sim.dct.engagement[0] * 100)}% · ${Math.round(sim.dct.torques[0])} Nm`;
  $('#dct-k2').textContent = `K2 · bieg ${sim.dct.selected[1]} · docisk ${Math.round(sim.dct.engagement[1] * 100)}% · ${Math.round(sim.dct.torques[1])} Nm`;
  $('#dct-state').textContent = sim.shiftTarget !== null ? `${sim.shiftFrom || 'N'} → ${sim.shiftTarget || 'N'} · ${sim.shiftStage === 'preselect' ? 'wybór biegu' : sim.shiftStage === 'handover' ? 'przejmowanie momentu z poślizgiem' : 'ustalenie docisku'}` : sim.gear ? `Aktywny ${sim.gear} · przygotowany ${sim.dct.prepared}` : 'N · brak napędu';
  $('#dct-shift-step').disabled = sim.shiftTarget === null;
  $('#automatic-slip').textContent = `Poślizg · ${Math.round(sim.automatic.slipRpm)} obr./min`;
  $('#automatic-lockup').textContent = `Lock-up · ${Math.round(sim.automatic.lockup * 100)}%`;
  $('#automatic-state').textContent = sim.gear ? `Bieg ${sim.gear} · moment turbiny ${Math.round(sim.automatic.turbineTorque)} Nm` : 'N · brak napędu kół';
  const h = sim.hybrid;
  const kw = power => `${(power / 1000).toFixed(1).replace('.', ',')} kW`;
  $('#hybrid-state').textContent = h.state;
  if (document.activeElement !== $('#battery-soc')) $('#battery-soc').value = h.soc * 100;
  $('#battery-soc-value').textContent = `${Math.round(h.soc * 100)}%`;
  $('#battery-current').textContent = `${Math.abs(h.batteryCurrent).toFixed(1).replace('.', ',')} A ${h.batteryPower > 50 ? '→ falownik' : h.batteryPower < -50 ? '→ bateria' : '· spoczynek'}`;
  $('#battery-power').textContent = `${kw(Math.abs(h.batteryPower))} ${h.batteryPower > 50 ? 'oddaje' : h.batteryPower < -50 ? 'przyjmuje' : ''}`;
  $('#battery-energy').textContent = `${(h.soc * h.capacityKwh).toFixed(2).replace('.', ',')} kWh`;
  $('#energy-battery-label').textContent = `Bateria ${Math.round(h.soc * 100)}%`;
  $('#energy-mg1-value').textContent = kw(h.generatorPower);
  $('#energy-mg2-value').textContent = kw(h.motorPower);
  $('#energy-battery-value').textContent = kw(h.batteryPower);
  $('#mg1-rpm').textContent = `${Math.round(h.mg1Omega * 30 / Math.PI)} obr./min`;
  $('#mg2-rpm').textContent = `${Math.round(h.mg2Omega * 30 / Math.PI)} obr./min`;
  $('#hybrid-engine-rpm').textContent = `${Math.round(sim.rpm)} obr./min`;
  $('#hybrid-balance').textContent = `Bilans: silnik ${kw(h.enginePower)} + bateria ${kw(h.batteryPower)} = wyjście ${kw(h.mechanicalPower + h.motorPower)} + straty ${kw(h.lossPower)}${h.startPower > 0 ? ` + rozruch ${kw(h.startPower)}` : ''}.`;
  const powers = { engine: h.enginePower - (h.startPower || 0), mechanical: h.mechanicalPower, generation: h.generatorMechanical, mg1: h.generatorPower, mg2: h.motorDcPower, wheel: h.motorPower, battery: h.batteryPower };
  Object.entries(powers).forEach(([id, power]) => {
    const line = $(`#energy-${id}`);
    const active = Math.abs(power) > 50;
    line.dataset.active = String(active);
    line.dataset.direction = power < 0 ? 'reverse' : 'forward';
    line.setAttribute('marker-end', active && power > 0 ? 'url(#energy-arrow)' : 'none');
    line.setAttribute('marker-start', active && power < 0 ? 'url(#energy-arrow)' : 'none');
    line.style.strokeWidth = active ? String(2 + Math.min(3, Math.abs(power) / 10000)) : '1.3';
  });
  $('.energy-map').classList.toggle('paused', sim.paused);
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

function updateSuspensionUI() {
  const state = sim.suspension;
  $('#suspension-type').value = state.type;
  $('#suspension-road').value = state.road;
  $('#suspension-type-note').textContent = SUSPENSION_NOTES[state.type];
  for (const [name, value, label] of [
    ['speed', state.speed, `${Math.round(state.speed)} km/h`],
    ['amplitude', state.amplitude * 100, `${Math.round(state.amplitude * 100)} cm`],
    ['spring', state.spring * 100, `${Math.round(state.spring * 100)}%`],
    ['damping', state.damping * 100, `${Math.round(state.damping * 100)}%`]
  ]) {
    if (document.activeElement !== $(`#suspension-${name}`)) $(`#suspension-${name}`).value = value;
    $(`#suspension-${name}-value`).textContent = label;
  }
  $('#suspension-tempo').value = sim.suspensionTempo;
  $('#suspension-body-state').textContent = `Przejechane ${state.distance.toFixed(1)} m · przechył ${(state.roll * 180 / Math.PI).toFixed(1)}°`;
  state.wheels.forEach((wheel, index) => {
    const prefix = `#suspension-${index ? 'right' : 'left'}-`;
    $(prefix + 'road').textContent = `${(wheel.roadHeight * 100).toFixed(1)} cm`;
    $(prefix + 'travel').textContent = `${(wheel.travel * 100).toFixed(1)} cm`;
    $(prefix + 'spring').textContent = `${Math.round(wheel.springForce)} N`;
    $(prefix + 'damper').textContent = `${Math.round(wheel.damperForce)} N`;
    $(prefix + 'contact').textContent = wheel.contact ? 'Styk' : 'Oderwane';
  });
}
function updateUI() {
  if (mode === 'suspension') updateSuspensionUI();
  const manualClutch = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
  $('#rpm').textContent = fmt.format(Math.round(sim.rpm / 10) * 10);
  $('#rpm-bar').style.width = `${Math.min(100, sim.rpm / 6500 * 100)}%`;
  $('#speed').textContent = Math.round(sim.speed * 3.6);
  $('#torque').textContent = Math.round(sim.torque);
  $('#boost').textContent = `${sim.boost.toFixed(2).replace('.', ',')} bar`;
  const status = sim.paused ? 'SYMULACJA WSTRZYMANA' : sim.transmission === 'hybrid' && sim.hybridEnabled && !sim.running ? 'GOTOWY · NAPĘD ELEKTRYCZNY' : sim.running ? 'SILNIK PRACUJE' : sim.stalled ? 'SILNIK ZGASŁ' : 'SILNIK WYŁĄCZONY';
  $('#engine-status').textContent = mode === 'suspension' ? sim.paused ? 'POKAZ ZATRZYMANY' : 'PRZEJAZD PO NAWIERZCHNI' : status;
  $('#engine-status').classList.toggle('inactive', sim.paused || mode !== 'suspension' && !sim.running);
  $('#ignition span').textContent = sim.transmission === 'hybrid' ? sim.hybridEnabled ? 'Wyłącz hybrydę' : 'Włącz hybrydę' : sim.running ? 'Wyłącz silnik' : 'Uruchom silnik';
  $('#quick-gear').value = sim.transmission === 'hybrid' ? sim.hybrid.range : sim.shiftTarget ?? sim.gear;
  $('#ratio-label').textContent = sim.gear ? `${sim.ratios[sim.gear].toFixed(2).replace('.', ',')} : 1` : 'Luz';
  $$('[data-gear]').forEach(button => {
    const active = Number(button.dataset.gear) === (sim.shiftTarget ?? sim.gear);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  $('#drive-status').textContent = sim.transmission === 'automatic' ? sim.shiftTarget !== null ? 'Zmiana automatu: hydraulika przełącza pakiety, konwerter pracuje z poślizgiem.' : sim.gear ? `Bieg ${sim.gear} · ${sim.automatic.lockup > 0.8 ? 'lock-up połączony' : 'napęd przez olej konwertera'}. Bez gazu możliwe pełzanie; użyj hamulca.` : 'N: konwerter obraca się, przekładnia nie napędza kół.' : sim.transmission === 'dct' ? sim.shiftTarget !== null ? 'Zmiana DCT: sterownik reguluje docisk i poślizg K1 / K2.' : sim.gear ? `Bieg ${sim.gear} aktywny; ${sim.dct.prepared} przygotowany na odłączonej gałęzi.` : 'N: oba sprzęgła nie przenoszą napędu.' : sim.shiftTarget !== null ? 'Zmiana biegu trwa. Obserwuj pierścień i przesuwkę; trzymaj pedał wciśnięty.' : sim.stalled ? 'Silnik zgasł. Wciśnij sprzęgło i uruchom go ponownie.' : sim.gear === 0 ? 'Luz: silnik nie napędza kół.' : !manualClutch.contact ? 'Sprzęgło rozłączone: silnik nie napędza kół.' : sim.clutchSlip > 60 ? 'Poślizg sprzęgła: tarcza i koło zamachowe obracają się z różną prędkością.' : 'Sprzęgło przenosi moment do kół.';
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
  $('#mechanism-output-rpm').textContent = `${Math.round(sim.outputOmega * 30 / Math.PI)} obr./min`;
  $('#mechanism-state').textContent = !manualClutch.contact ? 'Sprzęgło rozłączone · brak docisku' : sim.clutchSlip > 60 ? 'Powierzchnie w kontakcie · poślizg' : sim.clutch > 0.02 ? 'Mniejszy docisk · obroty wyrównane' : 'Pedał zwolniony · pełny docisk';
  $('#mechanism-detail').textContent = sim.shiftTarget !== null ? 'Trwa zmiana biegu: śledź etapy w pasku nad modelem.' : mode === 'clutch' ? `Poślizg: ${Math.round(sim.clutchSlip)} obr./min. Wciśnij pedał i obserwuj łożysko, sprężynę oraz docisk.` : sim.gear ? `Bieg ${sim.gear}: wejście obraca się ${sim.ratios[sim.gear].toFixed(2).replace('.', ',')} raza na obrót wyjścia. Strzałki pokazują drogę momentu.` : 'Luz: koła zębate obracają się swobodnie. Żadna para nie jest połączona z wałem wyjściowym.';
  if (sim.transmission === 'dct') {
    $('#mechanism-state').textContent = sim.shiftTarget !== null ? `DCT · ${sim.shiftStage === 'preselect' ? 'wybór biegu' : sim.shiftStage === 'handover' ? 'przejmowanie napędu' : 'ustalenie docisku'}` : sim.gear ? `K${sim.dct.active + 1} napędza bieg ${sim.gear}` : 'DCT · N · oba pakiety odłączone';
    const dctExplanation = sim.shiftTarget === null
      ? sim.gear ? `Przygotowany bieg ${sim.dct.prepared} ma otwarte sprzęgło.` : 'Oba pakiety są otwarte.'
      : sim.shiftTarget === 0 ? 'Sterownik otwiera pakiety, odłączając napęd na luzie.'
      : sim.shiftStage === 'preselect' ? 'Wybierak ustawia nowy bieg; sterownik reguluje docisk pakietów.'
      : sim.shiftStage === 'lock' ? 'Sterownik ustala docisk sprzęgła nowego biegu.'
      : !sim.shiftFrom ? 'Sprzęgło nowego biegu przejmuje napęd z poślizgiem.'
      : sim.shiftFrom % 2 === sim.shiftTarget % 2 ? 'Sterownik otwiera i ponownie dociska sprzęgło tej samej gałęzi.'
      : 'Oba pakiety przejmują napęd z poślizgiem.';
    $('#mechanism-detail').textContent = `K1: ${Math.round(sim.dct.torques[0])} Nm · K2: ${Math.round(sim.dct.torques[1])} Nm. ${dctExplanation}`;
  }
  if (sim.transmission === 'automatic') {
    $('#mechanism-state').textContent = sim.shiftTarget !== null ? '8AT · zmiana przełożenia planetarnego' : sim.gear ? `8AT · bieg ${sim.gear} · ${sim.automatic.lockup > 0.8 ? 'lock-up' : 'konwerter z poślizgiem'}` : '8AT · N · wyjście odłączone';
    $('#mechanism-detail').textContent = `Poślizg: ${Math.round(sim.automatic.slipRpm)} obr./min · mnożnik momentu ${sim.automatic.torqueRatio.toFixed(2)} · straty ${(sim.automatic.lossPower / 1000).toFixed(1)} kW. Kierownica: ${sim.automatic.statorLocked ? 'podparta' : 'swobodna'}.`;
  }
  const phase = strokeIndex(sim.angle, selectedCylinder, sim.engineId);
  const visual = cycleVisuals(cycleDegrees(sim.angle, selectedCylinder, sim.engineId));
  $('#intake-status').textContent = `Dolot: ${visual.intake > 0.02 ? 'otwarty' : 'zamknięty'}`;
  $('#exhaust-status').textContent = `Wydech: ${visual.exhaust > 0.02 ? 'otwarty' : 'zamknięty'}`;
  $('#combustion-status').textContent = !sim.running ? 'Brak spalania' : visual.spark > 0.1 ? 'Iskra → zapłon' : visual.flame > 0.02 ? 'Front płomienia → spalanie' : phase === 2 ? 'Gorące gazy → rozprężanie' : phase === 3 ? 'Usuwanie spalin' : phase === 1 ? 'Ładunek → mniejsza objętość' : 'Napełnianie cylindra';
  if (phase !== lastStroke) {
    lastStroke = phase;
    $$('[data-stroke]').forEach(button => {
      const active = Number(button.dataset.stroke) === phase;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    $('#stroke-description').textContent = phase === 1 && sim.injection !== 'gdi' ? 'Tłok zbliża się do głowicy, a zawory dolotowe i wydechowe są zamknięte. Mieszanka powietrza z paliwem zostaje sprężona. Pod koniec tego suwu świeca inicjuje spalanie.' : STROKES[phase].description;
    $('#stroke-badge').textContent = `0${phase + 1}`;
    $('#stroke-badge').style.color = STROKES[phase].color;
  }
  updateLessonState();
  updatePowertrainMetrics();
  $('#phase-overlay').hidden = !['engine','cylinder','timing'].includes(mode);
  $('#phase-overlay').textContent = `${String(selectedCylinder + 1).padStart(2,'0')} · ${STROKES[phase].name.toUpperCase()} ${phase % 2 ? '↑' : '↓'}`;
  $('#phase-overlay').style.color = STROKES[phase].color;
  const degrees = Math.round(cycleDegrees(sim.angle, selectedCylinder, sim.engineId));
  if (document.activeElement !== $('#cycle-angle')) $('#cycle-angle').value = Math.min(719, degrees);
  $('#angle-readout').textContent = `${degrees}°`;
}

updateEngineUI();
updatePowertrainConfiguration();
setPedal('throttle', 0);
setPedal('clutch', 0);
updateUI();
changeView('drive-detail');
let previousTime = performance.now();
let uiTime = 0;
function animate(time) {
  if (disposed) return;
  const dt = Math.max(0, Math.min((time - previousTime) / 1000, 0.1));
  previousTime = time;
  if (!document.hidden) {
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
    scene?.render(sim, dt);
    uiTime += dt;
    if (uiTime >= 0.08) { updateUI(); uiTime = 0; }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; scene?.dispose(); });
