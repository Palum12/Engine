# Engine / Lab

Interaktywna aplikacja edukacyjna po polsku: silniki R3, R4, R6, V6, VR6, V8, V12, W16 oraz Boxer 4/6; manual, mokra DCT, automat hydrokinetyczny 8AT i hybryda planetarna e-CVT; RWD, FWD, 4WD i mechaniczne quattro. Orientacja silnika (wzdłużna/poprzeczna) i położenie (przód/centralnie/tył) są osobnymi ustawieniami. Do tego 15 presetów znanych samochodów, turbo, rozrząd, smarowanie i zasilanie paliwem. JavaScript + Three.js + Vite, bez backendu.

Wersja sprzed rozbudowy z 02.10.2026 jest zachowana na branchu [`backup/021026-przed-rozbudowa-napedu`](https://github.com/Palum12/Engine/tree/backup/021026-przed-rozbudowa-napedu), commit `1dd0db6aa2394dec14b43625d549cc7c1be5ddc6`.

## Uruchomienie

Wymagany Node.js 22.12+ i npm.

```bash
git clone https://github.com/Palum12/Engine.git
cd Engine
npm ci
npm run dev
```

Otwórz adres wypisany przez Vite, zwykle `http://localhost:5173`. Telefon w tej samej sieci Wi-Fi może otworzyć `http://ADRES-IP-KOMPUTERA:5173`. Zapora komputera musi zezwalać na połączenie. Nie otwieraj `index.html` bezpośrednio przez `file://`.

```bash
npm test
npm run build
npm run preview
```

Testy w rzeczywistym Chromium z WebGL:

```bash
npm run browser:install
npm run test:browser
```

Przeglądarka i pliki tymczasowe trafiają do `.cache/`, zrzuty kontrolne do `artifacts/browser/`. Testy przechodzą przez wszystkie zakładki i presety, zbliżenia automatu oraz układ telefonu. Nie modyfikuj źródeł w trakcie testu — HMR Vite resetuje stan aplikacji.

## Samochody i montaż silnika

Lista **Samochód** nad modelem zawiera Corollę Hybrid 2025, Audi A4 B8 quattro S tronic, Porsche 911 Carrera S 2025, Bugatti Veyron, Golf GTI i R32, Peugeot 508 EAT8, Mazdę MX-5, BMW 330i i 340i, Subaru WRX, Jeepa Wranglera oraz Ferrari 458 i 812. Każda pozycja wskazuje rocznik i wersję. Preset resetuje poprzednie ruszanie/zmianę biegu i ustawia architekturę; własna zmiana konfiguracji usuwa oznaczenie wybranego presetu.

Ustawienia napędu, orientacji i położenia silnika oraz skrzyni są nad modelem, również dla własnej konfiguracji. R3/R4 można montować wzdłużnie lub poprzecznie. FWD obsługuje również montaż wzdłużny. Silnik centralny znajduje się przed tylną osią, tylny za nią. Wybór niezgodnej konfiguracji dopasowuje napęd; e-CVT pozostaje R4 z przodu, poprzecznie i FWD. Presety opisują architekturę auta, a wspólne modele mają umowne osiągi, geometrię i przełożenia — manual 5-biegowy, DCT 6-biegowe, hydrokinetyczny automat 8-biegowy. Opisy podają różnice względem fabryki.

Preset SEAT Ibiza 1.0 MPI 2016 wybiera R3 75 KM, MPI, pasek, przedni montaż poprzeczny, FWD i manual. Widok silnika pozwala odizolować głowicę z gniazdami, prowadnicami, zaworami i kanałami. Pasek/łańcuch pozostaje widoczny w całym pojeździe. Manual pokazuje zmniejszanie docisku przed odsunięciem powierzchni, poślizg i ciepło; przycisk ruszania przygotowuje półsprzęgło. Zbliżenie biegu pokazuje łożysko igiełkowe, stożek, piastę, tuleję i zęby kłowe. W przednim dyferencjale można odsłonić satelity, porównać jazdę na wprost z zakrętem i sprawdzić średnią obrotów półosi.

**Automat hydrokinetyczny** ma osobny widok **Konwerter**: pompę, turbinę, kierownicę i lock-up. Włącz bieg 1, aby obserwować pełzanie, dodaj gazu i porównaj poślizg z blokadą podczas jazdy. Automatyczne zmiany można wyłączyć i wybierać 1–8 ręcznie. **Skrzynia biegów** pokazuje planetarne człony, pakiety i sterowanie hydrauliczne. To schemat inspirowany Aisin, z dydaktyczną topologią i przełożeniami.

W osobnej zakładce sprzęgła **Pokaż warstwy** oddziela tarczę, docisk, sprężynę, pokrywę, łożysko i wysprzęglik hydrauliczny. **Złóż części** przywraca styk roboczy. W skrzyni wybierz **Wybierak → wodzik → widełki**, a potem **Synchronizator** i **Pokaż zmianę biegu**. Przycisk **Następny etap** zatrzymuje rzeczywistą symulację przy tarciu stożka, zazębieniu i połączeniu. DCT ma osobne zbliżenia gałęzi K1/K2 i hydraulicznych wybieraków; „F1 DCT” w presecie Ferrari jest nazwą skrzyni samochodu drogowego, ze wskazaną różnicą liczby biegów modelu.

Zakładka **Zawieszenie / droga** pokazuje osobne doświadczenie jednej osi z uproszczonym napędem. Porównaj kolumnę MacPhersona, układ wielowahaczowy, sztywną oś na resorach piórowych oraz podwójne wahacze z pushrod lub pullrod. Wybierz garby, dołki, fale albo różne przeszkody pod lewym i prawym kołem. Reguluj prędkość, wysokość nierówności, sztywność sprężyn i tłumienie. Pauza i **Krok 0,1 s** pozwalają obserwować pracę mechanizmu. Tabela pokazuje ugięcia, siły i kontakt opony; wybrany preset auta pozostaje zachowany.

Źródła i ograniczenia: [presety samochodów](docs/CAR_PRESET_REFERENCES.md), [automat hydrokinetyczny](docs/automatic-reference.md), [sprzęgło i synchronizator](docs/MANUAL_MECHANISM_REFERENCES.md), [DCT](docs/DCT_MECHANISMS.md), [zawieszenie](docs/SUSPENSION_REFERENCES.md). Wskazówki dla kolejnych modeli są w `AGENTS.md`, `src/AGENTS.md`, `src/models/AGENTS.md` i `tests/AGENTS.md`.

`dist/` zawiera wynikową stronę statyczną. Względne ścieżki zasobów umożliwiają publikację w `/Engine/` oraz innych podkatalogach. Fonty i biblioteki są dołączone do kompilacji; aplikacja nie potrzebuje zewnętrznych CDN.

## GitHub Pages

Workflow `.github/workflows/pages.yml` sprawdza symulację, buduje aplikację i publikuje `dist` po zmianie gałęzi `main`. Pull requesty uruchamiają tylko testy i kompilację.

Przed pierwszym wdrożeniem administrator repozytorium musi włączyć Pages:

1. Otwórz repozytorium → **Settings → Pages**.
2. W **Build and deployment → Source** wybierz **GitHub Actions**.
3. Otwórz **Actions → Build, test and deploy → Run workflow**, wybierz `main` i uruchom workflow. Możesz też ponowić wcześniejsze nieudane wdrożenie.
4. Po zakończeniu adres strony pojawi się w środowisku `github-pages` oraz w **Settings → Pages**. Domyślny adres dla tego repozytorium: `https://palum12.github.io/Engine/`.

Jeżeli krok `configure-pages` zwraca 404, najpierw wykonaj krok 2. Sam zapis workflow nie włącza Pages w ustawieniach repozytorium.

Dokumentacja: [własne workflow GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Sterowanie

- Aplikacja otwiera **Napęd**: zarys pojazdu, przednia i tylna oś oraz cztery koła. Przyciski pod listą widoków przybliżają silnik, skrzynię, rozdział napędu, osie i baterię. **Odizoluj** pozwala obejrzeć mechanizm osobno. Orientację i położenie zespołu wybiera się osobno; hybryda pozostaje z przodu i poprzecznie.
- W bocznym panelu wybierz **Zespół napędowy / skrzynia** i **Napęd kół**. Warstwa pokazuje mechanikę, prąd/energię, gazy, olej albo paliwo. Szczegółowość można dobrać automatycznie do odległości lub ustawić ręcznie; etykiety są ograniczone, aby nie zasłaniały modelu.
- **DCT**: K1 obsługuje 1/3/5, K2 2/4/6. Obejrzyj współosiowe wały, pakiety tarcz, przesuwki, mechatronikę i układ oleju. Podświetlenie rozróżnia bieg przenoszący moment i przygotowany. **Następny etap** pokazuje preselektowanie, przejmowanie momentu i ustalenie docisku. Możesz włączyć automatyczną zmianę biegów. Nie ma pedału sprzęgła.
- **4WD**: 2H napędza tył, 4H łączy osie sztywno, 4L dodaje redukcję 2,5:1. Reduktor przełączaj na postoju. **AWD** ma otwarty centralny dyferencjał i opcjonalną blokadę; **quattro** przedstawia mechaniczny wariant bazowo 40:60, odrębny od quattro ultra.
- **Przyczepność i blokady**: ustaw asfalt, mokro, lód lub koło w powietrzu oddzielnie dla każdego koła. Porównaj obroty i moment obu półosi oraz zachowanie blokad.
- **Hybryda**: wybierz EV, podział mocy, ładowanie lub automat; wybierak ma D/N/P. Bateria, falownik, MG1 i MG2 mają osobne przybliżenia. Warstwa elektryczna pokazuje przewód dodatni i powrotny DC oraz trzy fazy AC. Strzałki AC oznaczają kierunek energii, nie stały kierunek przemiennego prądu. Schemat obok pokazuje również moc, prąd baterii, SOC i bilans energii.
- **Doświadczenia**: przygotuj ruszanie, zmianę biegu, zakręt, poślizg, reduktor, jazdę EV, wspomaganie, rekuperację lub ładowanie na postoju. **Odtwórz** animuje rzeczywistą symulację, **Następny krok** wykonuje kolejną część i zatrzymuje pokaz. Zmiana pedału lub konfiguracji kończy scenariusz.
- Przeciągnięcie myszy / jednego palca: obrót kamery.
- Touchpad: przesuwanie dwoma palcami przesuwa kamerę; szczypnięcie przybliża wyłącznie model, także nad etykietami.
- Ekran dotykowy: jeden palec obraca, dwa palce przesuwają i powiększają model.
- Przycisk **Przesuwanie** zmienia przeciąganie w przesuwanie kamery; ponowne kliknięcie przywraca obrót.
- **Gesty**: Auto rozpoznaje typ przewijania. Ponieważ przeglądarka nie podaje rodzaju urządzenia, w razie pomyłki wybierz jawnie Touchpad lub Mysz.
- Kółko myszy / przyciski + i −: przybliżanie. Gesty nad sceną nie zmieniają powiększenia interfejsu; poza sceną zoom przeglądarki pozostaje dostępny.
- Wybór silnika w nagłówku: R3, R4, R6, V6, VR6, V8, V12, W16 oraz Boxer 6. Boxer 4 pozostaje wewnętrznym modelem presetu Subaru WRX.
- Główne widoki: **Silnik**, **Cylinder**, **Napęd**, **Sprzęgło / Konwerter**, **Skrzynia**, **Dyferencjał**, **Hybryda** i **Zawieszenie**. Wszystkie zakładki są widoczne; na węższych ekranach układają się w kolejne rzędy.
- **Napęd**: wybierz podzespół z listy, aby ustawić kamerę. **Odizoluj** ukrywa pozostałe zespoły, a **Opis podzespołu** wyjaśnia jego działanie. Dostępne są silnik, sprzęgło, skrzynia, przekładnia główna z półosiami, turbo, rozrząd, olej i zasilanie paliwem. Rozdział AWD/4WD pojawia się dla odpowiedniej konfiguracji; te mechanizmy nie powielają już głównego paska widoków.
- **Turbo**: w **Napędzie** wybierz przybliżenie turbo. Włącz doładowanie w konfiguracji, wznów animację i zwiększ gaz; przekrój pokazuje turbinę, sprężarkę i połączone przewody.
- Przycisk **×** zamyka panel parametrów. **Pokaż parametry** przywraca go; wyłączenie **Opisów** ukrywa również panel. Na telefonie parametry są domyślnie zwinięte.
- **Przepływ** włącza i wyłącza strzałki: momentu w napędzie oraz gazów w turbo. Strzałki są symbolami, nie częściami mechanizmu.
- Na pełnym ekranie pozostają dostępne gaz, sprzęgło i bieg dla manuala albo gaz, hamulec i bieg/wybierak dla DCT, automatu i hybrydy.
- Widok **Sprzęgło**: suwak **Widok rozstrzelony** oddziela tarczę, docisk, sprężynę talerzową i łożysko, aby można było prześledzić ich działanie.
- **Sprzęgło** uruchamia się z częściami złożonymi. Zielone powierzchnie wskazują styk cierny; schemat obok pokazuje, kiedy napęd zostaje przerwany. Przycisk **Złóż części** usuwa umowne odstępy montażowe. W trakcie częściowego wciskania spada siła docisku, a widoczna szczelina powstaje po rozłączeniu.
- **Skrzynia biegów**: w manualu lista przybliża przesuwkę wybranego biegu. Zmiana trwa dydaktyczne 2,4 s: rozłączenie, synchronizacja, zazębienie przesuwki. DCT pokazuje przejęcie momentu między pakietami, automat człony planetarne i hydraulikę. **Następny etap** zatrzymuje animację i wykonuje kolejny etap wraz z odpowiadającym mu krokiem symulacji. Wznów animację przyciskiem odtwarzania.
- **Dyferencjał**: wybierz zakręt w lewo / na wprost / zakręt w prawo. **Uruchom pokaz stołowy** animuje sam mechanizm niezależnie od prędkości samochodu, z wyraźnym oznaczeniem trybu. **Odsłoń satelity** ukrywa koło talerzowe i ramę kosza. Zbliżenie satelitów ukrywa koła jezdne. Niebieski oznacza lewą półoś, złoty prawą, miedziany satelity.
- **Rozrząd**: zbliżenie jest w **Napędzie** oraz **Silniku**. Wybierz pasek zębaty lub łańcuch w konfiguracji; przełożenie wału do wałków wynosi 2:1.
- **Olej**: w **Napędzie** wybierz przybliżenie obiegu i warstwę oleju. Prześledź smok, pompę, filtr, magistralę, łożyska oraz spływ do miski.
- **Paliwo / gaźnik**: w **Napędzie** wybierz zasilanie paliwem. Typ MPI, GDI lub gaźnik zmieniasz w konfiguracji. Gaźnik pokazuje zwężkę, dyszę, komorę pływakową i przepustnicę reagującą na gaz.
- Panel cyklu czterosuwowego jest dostępny w widokach silnika i napędu; osobne doświadczenia sprzęgła, skrzyni i zawieszenia zostawiają więcej miejsca na mechanizm. Kliknij numer cylindra, aby śledzić jego suw.
- Na dużym ekranie scena wypełnia dostępną szerokość, a boczny panel sterowania przewija się niezależnie.
- Kliknięcie części: opis zasady działania.
- Suwak gazu: otwarcie przepustnicy w uproszczonym modelu.
- Suwak sprzęgła: 0% oznacza zwolniony pedał, 100% oznacza rozłączenie napędu.
- Przycisk sprzęgła: przełącza skrajne położenia. Do płynnego ruszania używaj suwaka.
- Zmiana biegu manuala: wciśnij sprzęgło przynajmniej do 85%, wybierz N lub 1–5 i poczekaj na zakończenie etapów zmiany. DCT wybiera N lub 1–6 automatycznym dociskiem pakietów, a automat hydrokinetyczny N lub 1–8 przez zmianę załączonych członów planetarnych.
- Hamulec: przełącza hamowanie.
- Pauza zatrzymuje całą symulację. Suwak kąta i wybór suwu pozwalają analizować cykl ręcznie.
- Tempo animacji zmienia tylko prędkość przedstawienia ruchu, nie fizykę ani wskazania obrotów.
- Spacja: pauza. Przytrzymany Shift: sprzęgło manuala. Strzałki góra/dół: gaz. N oraz cyfry: bieg do 5 dla manuala, do 6 dla DCT lub do 8 dla automatu. Skróty są wyłączone przy aktywnych polach i przyciskach.

### Pierwszy eksperyment

1. Przejdź do widoku **Napęd**.
2. Wciśnij sprzęgło, wybierz **1** i poczekaj na połączenie biegu.
3. Ustaw gaz na około **25%**.
4. Powoli zmniejszaj wciśnięcie sprzęgła ze 100% do 0%.
5. Obserwuj prędkość pojazdu i obroty. Po rozpędzeniu wciśnij sprzęgło, wybierz **2** i płynnie je zwolnij.
6. Jeżeli silnik zgaśnie, wciśnij sprzęgło i kliknij **Uruchom silnik**.

## Zakres modelu

- R4 2,0 l, V6 3,0 l i V12 6,0 l. Wszystkie pracują w cyklu 720°, z zapłonem odpowiednio co 180°, 120° i 60°.
- R4: kolejność zapłonu 1–3–4–2. V6: przykładowa kolejność 1–2–3–4–5–6. V12: 1–2–5–6–9–10–11–12–7–8–3–4. Numeracja silników V jest edukacyjna: cylindry nieparzyste w banku A, parzyste w banku B; nie odpowiada konkretnemu producentowi.
- V6 i V12 mają rozwarcie 60°. Model V6 pokazuje dzielone czopy, a V12 pary cylindrów ze wspólnym kątem czopa. Korbowody zachowują stałą długość w obu bankach.
- Segmenty czopów głównych i wykorbienia zastępują dawny prosty wał przechodzący przez korbowody. Powiększone cząstki powietrza, paliwa i spalin oraz płomień pozostają nad tłokiem; pokazują fazę, nie skalę cząsteczek ani obliczony front spalania.
- Idealizowane otwarcie zaworów; wałek rozrządu obraca się z połową prędkości wału korbowego.
- Wtrysk MPI przed zaworem dolotowym i GDI w cylindrze. Pokazany GDI podczas sprężania jest jednym wariantem; rzeczywiste układy stosują także wtrysk podczas ssania i wielokrotny.
- Uproszczona krzywa momentu, regulator biegu jałowego, bezwładność, tarcie, sprzęgło cierne z poślizgiem, opory ruchu, hamowanie i zgaśnięcie silnika.
- Przełożenia manuala: 3,50 / 2,10 / 1,40 / 1,05 / 0,82. Przekładnia główna: 3,9; masa: 1250 kg; promień koła: 0,31 m.
- Sprzęgło: koło zamachowe, okładziny tarczy, piasta z wielowypustem, sprężyny tłumiące, docisk, sprężyna talerzowa, łożysko i widełki. Wciśnięcie pedału odsuwa docisk; obroty tarczy zależą od wału wejściowego, a koła zamachowego od silnika. Rozsunięcie części jest wyłącznie zabiegiem ilustracyjnym.
- Skrzynia z dwiema osiami i pięcioma parami stale zazębionych kół. Liczby zębów odpowiadają zadanym przełożeniom; koła współpracujące obracają się przeciwnie. Wybrana para jest podświetlana, a przesuwka łączy koło z wałem wyjściowym. Na luzie koła na wale wyjściowym obracają się swobodnie.
- Każda para ma osobną przesuwkę dla czytelności. Pokazano fazę tarciową pierścienia na stożku i uproszczone wyrównywanie obrotów wejścia. Podczas zmiany skrzynia przechodzi przez luz, nie przenosi momentu od silnika i blokuje drugą równoległą zmianę. Nie obliczamy temperatury ani zużycia synchronizatora. Profile zębów, rozmiary i odstępy są ilustracyjne, nie wymiarowe.
- W widokach napędu widać obroty silnika, wejścia i wyjścia skrzyni, poślizg sprzęgła oraz kierunek przekazywania momentu. Oddalone od siebie złote strzałki zastępują nakładające się drobiny; przy ujemnym momencie kierunek jest odwracany.
- Przekładnia główna, kosz dyferencjału, półosie, przeguby, piasty i hamulce są osobne. Koła boczne i satelity mają wspólny wierzchołek stożków podziałowych, otwory na osie i odsuniętą przekładnię główną. Zęby pozostają przybliżonymi profilami ilustracyjnymi, bez fabrycznej geometrii hipoidalnej. Średnia obrotów półosi równa się obrotom kosza. W pojeździe skręt wyznacza różnicę obrotów, a przyczepność ogranicza moment. Pokaz stołowy ma umowną, wyraźniejszą różnicę prędkości.
- Model przyczepności jest quasi-statyczny: stały nacisk na koła, umowne współczynniki tarcia, zadana geometria zakrętu i uproszczony poślizg. Nie oblicza podatności opon, zawieszenia, przenoszenia obciążenia, ABS, kontroli trakcji ani naprężeń przy spiętych osiach. Otwarty dyferencjał przenosi równe momenty; blokada wiąże obroty. Quattro ogranicza umowny podział na przód do 20–60%, bez fabrycznego modelu tarcia i rozkładu sił osiowych.
- DCT ma sześć przełożeń dydaktycznych 3,60 / 2,20 / 1,52 / 1,15 / 0,90 / 0,74, mokre pakiety, niezależne wały i dwa wały wyjściowe. Przejęcie momentu trwa umowne 1,6 s; zmiana dwóch biegów na tej samej gałęzi wymaga jej otwarcia. Sterowanie i ciśnienie oleju są schematyczne.
- Hybryda wiąże prędkości równaniem `30 × MG1 + 78 × wyjście = 108 × silnik`. Idealne satelity mają 24 zęby, co nie jest fabrycznym profilem Toyoty. Model nie ma pasa CVT. Bateria: 201,6 V, umowne 1,3 kWh, SOC 20–85%, maksymalnie 25 kW rozładowania i 20 kW ładowania. Sprawność konwersji wynosi umowne 92%; prąd, energia i straty są spójne z bilansem. Ograniczenie SOC zmniejsza napęd/rekuperację, a hamulce cierne uzupełniają hamowanie. Nie ma map maszyn, chemii, temperatury ani pełnego modelu energii bezwładności w rozruchu.
- Turbo: bezwładne narastanie doładowania zależne od obrotów i gazu. Przekrój pokazuje obudowy spiralne, zakrzywione łopatki wirników na wspólnym wałku, łożyska ślizgowe i element oporowy, przewody oleju, obejście wastegate, intercooler oraz przepustnicę. W widoku szczegółowym kolektory łączą silnik z turbo; ich przebieg i wielkość są dydaktyczne.
- Wirniki turbo mają wspólny kąt obrotu, a ich animacja jest umownie spowolniona. Otwarcie wastegate ilustruje zależność od doładowania; nie stanowi osobnego regulatora ciśnienia w modelu fizycznym. Kolory powietrza przed i za intercoolerem ilustrują chłodzenie, bez wyliczania temperatury. Nie obliczamy przepływu oleju ani map sprężarki.
- Wtrysk zmienia położenie wtryskiwacza i animację przepływu. Nie przypisujemy samej zmianie MPI/GDI arbitralnego wzrostu mocy.
- Obiegi oleju i paliwa przedstawiają kierunki oraz komponenty, bez obliczania ciśnień, poziomów, temperatur i wydatków pomp. Kanały wewnętrzne są umownie wyprowadzone na zewnątrz. Model gaźnika nie zawiera obwodu biegu jałowego, ssania ani pompki przyspieszającej. Pasek/łańcuch, napinacz i zęby są geometrycznymi uproszczeniami, bez modelowania napięcia lub drgań.
- Brak szczegółowej termodynamiki, emisji, pełnego obiegu chłodzenia, spalania stukowego, biegu wstecznego, dźwięku oraz parametrów konkretnego samochodu.

To pomoc do nauki zasad działania, a nie narzędzie obliczeniowe lub instrukcja konstrukcji silnika. Nowoczesna przeglądarka z WebGL 2 i akceleracją sprzętową jest wymagana do modelu 3D. Gdy WebGL jest niedostępny, interfejs wyświetla wyjaśnienie zamiast pustego ekranu. Aplikacja ogranicza gęstość renderowania na ekranach o wysokiej rozdzielczości i wstrzymuje aktualizacje w ukrytej karcie.

## Pliki

- `src/simulation.js` — niezależna symulacja mechaniki.
- `src/powertrain.js`, `src/automatic.js`, `src/hybrid.js` — przyczepność, rozdział napędu, DCT, automat hydrokinetyczny i bilans energii hybrydy.
- `src/car-presets.js`, `src/car-configuration.js` — warianty samochodów, źródła i bezpieczne przełączanie konfiguracji.
- `src/scenarios.js` — doświadczenia krok po kroku.
- `src/scene.js` — scena 3D, kamera, etykiety i wybór części.
- `src/engines.js` — konfiguracje i geometria układów cylindrów.
- `src/models/` — proceduralne modele silnika, sprzęgła, skrzyni, przekładni głównej oraz turbo.
- `src/main.js` — polski interfejs, interakcje i pętla animacji.
- `src/powertrain-ui.js`, `src/powertrain.css` — konfiguracja napędów, schemat energii i responsywny widok pojazdu.
- `src/style.css`, `src/layout.css`, `src/inspection.css` — pozostałe style.
- `src/inspection.js` — nawigacja po podzespołach i opisy przeglądu.
- `tests/` — testy faz, geometrii obu banków, przełożeń, kierunku obrotu modeli, oddzielenia strzałek przepływu i zachowania symulacji.
- `PROMPT.md` — oryginalny prompt i zlecenie rozbudowy, zachowane bez korekt.

Dokumentacja grafiki: [Three.js](https://threejs.org/docs/).

Podstawy działania turbo: [Garrett — turbina, wspólny wałek, sprężarka i chłodzenie powietrza](https://www.garrettmotion.com/knowledge-center-category/oem/what-is-a-turbo-and-how-does-it-work/), [Garrett — rodzaje turbo i wastegate](https://www.garrettmotion.com/knowledge-center-category/turbo-replacement/diving-into-the-distinctions-between-turbo-types/).

Podstawy zasilania i mechanizmu różnicowego: [Bosch — układ GDI i dwa stopnie zasilania paliwem](https://www.bosch-mobility.com/en/solutions/powertrain/gasoline/gasoline-direct-injection/), [Eaton — otwarty mechanizm różnicowy](https://www.eaton.com/nl/nl-nl/products/differentials-traction-control/open-differential.html).

### Układy cylindrów i ciągły cykl

Dostępne są R4, Inline 6 (R6), V6, VR6 24V, V8 z płaskim wałem, V12, W16 inspirowany Bugatti oraz Boxer 4/6 DOHC. Modele zmieniają liczbę rzędów, ich kąty, wspólne głowice, wałki, dźwigienki oraz rozdział napędu rozrządu. VR6 ma jedną głowicę i dwa wałki, W16 dwie głowice i cztery wałki. Bokser ma osobne czopy dla przeciwległych tłoków.

Ładunek płynnie przechodzi ze ssania do sprężania, następnie przez front spalania do rozprężania i wydechu. Jasne znaczniki spalin nie oznaczają czarnego dymu. Przycisk suwu przeprowadza animację do wskazanej fazy; suwak pozwala bezpośrednio ustawić kąt. Przy włączonym ograniczeniu animacji w systemie przyciski również zmieniają kąt bez przejścia.

Źródła producentów, wybrane warianty i granice zgodności z rzeczywistymi silnikami opisuje [dokumentacja odwzorowania](docs/ENGINE_REFERENCES.md). W16 jest schematem architektury, nie repliką całego zespołu napędowego Bugatti.

Źródła i zakres odwzorowania nowych przekładni, 4WD i hybrydy opisuje [dokumentacja zespołów napędowych](docs/POWERTRAIN_REFERENCES.md). Testy obejmują zachowanie symulacji, bilans energii przy granicznym SOC, geometrie i kamery wszystkich konfiguracji oraz interakcje interfejsu. Test DOM nie zastępuje kontroli WebGL na docelowym urządzeniu.
