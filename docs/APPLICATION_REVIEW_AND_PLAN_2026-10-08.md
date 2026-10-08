# Przegląd aplikacji i plan poprawek — 08.10.2026

Audyt lokalnego stanu `7541c72` (`main`). Zakres: organizacja aplikacji, fizyka,
modele Three.js, renderowanie, zasoby grafiki, interfejs, lekcje, CSS, budowanie
i weryfikacja. Wynikiem jest plan wdrożenia. Źródła aplikacji pozostały bez zmian.

Powyższe dotyczy stanu z chwili audytu. Wdrożenie optymalizacji i podziału UI
opisuje osobny [raport weryfikacji](PERFORMANCE_REFACTOR_QA.md).

## Wnioski

Aplikacja ma dobry fundament: osobny stan `Simulation`, proceduralne modele,
wspólną obsługę geometrii i materiałów, testy fizyki, połączeń oraz rzeczywistego
interfejsu. Wcześniejsze ograniczenie aktualizacji ukrytych zespołów i pracy
etykiet już działa. Największy sens mają teraz dalsze, mierzalne ograniczenia
zbędnej pracy oraz uporządkowanie cyklu życia zasobów.

Najpilniejsze obszary:

1. Jawne zwalnianie buforów `InstancedMesh` przy wymianie modeli.
2. Wygaszenie renderowania i aktualizacji odczytów przy nieruchomej pauzie.
3. Aktualizowanie wyłącznie potrzebnych cylindrów, cząsteczek i podzespołów.
4. Ograniczenie liczby wywołań rysowania i dodanie trybu oszczędnego.
5. Podział `main.js` oraz wspólna obsługa zmian konfiguracji i widoków.

Pierwsze cztery punkty mogą bezpośrednio pomóc na laptopie. Sam podział plików
poprawi utrzymanie kodu, ale nie jest dowodem przyspieszenia aplikacji.

## Weryfikacja i wiarygodność pomiarów

- `npm test`: **230/230** zakończonych powodzeniem.
- `npm run build`: powodzenie; JS aplikacji 399,12 kB / 124,50 kB gzip,
  wspólny pakiet Three.js 568,23 kB / 144,56 kB gzip, CSS 82,94 kB / 15,56 kB gzip.
- Pomiary przeglądarki objęły wszystkie osiem widoków, pauzę, różny detal i DPR,
  a także silnik W16. Osobna próba przełączała cztery presety przez pięć rund
  w każdym z dwóch wariantów zarządzania zasobami.
- Testy przeglądarkowe nawigacji, wszystkich zakładek, presetów/inspekcji 8AT
  i telefonu: **4/4**, 9,3 min. Wybrany zestaw kontrolny, obejmujący także
  tablet i fullscreen; nie jest to pełny zestaw scenariuszy mechanicznych.
- Obejrzano aktualne obrazy pojazdu W16, silnika, sprzęgieł DCT i zawieszenia
  oraz obrazy nawigacji telefonu, zawieszenia na pełnym ekranie telefonu,
  pojazdu 911 na telefonie i skrzyni automatycznej 8AT.

Chromium 153.0.8010.12 korzystał z programowego WebGL SwiftShader. Próbki
3,5-sekundowe zawierają od 2 do 20 klatek, a instrumentacja dodaje własny koszt.
Z tego powodu czasy i FPS z tych prób nie są podstawą obietnicy wydajności na
laptopie użytkownika. Liczniki rysowania, wykonanych operacji i jawnych usunięć
zasobów pokazują konkretne miejsca do poprawy. Profile CPU przeglądarki są
materiałem pomocniczym; mają zbyt mało próbek kodu aplikacji do rankingu funkcji.

Osobny pomiar modeli w Node przebiegł po zamknięciu przeglądarki: 300 aktualizacji
rozgrzewki i 600 mierzonych aktualizacji na przypadek. Obejmuje pracę CPU modelu,
bez DOM i GPU; powtarzalne liczniki operacji mają większą wagę niż pojedynczy czas.
Podczas pomiarów przeglądarki nie zmieniano jej źródeł ani nie uruchamiano testów
i budowania równolegle.

Dowody lokalne, ignorowane przez Git:

