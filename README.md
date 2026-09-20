# Engine / Lab

Interaktywna aplikacja edukacyjna po polsku: przekroje silników benzynowych R4, V6 i V12, sprzęgło, skrzynia biegów, dyferencjał, turbosprężarka, rozrząd, smarowanie i zasilanie paliwem. JavaScript + Three.js + Vite, bez backendu.

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

- Przeciągnięcie myszy / jednego palca: obrót kamery.
- Kółko myszy / gest dwoma palcami / przyciski + i −: przybliżanie.
- Wybór silnika w nagłówku: R4, V6 lub V12.
- Widoki: cały silnik, wybrany cylinder, napęd, **Napęd szczegółowy**, sprzęgło, skrzynia biegów, dyferencjał, rozrząd, olej, paliwo / gaźnik i turbosprężarka.
- **Napęd szczegółowy**: wybierz podzespół z listy, aby ustawić kamerę. **Odizoluj** ukrywa pozostałe zespoły, a **Opis podzespołu** wyjaśnia jego działanie. Dostępne są silnik, rozbieralne sprzęgło, skrzynia, przekładnia główna z półosiami, turbo, rozrząd, olej i zasilanie paliwem.
- **Turbo**: lista przybliżeń prowadzi przez turbinę, wałek z łożyskami, sprężarkę, wastegate i intercooler. Każdą grupę można odizolować. Włącz turbo przyciskiem przy modelu, wznów animację i zwiększ gaz.
- Przycisk **×** zamyka panel parametrów. **Pokaż parametry** przywraca go; wyłączenie **Opisów** ukrywa również panel. Na telefonie parametry są domyślnie zwinięte.
- **Przepływ** włącza i wyłącza strzałki: momentu w napędzie oraz gazów w turbo. Strzałki są symbolami, nie częściami mechanizmu.
- Na pełnym ekranie pozostają dostępne suwaki gazu i sprzęgła oraz wybór biegu.
- Widok **Sprzęgło**: suwak **Widok rozstrzelony** oddziela tarczę, docisk, sprężynę talerzową i łożysko, aby można było prześledzić ich działanie.
- **Sprzęgło** uruchamia się z częściami złożonymi. Zielone powierzchnie wskazują styk cierny; schemat obok pokazuje, kiedy napęd zostaje przerwany. Przycisk **Złóż części** usuwa umowne odstępy montażowe. W trakcie częściowego wciskania spada siła docisku, a widoczna szczelina powstaje po rozłączeniu.
- **Skrzynia biegów**: lista przybliża przesuwkę wybranego biegu. Zmiana trwa dydaktyczne 2,4 s: rozłączenie, synchronizacja, zazębienie przesuwki. **Następny etap** zatrzymuje animację i wykonuje kolejny etap wraz z odpowiadającym mu krokiem symulacji. Wznów animację przyciskiem odtwarzania.
- **Dyferencjał**: wybierz zakręt w lewo / na wprost / zakręt w prawo. **Uruchom pokaz stołowy** animuje sam mechanizm niezależnie od prędkości samochodu, z wyraźnym oznaczeniem trybu. **Odsłoń satelity** ukrywa koło talerzowe i ramę kosza. Zbliżenie satelitów ukrywa koła jezdne. Niebieski oznacza lewą półoś, złoty prawą, miedziany satelity.
- **Rozrząd**: wybierz pasek zębaty lub łańcuch w konfiguracji. Koło 24-zębne napędza koło 48-zębne; znaczniki ułatwiają obserwację przełożenia 2:1.
- **Olej**: prześledź smok, pompę, filtr, magistralę, łożyska oraz spływ do miski. Jasnozielone strzałki oznaczają dopływ, ciemnozielone powrót.
- **Paliwo / gaźnik**: wybierz MPI, GDI lub gaźnik. Lista zawiera dodatkowe zbliżenia gaźnika i pompy GDI, które automatycznie wybierają właściwe zasilanie. MPI/GDI i gaźnik nie zmieniają arbitralnie osiągów. Gaźnik pokazuje zwężkę, dyszę, komorę pływakową i przepustnicę reagującą na gaz.
- Panel cyklu czterosuwowego pozostaje widoczny w każdym widoku, także na pełnym ekranie. Kliknij numer cylindra, aby śledzić jego suw.
- Na dużym ekranie scena wypełnia dostępną szerokość, a boczny panel sterowania przewija się niezależnie.
- Kliknięcie części: opis zasady działania.
- Suwak gazu: otwarcie przepustnicy w uproszczonym modelu.
- Suwak sprzęgła: 0% oznacza zwolniony pedał, 100% oznacza rozłączenie napędu.
- Przycisk sprzęgła: przełącza skrajne położenia. Do płynnego ruszania używaj suwaka.
- Zmiana biegu: wciśnij sprzęgło przynajmniej do 85%, następnie wybierz N lub 1–5 i poczekaj na zakończenie etapów zmiany.
- Hamulec: przełącza hamowanie.
- Pauza zatrzymuje całą symulację. Suwak kąta i wybór suwu pozwalają analizować cykl ręcznie.
- Tempo animacji zmienia tylko prędkość przedstawienia ruchu, nie fizykę ani wskazania obrotów.
- Spacja: pauza. Przytrzymany Shift: sprzęgło. Strzałki góra/dół: gaz. N, 1–5: bieg. Skróty są wyłączone przy aktywnych polach i przyciskach, aby nie przejmować ich obsługi klawiaturą.

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
- Przełożenia skrzyni: 3,50 / 2,10 / 1,40 / 1,05 / 0,82. Przekładnia główna: 3,9; masa: 1250 kg; promień koła: 0,31 m.
- Sprzęgło: koło zamachowe, okładziny tarczy, piasta z wielowypustem, sprężyny tłumiące, docisk, sprężyna talerzowa, łożysko i widełki. Wciśnięcie pedału odsuwa docisk; obroty tarczy zależą od wału wejściowego, a koła zamachowego od silnika. Rozsunięcie części jest wyłącznie zabiegiem ilustracyjnym.
- Skrzynia z dwiema osiami i pięcioma parami stale zazębionych kół. Liczby zębów odpowiadają zadanym przełożeniom; koła współpracujące obracają się przeciwnie. Wybrana para jest podświetlana, a przesuwka łączy koło z wałem wyjściowym. Na luzie koła na wale wyjściowym obracają się swobodnie.
- Każda para ma osobną przesuwkę dla czytelności. Pokazano fazę tarciową pierścienia na stożku i uproszczone wyrównywanie obrotów wejścia. Podczas zmiany skrzynia przechodzi przez luz, nie przenosi momentu od silnika i blokuje drugą równoległą zmianę. Nie obliczamy temperatury ani zużycia synchronizatora. Profile zębów, rozmiary i odstępy są ilustracyjne, nie wymiarowe.
- W widokach napędu widać obroty silnika, wejścia i wyjścia skrzyni, poślizg sprzęgła oraz kierunek przekazywania momentu. Oddalone od siebie złote strzałki zastępują nakładające się drobiny; przy ujemnym momencie kierunek jest odwracany.
- W widoku szczegółowym przekładnia główna, kosz mechanizmu różnicowego, półosie, przeguby, piasty i tarcze hamulcowe są narysowane osobno. Przekładnia redukuje obroty 3,9 razy. Na wprost obie półosie obracają się jednakowo. W zakręcie prędkości mają stosunek 0,5 i 1,5 prędkości kosza, a satelity dodatkowo obracają się względem kosza. Średnia prędkości półosi zawsze równa się prędkości kosza. To zadana kinematyka zakrętu, bez obliczania promienia toru, przyczepności, poślizgu opon czy rozdziału momentu na nawierzchniach o różnym tarciu. Zęby przekładni kątowej są schematyczne, bez dokładnego zazębienia stożkowego lub hipoidalnego.
- Turbo: bezwładne narastanie doładowania zależne od obrotów i gazu. Przekrój pokazuje obudowy spiralne, zakrzywione łopatki wirników na wspólnym wałku, łożyska ślizgowe i element oporowy, przewody oleju, obejście wastegate, intercooler oraz przepustnicę. W widoku szczegółowym kolektory łączą silnik z turbo; ich przebieg i wielkość są dydaktyczne.
- Wirniki turbo mają wspólny kąt obrotu, a ich animacja jest umownie spowolniona. Otwarcie wastegate ilustruje zależność od doładowania; nie stanowi osobnego regulatora ciśnienia w modelu fizycznym. Kolory powietrza przed i za intercoolerem ilustrują chłodzenie, bez wyliczania temperatury. Nie obliczamy przepływu oleju ani map sprężarki.
- Wtrysk zmienia położenie wtryskiwacza i animację przepływu. Nie przypisujemy samej zmianie MPI/GDI arbitralnego wzrostu mocy.
- Obiegi oleju i paliwa przedstawiają kierunki oraz komponenty, bez obliczania ciśnień, poziomów, temperatur i wydatków pomp. Kanały wewnętrzne są umownie wyprowadzone na zewnątrz. Model gaźnika nie zawiera obwodu biegu jałowego, ssania ani pompki przyspieszającej. Pasek/łańcuch, napinacz i zęby są geometrycznymi uproszczeniami, bez modelowania napięcia lub drgań.
- Brak szczegółowej termodynamiki, emisji, pełnego obiegu chłodzenia, spalania stukowego, biegu wstecznego, dźwięku oraz parametrów konkretnego samochodu.

