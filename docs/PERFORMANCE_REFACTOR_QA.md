# Wydajność i podział aplikacji — 08.10.2026

Zmiany wynikają z [audytu aplikacji](APPLICATION_REVIEW_AND_PLAN_2026-10-08.md).
Dokument audytu opisuje stan bazowy `7541c72`; ten dokument opisuje wdrożenie.

## Zakres

- `ModelGeometry` rejestruje własne `InstancedMesh` i zwalnia ich zasoby dokładnie
  raz. Dotyczy również odłączonych obiektów, łańcucha transferu i rozrządu.
  Przepięte, pożyczone zespoły i wspólna paleta materiałów zachowują swoich właścicieli.
- Osobny `frame-loop.js` zatrzymuje planowanie klatek po uspokojeniu kamery na
  pauzie. Zmiany kontrolek, gesty, rozmiar sceny, fonty i widoczność karty wybudzają
  rysowanie. Powrót nie nadrabia czasu spędzonego w bezczynności lub ukrytej karcie.
- Fizyka zachowuje dotychczasowy krok i limit `dt = 0,1 s`. Ograniczenie rysowania
  do 30 kl./s nie usuwa kroków fizyki; sprawdza to test z identycznym zegarem wejściowym.
- Jakość **Wysoka**: dotychczasowy limit DPR 1,6 i 60 kl./s. **Oszczędna**:
  DPR maksymalnie 1, 30 kl./s i połowa cząsteczek. **Auto** obniża jakość po 3 s
  utrzymującego się kosztu ponad 28 ms, przywraca po 10 s poniżej 20 ms.
  Obserwuje odstępy RAF oraz koszt przygotowania/zgłoszenia ostatniej klatki.
  Nie jest to pomiar zakończenia pracy GPU ani gwarancja liczby klatek.
  Zmiana kontrolki lub kamery może wymusić klatkę przed regularnym taktem,
  aby interfejs reagował od razu.
- Ukryte cylindry i efekty nie aktualizują buforów. Po pokazaniu ich pozycje od
  razu wynikają z aktualnej fazy. W scenie głównej pomijany jest dodatkowy pełny
  przebieg macierzy silnika; samodzielne użycie modelu zachowuje poprzedni kontrakt.
- Rozrząd i strzałki ukrytych obiegów pomijają aktualizacje. Nawierzchnia zachowuje
  geometrię, dopóki nie zmieniają się droga, amplituda lub odległość.
- LOD przechowuje listę ukrytych siatek zamiast przeszukiwać cały zespół co klatkę.
  Zmiana poziomu i powrót do widoku stołowego przywracają detale.
- Wybieranie części odrzuca ukryte i ignorowane poddrzewa przed przecięciami.
  Etykiety uwzględniają obszary narzędzi kamery i legendy; ich pomiary są buforowane
  i odświeżane po zmianie rozmiaru, fontu, widoku lub przekładni.
- `src/ui/` oddziela szablon strony, opisy, pomoc i telemetrię od kontrolera.
  Telemetria przechowuje referencje do istniejących elementów, pomija ukryte panele
  podczas animacji i zapisuje tylko zmienione wartości. Zapamiętuje też serializację
  HTML i stylów, ponieważ przeglądarka rozwija samozamykające znaczniki SVG
  i normalizuje zapis kolorów. Zmiany wprowadzone poza synchronizatorem nadal
  są wykrywane.
- Instrukcje ruszania, zmiany biegów i skróty odpowiadają manualowi, DCT, 8AT i e-CVT.

## Testy przed implementacją