- `artifacts/app-review-oct8/metrics.json`, profile `*.cpuprofile`, obrazy `*.png`.
- `artifacts/app-review-oct8/resources.json` — cykle wymiany modeli.
- `artifacts/app-review-oct8/model-cost.json` — koszt i liczniki aktualizacji.
- `artifacts/review-oct8-{tests,build,browser,profile,model-cost}.log`.
- Skrypty odtwarzające: `.cache/app-review-oct8/profile.mjs` oraz
  `.cache/app-review-oct8/model-cost.mjs`. Pierwszy wymaga lokalnego serwera
  na porcie 5173 i pobranego Chromium; drugi uruchamia się bez serwera.

## Potwierdzone problemy i plan

### P1. Zasoby instancji nie są jawnie zwalniane

**Miejsce:** `src/models/geometry.js:128`, `:143`, `:168`,
`src/scene.js:155`, `src/models/systems-model.js:98`.

`ModelGeometry.dispose()` usuwa geometrie i własne materiały, ale nie wywołuje
`dispose()` obiektów `InstancedMesh`. Te obiekty mają osobne bufory macierzy
i kolorów. Lokalny kod Three.js w `WebGLObjects.onInstancedMeshDispose` usuwa
te bufory właśnie podczas zdarzenia `dispose` instancji. Pomiar R4 potwierdził
16 obiektów instancjonowanych i zero takich zdarzeń przy usunięciu silnika.

W próbie wymiany Veyron → Corolla → 508 → Ibiza bilans wywołań
`createBuffer - deleteBuffer` w końcowych trzech rundach wyniósł
**1156 → 1227 → 1298**, czyli +71 na rundę. W osobnej sesji z diagnostycznym
zwalnianiem instancji w przeglądarce wyniósł **966 → 966 → 966**. Liczba węzłów
DOM była stała, a licznik geometrii stabilizował się w obu sesjach.

To dowód brakującego deterministycznego sprzątania, nie pomiar zajętych bajtów
VRAM ani dowód nieodwracalnego wycieku: automatyczne sprzątanie WebGL może
działać niezależnie od przechwyconych wywołań `deleteBuffer`. Sam stabilny
`renderer.info.memory.geometries` nie wystarcza jednak do odbioru tej poprawki.

**Zmiana:** rejestrować należące do modelu instancje, także tworzone bezpośrednio
w SystemsModel i TransferModel. Usuwać je przed geometriami i materiałami.
Własność musi być jawna, ponieważ pojazd przejmuje grupy innych modeli;
przejście całego drzewa pojazdu nie może zwalniać cudzych zasobów drugi raz.

**Odbiór:** test zdarzeń dispose rzeczywistych modeli, 20–50 cykli konfiguracji,
stabilny bilans buforów po rozgrzewce oraz poprawny powrót do wszystkich widoków.

### P1. Pauza nadal stale renderuje scenę i aktualizuje interfejs

**Miejsce:** `src/main.js:1165`, `src/scene.js:494`.

`sim.paused` zatrzymuje fizykę, lecz każda widoczna klatka nadal wykonuje render
i obsługę etykiet. Po przekroczeniu 80 ms aktualizuje również odczyty. Obsługa
`document.hidden` już istnieje i działa dla ukrytej karty.

**Zmiana:** rozdzielić potrzebę kroku fizyki, aktualizacji modelu, aktualizacji
odczytów oraz rysowania. Zatrzymać pracę po ustabilizowaniu kamery i obrazu.
Wznowienie wywołują wejście użytkownika, resize, fonty, zmiana konfiguracji,
krok lekcji i zmiana widoczności strony. Damping OrbitControls oraz przejścia
kamery/kąta muszą dobiegać końca również przy pauzie. Doświadczenia różnicowe
i animowane przepływy także muszą zgłaszać potrzebę kolejnej klatki.

**Odbiór:** po ustabilizowaniu pauzy brak kolejnych renderów i aktualizacji
odczytów; każdy suwak, kamera, opis, przekrój i krok lekcji odświeża obraz.
Przy widocznym silniku wyłączonym rysować tylko wtedy, gdy coś rzeczywiście
się zmienia; samo `running === false` nie oznacza końca ruchu pojazdu.

### P1. Aktualizacja silnika nie uwzględnia ukrytych cylindrów i efektów

**Miejsce:** `src/models/engine-model.js:226`, `:262`, `:337`.

Każdy cylinder oblicza 148 macierzy cząsteczek. R4 wykonuje **592 zapisy
instancji i 646 kompozycji macierzy** na aktualizację; W16 odpowiednio
**2368 i 2443**. Liczniki były takie same dla całego silnika, pojedynczego
cylindra, izolowanej głowicy oraz wyłączonego silnika. Mediany CPU wyniosły
około 0,33 ms dla R4 i 1,35 ms dla W16 w pomiarze Node.