To pomoc do nauki zasad działania, a nie narzędzie obliczeniowe lub instrukcja konstrukcji silnika. Nowoczesna przeglądarka z WebGL 2 i akceleracją sprzętową jest wymagana do modelu 3D. Gdy WebGL jest niedostępny, interfejs wyświetla wyjaśnienie zamiast pustego ekranu. Aplikacja ogranicza gęstość renderowania na ekranach o wysokiej rozdzielczości i wstrzymuje aktualizacje w ukrytej karcie.

## Pliki

- `src/simulation.js` — niezależna symulacja mechaniki.
- `src/scene.js` — scena 3D, kamera, etykiety i wybór części.
- `src/engines.js` — konfiguracje i geometria układów cylindrów.
- `src/models/` — proceduralne modele silnika, sprzęgła, skrzyni, przekładni głównej oraz turbo.
- `src/main.js` — polski interfejs, interakcje i pętla animacji.
- `src/style.css`, `src/layout.css`, `src/inspection.css` — wygląd i układ responsywny.
- `src/inspection.js` — nawigacja po podzespołach i opisy przeglądu.
- `tests/` — testy faz, geometrii obu banków, przełożeń, kierunku obrotu modeli, oddzielenia strzałek przepływu i zachowania symulacji.
- `PROMPT.md` — oryginalny prompt użytkownika, zachowany bez korekt.

Dokumentacja grafiki: [Three.js](https://threejs.org/docs/).

Podstawy działania turbo: [Garrett — turbina, wspólny wałek, sprężarka i chłodzenie powietrza](https://www.garrettmotion.com/knowledge-center-category/oem/what-is-a-turbo-and-how-does-it-work/), [Garrett — rodzaje turbo i wastegate](https://www.garrettmotion.com/knowledge-center-category/turbo-replacement/diving-into-the-distinctions-between-turbo-types/).

Podstawy zasilania i mechanizmu różnicowego: [Bosch — układ GDI i dwa stopnie zasilania paliwem](https://www.bosch-mobility.com/en/solutions/powertrain/gasoline/gasoline-direct-injection/), [Eaton — otwarty mechanizm różnicowy](https://www.eaton.com/nl/nl-nl/products/differentials-traction-control/open-differential.html).