Implementacja korzysta z kontraktów opisanych w dokumentacji
[InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html),
[renderowania na żądanie i tłumienia kamery](https://threejs.org/manual/pages/rendering-on-demand.html)
oraz [zegara RAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
Wywołania aktualizacji/dispose sprawdzono też w lokalnym Three.js 0.186.0.

Pierwsze commity gałęzi zawierają testy regresji i audyt, przed kodem wdrożenia.
Początkowe uruchomienia potwierdziły brak zwalniania instancji, aktualizacje
ukrytych cząsteczek/rozrządu, powtarzane przebiegi LOD i normalne nawierzchni.
Nowy harmonogram i kontrola jakości otrzymały testy przed utworzeniem modułów.
Osobne testy zabezpieczają przywracanie ukrytej telemetrii i brak zapisów DOM
przy niezmienionym widocznym panelu. Test geometrii paliwa sprawdza teraz efekt
w fazach, w których jest widoczny; ukryte bufory celowo przechowują ostatni stan.

## Powtarzalne pomiary

`node scripts/profile-models.mjs` zapisuje `artifacts/performance/models.json`.
Mierzy rzeczywiste wywołania aktualizacji macierzy, zapisów instancji i normalnych
dla R3/R4/W16, całego silnika, cylindra, głowicy, zatrzymanego silnika i obiegów.
Rozgrzewka: 300 aktualizacji; próbka: 600. Czasy CPU są lokalne, bez GPU.

| Operacja na aktualizację | Baza z audytu | Po zmianie |
| --- | ---: | ---: |
| Zapisy instancji R4, jeden cylinder | 592 | średnio 89,91 |
| Zapisy instancji W16, jeden cylinder | 2368 | średnio 89,91 |
| Zapisy instancji, izolowana głowica / zatrzymany silnik | 592 / 2368 | 0 |
| Ukryty rozrząd R4 w inspekcji oleju | 130 | 0 |
| Ukryty rozrząd W16 w inspekcji paliwa | 300 | 0 |
| Przebudowy normalnych nieruchomej drogi | 2 | 0 |

To liczniki pracy modeli dla identycznej sekwencji faz, nie procent poprawy FPS.

`node scripts/profile-browser.mjs` uruchamia własny lokalny serwer na porcie 5174,
Chromium ze SwiftShader i 20 zmian presetów (5 × W16/hybryda/8AT/R3).
Sprawdza jawnie tworzone/usuwane bufory WebGL, geometrię, tekstury i DOM po GC;
ostatnie trzy powroty do tego samego presetu muszą być stabilne. Wyniki trafiają
do `artifacts/performance/resources.json`. Pięć powrotów do Ibizy dało taki sam
bilans 982 jawnie śledzonych buforów, 447 geometrii, 2 tekstur, 9 programów
i 1061 elementów DOM. Bilans dotyczy buforów utworzonych od rozpoczęcia pomiaru,
nie rozmiaru pamięci GPU. Przeglądarka i pliki tymczasowe
pozostają pod `.cache/`, a raporty pod `artifacts/`.

## Odbiór i ograniczenia

- `npm test`: **251/251**, bez pominięć; log `artifacts/performance-final-node.log`.
- `npm run build`: **PASS**; log `artifacts/performance-build.log`.
- Pomiar modeli: **34 warianty**; pomiar zasobów WebGL: **5/5 stabilnych rund**,
  bez błędów strony. Raporty znajdują się w `artifacts/performance/`.
- Osobne testy przeglądarkowe pauzy/jakości, sprzęgła telefonu oraz nawigacji
  przy szerokościach 360–1920 px i pełnym ekranie: **3/3**.
  Log: `artifacts/performance-browser-controls.log`; obrazy zachowano pod
  `artifacts/performance/browser-controls/browser/`.
- Wszystkie presety i inspekcje 8AT oraz macierz widoków 508, Corolli i Veyrona:
  **4/4**. Log: `artifacts/performance-browser-presets.log`; obrazy:
  `artifacts/performance/browser-presets/browser/`.
- Po ostatniej korekcie unieważniania pomiarów narzędzi ponownie sprawdzono
  sprzęgło telefonu, nawigację/pełny ekran oraz wszystkie zakładki: **3/3**.
  Log: `artifacts/performance-browser-final.log`; obrazy: `artifacts/browser/`.
- Obejrzano `quality-economy-cylinder.png`, `phone-clutch-fullscreen.png`,
  `clutch-engaged-canvas.png`, `automatic-gearbox.png` i widok samochodu telefonu.
  Podpisy Jakość/Gesty są widoczne, opcja Oszczędna mieści się w polu,
  a przekrój sprzęgła zachowuje czytelny rozmiar i oznaczenia kontaktu. Obejrzano
  również przekładnię 508, hybrydę Corolli oraz silnik, głowicę i sprzęgła W16.

Pierwsze pełne uruchomienie WebGL zakończyło się awarią procesu GPU SwiftShader
podczas zrzutu 508. W tym przebiegu 11 przypadków przeszło, nawigacja nie uzyskała
pełnego ekranu, a test wszystkich presetów przekroczył limit 180 s. Wyniki
i obrazy zachowano w `artifacts/performance/browser-full/` oraz
`artifacts/performance-browser-full.log`. Nawigacja przeszła w kolejnym przebiegu;
test wszystkich presetów otrzymał limit 360 s dla renderowania programowego.
W powtórzeniach wszystkie 16 różnych scenariuszy WebGL uzyskały PASS; nie jest
to wynik jednego nieprzerwanego uruchomienia całego zestawu.

Pomiar na laptopie użytkownika z fizycznym GPU pozostaje potrzebny do oceny
odczuwalnej płynności, temperatury i zużycia energii. SwiftShader służy do
regresji WebGL. Krótki test zmian presetów nie zastępuje sesji 15–30 minut.

Audyt zachowuje dalsze propozycje: scalanie statycznych siatek, przebudowę
transakcji konfiguracji i rejestru widoków, formatowanie wszystkich arkuszy,
odzyskiwanie kontekstu oraz opcjonalne leniwe tworzenie modeli. Nie są one
warunkiem działania tego pakietu; wymagają osobnej weryfikacji geometrii,
izolacji i uruchamiania. Ostrzeżenie Vite o rozmiarze Three.js nadal występuje.