Na końcu `EngineModel.update()` pełny przebieg macierzy obejmuje również
ukryte części. Następnie scena wykonuje swój przebieg widocznych macierzy.
Wywołania `localToWorld/worldToLocal` dźwigienek dokładają pracę przodków.

**Zmiana:** oddzielić mechanikę cylindra od cząsteczek i elementów głowicy.
Aktualizować to, co jest potrzebne w bieżącym widoku, uwzględniając widocznych
przodków, izolację i poziom detalu. Po ponownym pokazaniu wykonać pełną
synchronizację ze stanem symulacji. Używać ponownie wektorów, kolorów i macierzy.
Przygotować zależne macierze dźwigienek w jednym uporządkowanym przebiegu,
zachowując możliwość samodzielnego użycia modelu w testach.

**Odbiór:** pojedynczy cylinder W16 przelicza cząsteczki jednego cylindra;
izolowana głowica i wyłączone efekty nie aktualizują ich buforów. Testy
transformacji, powrotu widoczności, rozrządu i głowicy nadal przechodzą.

### P1. Ukryte panele generują większość zapisów DOM

**Miejsce:** `src/main.js:922`, `:1076`, `:384`.

`updateUI()` i `updatePowertrainMetrics()` zapisują odczyty wszystkich napędów,
turbo, cyklu i lekcji niezależnie od widoku. Ikona pauzy i podpis sprzęgła
powstają wielokrotnie przez `innerHTML`, nawet gdy się nie zmieniły.
W próbce zatrzymanego zawieszenia **1932 z 2198 mutacji DOM (88%)** dotyczyły
elementów pod przodkiem `[hidden]`. W zatrzymanym sprzęgle było to 1144 z 1859.

**Zmiana:** aktualizować wspólne odczyty oraz aktywny panel. Dane konfiguracyjne
odświeżać po zdarzeniu, telemetrię z ograniczoną częstotliwością. Zapisywać tylko
zmienione wartości; zachować elementy ikon i osobny węzeł tekstowy procentów.
Zapamiętać stałe referencje DOM; odświeżać listy przy regenerowaniu przycisków.

**Odbiór:** stała pauza nie mutuje DOM; ukryty panel odświeża się przed pokazaniem;
obie wersje pedałów, aria-pressed i dynamiczne przyciski pozostają zgodne.

### P1/P2. Wysoki koszt rysowania i brak trybu oszczędnego

**Miejsce:** `src/scene.js:40`, `src/models/vehicle-model.js:283`,
powtarzalne siatki modeli silnika i przekładni.

| Przypadek z próby | Wywołania rysowania/klatkę | Trójkąty/klatkę |
| --- | ---: | ---: |
| R4, pojazd, automatyczny detal, silnik wyłączony | 541 | 211 216 |
| R4, pojazd, pełny detal, silnik wyłączony | 1115 | 304 376 |
| R4, silnik pracujący | 413 | 145 224 |
| R4, pojedynczy cylinder | 77 | 29 416 |
| R4, sprzęgło pracujące | 146 | 24 596 |
| R4, ręczna skrzynia | 478 | 122 108 |
| W16, pojazd, silnik pracujący | 1059 | 416 376 |
| W16, silnik pracujący | 1440 | 514 504 |

To konkretne stany i fazy animacji, nie maksima dla wszystkich konfiguracji.
Pełny detal wymuszono wartością diagnostyczną `full`, która w aktualnym modelu
daje próg LOD równy zero, tak jak dostępna w interfejsie opcja `service`.
Współdzielenie geometrii oszczędza pamięć, ale samo nie łączy draw calls.
Renderer zawsze używa antyaliasingu i DPR do 1,6. Przy tej samej wielkości CSS
DPR 1,6 oznacza 2,56 razy więcej pikseli niż DPR 1; nie oznacza automatycznie
2,56-krotnej różnicy FPS.

**Zmiana, etap pierwszy:** wybór Auto / Oszczędny / Wysoka jakość. Oszczędny:
DPR do 1, ograniczona liczba cząsteczek oraz np. render do 30 kl./s z poprawnie
liczonym czasem fizyki. Wybrany mechanizm i jego połączenia pozostają czytelne.
Auto powinno reagować na dłuższy trend z histerezą, a nie skakać co klatkę.

**Zmiana, etap drugi:** instancjonować powtarzalne śruby, rolki, żebra i inne
detale w granicach komponentu; łączyć nieruchome siatki o wspólnym materiale
i znaczeniu. Zachować `part`, obsługę `instanceId`, przekroje i izolację.
LOD opierać również na rozmiarze części na ekranie i wybranym mechanizmie.

