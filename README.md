# Engine / Lab

Interaktywna aplikacja edukacyjna po polsku: przekroje silników benzynowych R4, V6 i V12, sprzęgło, skrzynia biegów oraz turbosprężarka. JavaScript + Three.js + Vite, bez backendu.

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
- Widoki: cały silnik, wybrany cylinder, cały napęd, sprzęgło, skrzynia biegów i turbosprężarka.
- Widok **Sprzęgło**: suwak **Rozsuń części** oddziela tarczę, docisk, sprężynę talerzową i łożysko, aby można było prześledzić ich działanie.
- Panel cyklu czterosuwowego pozostaje widoczny w każdym widoku, także na pełnym ekranie. Kliknij numer cylindra, aby śledzić jego suw.
- Na dużym ekranie scena wypełnia dostępną szerokość, a boczny panel sterowania przewija się niezależnie.
- Kliknięcie części: opis zasady działania.
- Suwak gazu: otwarcie przepustnicy w uproszczonym modelu.
- Suwak sprzęgła: 0% oznacza zwolniony pedał, 100% oznacza rozłączenie napędu.
- Przycisk sprzęgła: przełącza skrajne położenia. Do płynnego ruszania używaj suwaka.
- Zmiana biegu: wciśnij sprzęgło przynajmniej do 85%, następnie wybierz N lub 1–5.
- Hamulec: przełącza hamowanie.
- Pauza zatrzymuje całą symulację. Suwak kąta i wybór suwu pozwalają analizować cykl ręcznie.
- Tempo animacji zmienia tylko prędkość przedstawienia ruchu, nie fizykę ani wskazania obrotów.
- Spacja: pauza. Przytrzymany Shift: sprzęgło. Strzałki góra/dół: gaz. N, 1–5: bieg. Skróty są wyłączone przy aktywnych polach i przyciskach, aby nie przejmować ich obsługi klawiaturą.

### Pierwszy eksperyment

1. Przejdź do widoku **Napęd**.
2. Wciśnij sprzęgło i wybierz **1**.
3. Ustaw gaz na około **25%**.
4. Powoli zmniejszaj wciśnięcie sprzęgła ze 100% do 0%.
5. Obserwuj prędkość pojazdu i obroty. Po rozpędzeniu wciśnij sprzęgło, wybierz **2** i płynnie je zwolnij.
6. Jeżeli silnik zgaśnie, wciśnij sprzęgło i kliknij **Uruchom silnik**.

## Zakres modelu

- R4 2,0 l, V6 3,0 l i V12 6,0 l. Wszystkie pracują w cyklu 720°, z zapłonem odpowiednio co 180°, 120° i 60°.
- R4: kolejność zapłonu 1–3–4–2. V6: przykładowa kolejność 1–2–3–4–5–6. V12: 1–2–5–6–9–10–11–12–7–8–3–4. Numeracja silników V jest edukacyjna: cylindry nieparzyste w banku A, parzyste w banku B; nie odpowiada konkretnemu producentowi.
- V6 i V12 mają rozwarcie 60°. Model V6 pokazuje dzielone czopy, a V12 pary cylindrów ze wspólnym kątem czopa. Korbowody zachowują stałą długość w obu bankach.
- Idealizowane otwarcie zaworów; wałek rozrządu obraca się z połową prędkości wału korbowego.
- Wtrysk MPI przed zaworem dolotowym i GDI w cylindrze. Pokazany GDI podczas sprężania jest jednym wariantem; rzeczywiste układy stosują także wtrysk podczas ssania i wielokrotny.
- Uproszczona krzywa momentu, regulator biegu jałowego, bezwładność, tarcie, sprzęgło cierne z poślizgiem, opory ruchu, hamowanie i zgaśnięcie silnika.
- Przełożenia skrzyni: 3,50 / 2,10 / 1,40 / 1,05 / 0,82. Przekładnia główna: 3,9; masa: 1250 kg; promień koła: 0,31 m.
- Sprzęgło: koło zamachowe, okładziny tarczy, piasta z wielowypustem, sprężyny tłumiące, docisk, sprężyna talerzowa, łożysko i widełki. Wciśnięcie pedału odsuwa docisk; obroty tarczy zależą od wału wejściowego, a koła zamachowego od silnika. Rozsunięcie części jest wyłącznie zabiegiem ilustracyjnym.
- Skrzynia z dwiema osiami i pięcioma parami stale zazębionych kół. Liczby zębów odpowiadają zadanym przełożeniom; koła współpracujące obracają się przeciwnie. Wybrana para jest podświetlana, a przesuwka łączy koło z wałem wyjściowym. Na luzie koła na wale wyjściowym obracają się swobodnie.
- Każda para ma osobną przesuwkę dla czytelności. Pominięto tarcie stożków synchronizatora oraz rzeczywistą sekwencję wyrównywania obrotów. Profile zębów, rozmiary i odstępy są ilustracyjne, nie wymiarowe.
- W widokach napędu widać obroty silnika, wejścia i wyjścia skrzyni, poślizg sprzęgła oraz kierunek przekazywania momentu. Żółte znaczniki przepływu nie przedstawiają paliwa.
- Przekładnia główna wpływa na obroty koła, ale nie jest osobno narysowana.
- Turbo: bezwładne narastanie doładowania zależne od obrotów i gazu. Widok turbo jest osobną ilustracją, nie pełnym układem dolotowo-wydechowym silnika.
- Wtrysk zmienia położenie wtryskiwacza i animację przepływu. Nie przypisujemy samej zmianie MPI/GDI arbitralnego wzrostu mocy.
- Brak szczegółowej termodynamiki, emisji, chłodzenia, smarowania, spalania stukowego, biegu wstecznego, dźwięku oraz parametrów konkretnego samochodu.

To pomoc do nauki zasad działania, a nie narzędzie obliczeniowe lub instrukcja konstrukcji silnika. Nowoczesna przeglądarka z WebGL 2 i akceleracją sprzętową jest wymagana do modelu 3D. Gdy WebGL jest niedostępny, interfejs wyświetla wyjaśnienie zamiast pustego ekranu. Aplikacja ogranicza gęstość renderowania na ekranach o wysokiej rozdzielczości i wstrzymuje aktualizacje w ukrytej karcie.

## Pliki

- `src/simulation.js` — niezależna symulacja mechaniki.
- `src/scene.js` — scena 3D, kamera, etykiety i wybór części.
- `src/engines.js` — konfiguracje i geometria układów cylindrów.
- `src/models/` — proceduralne modele silnika, sprzęgła, skrzyni oraz turbo.
- `src/main.js` — polski interfejs, interakcje i pętla animacji.
- `src/style.css` i `src/layout.css` — wygląd oraz układ dla desktopu, telefonu i pełnego ekranu.
- `tests/simulation.test.js` i `tests/engines.test.js` — testy faz, geometrii obu banków, przełożeń oraz zachowania symulacji.
- `PROMPT.md` — oryginalny prompt użytkownika, zachowany bez korekt.

Dokumentacja grafiki: [Three.js](https://threejs.org/docs/).