**Odbiór:** cel roboczy co najmniej 30% mniej draw calls w drogich widokach
przy porównywalnej czytelności. To kryterium przyszłej pracy, nie wykazany zysk.
Oceniać także płynność i czas klatki na rzeczywistym GPU laptopa.

### P2. Rozrząd i ukryte przepływy aktualizują się w niepotrzebnych sekcjach

**Miejsce:** `src/models/systems-model.js:201`.

Widoczność całego `SystemsModel` zatrzymuje aktualizację, lecz jego podzespoły
nie mają podobnej granicy. Także w widoku oleju i paliwa zapisuje się **130
macierzy rozrządu dla R4** i **300 dla W16** na aktualizację. Pętle przepływów
mogą obliczać strzałki mimo ukrycia ich grupy nadrzędnej.

**Zmiana:** osobne aktualizacje rozrządu, oleju i paliwa, uruchamiane według
aktywnej sekcji. Statyczne właściwości materiałów ustawiać po zmianie konfiguracji;
buforować próbki i długości stałych krzywych. Najpierw usunąć zbędną pracę,
potem ograniczać alokacje w aktywnych ścieżkach.

### P2. Przejścia po całym drzewie i powtarzanie widoczności

**Miejsce:** `src/models/vehicle-model.js:280`, `:295`,
`src/models/suspension-model.js:223`, `src/scene.js:509`.

Pojazd co klatkę stosuje konfigurację widoczności i przechodzi całe drzewo,
aby ponownie ukryć LOD. Zawieszenie odtwarza drogę i jej normalne także podczas
pauzy. Samo `SuspensionModel.update()` stosuje sekcję, po czym scena robi to
ponownie. Pomiar zatrzymanego zawieszenia potwierdził dwa przeliczenia normalnych
na aktualizację, mimo niezmiennego położenia drogi.

**Zmiana:** przechowywać listy części LOD, aktualizować politykę widoczności
po zmianie detalu/sekcji/konfiguracji. Zachować jedną końcową fazę widoczności,
ponieważ aktualizacje modeli mogą ją nadpisywać. Przebudować drogę dopiero po
zmianie dystansu lub nawierzchni; ograniczyć alokacje w kinematyce zawieszenia.
Każdy zmienny bufor musi mieć poprawne granice dla renderowania i wybierania.

### P2. Kliknięcie sprawdza także ukryte siatki

**Miejsce:** `src/scene.js:140`.

`intersectObjects(root.children, true)` wykonuje testy przecięcia przed
odfiltrowaniem niewidocznych przodków i `ignorePick`. Lokalny Raycaster Three.js
nie pomija automatycznie `visible === false`. To możliwy koszt reakcji na klik,
odrębny od stałego FPS; jego znaczenie wymaga osobnego pomiaru.

**Zmiana:** budować listę widocznych, wybieralnych siatek przy zmianie widoku,
LOD lub izolacji i testować ją bez rekurencji. Zachować opisy przy wyłączonych
etykietach, części instancjonowane oraz rozróżnienie prawego kliku i przeciągania.

## Refaktory i poprawki produktu

### P2. Podzielić główny moduł według odpowiedzialności

`main.js` ma 1188 linii i około 113 kB. Łączy duże szablony HTML, konfigurację,
lekcje, formatowanie, zdarzenia i pętlę aplikacji. `drivetrain-model.js` ma 1012
linii, w tym budowę sprzęgła, przycinanie geometrii i animację skrzyni.

Proponowany podział zachowuje zwykłe ES modules:

- `main.js`: utworzenie aplikacji i jej uruchomienie.
- `app-controller.js`: działania użytkownika i transakcje konfiguracji.
- `ui/`: szablon strony, stałe referencje DOM, wspólne odczyty i osobne panele.
- `views.js`: osiem widoków, dostępne inspekcje, lekcje i podpisy.
- `frame-loop.js`: fizyka, unieważnianie obrazu, harmonogram UI i rysowania.
- W modelach: osobne konstruktory sprzęgła/manuala oraz pomocnik przekroju;
  model nadal odpowiada za ich wspólną animację i zasoby.

Podział wykonywać etapami przy zachowaniu interfejsów i testów. `Simulation`
pozostaje jedynym właścicielem fizyki. Warto dodać `createApp(...).dispose()`
oraz możliwość podstawienia sceny testowej, aby testy UI nie musiały usuwać
importów CSS z tekstu głównego modułu. Sprzątanie powinno objąć również
nasłuchy window/matchMedia, timery i elementy DOM przy HMR.

### P2. Ujednolicić zmianę konfiguracji i opis widoków

`changeView`, `updatePowertrainConfiguration`, zdarzenia presetów, montażu
i przekładni wielokrotnie odtwarzają podobną sekwencję zatrzymania lekcji,
zgodności konfiguracji, aktualizacji modeli, inspekcji i UI.

Jedna operacja konfiguracji powinna: wykonać setter symulacji, ustalić wynik
ograniczeń kompatybilności, zatrzymać właściwe doświadczenia, zsynchronizować
modele, ustalić poprawny widok i raz odświeżyć interfejs. Zachować regułę
wyjścia z zakładki hybrydy po zmianie e-CVT oraz oddzielność montażu i napędu osi.
Widoki opisać deklaratywnie, a wyjątkowe kamery i mechanizmy pozostawić jawne.

### P2. Usunąć sprzeczne instrukcje dla automatów

`src/main.js:227` i `:231`: pasek „Spróbuj sam” i pomoc nadal każą wciskać
pedał sprzęgła oraz opisują biegi 1–5 przy wybranym DCT, 8AT lub e-CVT.
Potwierdza to aktualny obraz W16/DCT. To rzeczywista niespójność edukacyjna.

Generować instrukcje ruszania, zmiany biegów, skróty i czas etapów z bieżącej
przekładni. Osobna lekcja zawieszenia powinna dalej wyraźnie informować, że
nie odwzorowuje zawieszenia wybranego samochodu. Ograniczyć liczbę stale
widocznych instrukcji przez wykorzystanie aktualnej sekcji i opisu części.

### P2. Etykiety powinny omijać narzędzia kamery

Na obrazie `browser-phone-layout-*/phone-911.png` etykieta „Tylna oś” wchodzi
na panel „Gesty”. `scene.js:533` rozwiązuje kolizje między etykietami, ale nie
uwzględnia wszystkich obszarów zajętych przez kontrolki i odczyty.
Uwzględnić prostokąty takich paneli w rozmieszczaniu etykiet, mierząc je po
zmianie układu zamiast co klatkę. Sprawdzić także długie nazwy części, fullscreen
i otwarty opis. Zachować możliwość wyboru części z wyłączonymi etykietami.

### P2/P3. Wspólne stałe i czytelniejszy CSS

Czas zmiany manuala 2,4 s i DCT 1,6 s jest powielony w symulacji oraz przyciskach
kroku (`simulation.js:170`, `main.js:609`, `:1033`). Przełożenie główne 3,9
powtarza się w modelach mimo istniejącego `FINAL_RATIO`. Wspólne stałe powinny
wiązać fizykę, prezentację i krok lekcji; nie należy łączyć z nimi przypadkowo
podobnych wymiarów ilustracyjnej geometrii.

Pliki CSS mają bardzo długie wiersze i nakładające się reguły bazowe/komponentowe.
Formatować oraz konsolidować komponentami po ustabilizowaniu zachowania UI.
Zweryfikować całe osiem zakładek i dziewięć silników, ekran telefonu, tablet,
fullscreen, ograniczenia napisów i brak poziomego przewijania.
Rozmycie tła panelu opisu nadal występuje; jego usunięcie rozważać dopiero po
pomiarze otwartego panelu. Wcześniejsza poprawka etykiet już usunęła ich blur.

### P3. Start, pakiet i odporność

Konstruktor sceny od razu tworzy wszystkie przekładnie, zawieszenie i pozostałe
zespoły. Próba R4 miała 4159 obiektów sceny, z czego około 500–800 widocznych,
zależnie od widoku. Opóźnione tworzenie nieużywanych zespołów może poprawić start
i pamięć, ale samo nie dowodzi poprawy FPS, bo ukryte grupy już często pomijają
`update`. Najpierw uporządkować własność, referencje pojazdu i odświeżanie etykiet.

Dynamiczne importy mają sens dla rzadziej używanych modeli i paneli po pomiarze
startu wersji produkcyjnej. Ostrzeżenie o pakiecie Three.js dotyczy rozmiaru
pakietu, nie jest wyjaśnieniem narastającego mulenia. Część eksportowanych
fontów to alternatywne formaty/subsety, więc nie należy utożsamiać rozmiaru
całego `dist/` z transferem jednej wizyty.

Po utracie WebGL obecny komunikat wymaga odświeżenia. Zaplanować sprawdzoną
ścieżkę przywrócenia/reinicjalizacji sceny z zachowaniem konfiguracji i czytelnym
stanem ładowania. Dodać lekkie sprawdzanie stylu JS i importów po podziale modułów.

## Kolejność wdrożenia

| Etap | Zakres | Warunek zakończenia |
| --- | --- | --- |
| 1. Ograniczenie zbędnej pracy | Dispose instancji, UI tylko po zmianie, wygaszanie pauzy | Stabilne zasoby; nieruchoma pauza nie wykonuje renderów i zapisów DOM; wszystkie kontrolki działają |
| 2. Koszt aktywnej animacji | Cylindry/efekty, macierze, SystemsModel, droga, LOD, tryb oszczędny | Mniej operacji w licznikach; stabilna fizyka; porównanie GPU laptopa przy tej samej scenie |
| 3. Struktura kodu i treści | Podział main/modeli, operacje konfiguracji, rejestr widoków, instrukcje automatów, stałe | Dotychczasowe zachowanie pokryte testami; brak rozjazdu UI/model/fizyka |
| 4. Rysowanie i start | Instancjonowanie detali, łączenie siatek, dobór LOD, opcjonalne lazy loading | Mniej draw calls/startu; prawidłowy picking, kadrowanie i izolacja; oględziny obrazów |
| 5. Porządki i odporność | CSS, kontrola stylu, odzyskiwanie WebGL, dokumentacja | Odbiór telefonu/tabletu/fullscreen i dłuższej sesji; zapis ograniczeń |

Każdy etap powinien stanowić małą, osobno weryfikowalną zmianę. Poprawkę
instrukcji automatów można wykonać niezależnie od optymalizacji. Najpierw
wprowadzić prosty sposób odtwarzania pomiarów do `scripts/`; obecne skrypty
audytu są lokalnymi narzędziami diagnostycznymi.

## Kryteria odbioru całej serii

1. Fizykę nadal liczyć z dotychczasową dokładnością. Tryb jakości zmienia
   wizualizację i częstotliwość rysowania, zachowując czas oraz wyniki symulacji.
   Limit `dt` 0,1 s wymaga jawnej decyzji przy silnym przeciążeniu; zwiększanie
   kroku integracji lub nieograniczone nadrabianie czasu nie jest rozwiązaniem.
2. Macierz pomiarów: R3/R4/W16, wszystkie przekładnie, osiem widoków,
   inspekcje/izolacje, etykiety/przepływy włączone i wyłączone, pauza,
   DPR 1/1,6, zwykły ekran/fullscreen. Rozgrzewka i kilka powtórzeń.
3. Liczyć osobno czas fizyki, CPU modeli, przygotowanie klatki, rzeczywiste
   odstępy między klatkami i — gdy dostępny — czas GPU. Sam czas wywołania
   `renderer.render()` nie jest czasem zakończenia asynchronicznej pracy GPU.
4. Testować liczniki operacji, własność/dispose i bezczynność bez sztywnych
   progów milisekund na CI. Ograniczenia sprzętu nie powinny losowo psuć testów.
5. Dłuższa sesja 15–30 min: zmiany presetów, układu montażu, inspekcji,
   zawieszenia i powrót do tego samego stanu. Porównać heap po GC, geometrię,
   tekstury, bufory, DOM i czas klatki po rozgrzewce.
6. Testy Node, build i odpowiednie scenariusze Chromium; po zmianach obrazu
   oględziny zrzutów. Geometria i test DOM nie dowodzą czytelności mechanizmu.
7. Ostateczny pomiar na laptopie użytkownika, w przeglądarce z akceleracją GPU,
   przy zapisanej rozdzielczości, DPR, zasilaniu i trybie jakości. Cel roboczy:
   płynne 30 kl./s w trybie oszczędnym i 60 tam, gdzie sprzęt pozwala,
   bez spadku po dłuższej sesji. Wyniku nie potwierdzono w tym audycie.

## Ograniczenia przeglądu

Audyt potwierdził wymienione koszty i niespójności, ale nie stanowi ponownej
weryfikacji wszystkich uproszczeń mechanicznych względem dokumentacji OEM.
Brakuje pomiaru GPU, temperatury, poboru energii oraz fizycznego touchpada na
docelowym laptopie. Wykryte sprzątanie zasobów może mieć związek z narastaniem
problemu; jego faktyczny udział wymaga porównania na tym urządzeniu.
