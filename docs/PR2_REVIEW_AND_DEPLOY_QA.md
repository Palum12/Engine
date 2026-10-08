# Code review PR #2 — 08.10.2026

Przegląd [PR #2](https://github.com/Palum12/Engine/pull/2), początkowo
`50b6ab9` względem `7541c72`. Zakres obejmował cały diff, nie tylko nowe testy:
harmonogram i zegar fizyki, tłumienie kamery, jakość obrazu, cykl życia modeli,
instancje WebGL, macierze, LOD, picking, etykiety, podział UI, telemetrię,
profilery oraz workflow budowania i Pages. Sprawdzono również zachowanie
kontraktów z AGENTS.md i dokumentacji mechanizmów.

## Potwierdzone problemy i poprawki

Wszystkie poniższe problemy miały znaczenie P2. Testy najpierw odtwarzały
niepoprawne zachowanie, a dopiero potem wdrożono poprawki.

| Problem | Skutek przed poprawką | Zabezpieczenie |
| --- | --- | --- |
| Uśpienie podczas zmiany biegu przy zatrzymanych wałach | Wybór biegu lub N pozostawał niedokończony przy zerowych RPM | Predykat obejmuje `shiftTarget !== null`; realne testy manual/DCT/8AT × 1/N |
| Pomijanie ostatniego renderu i odczytu | Końcowy krok fizyki między terminami 30 FPS / 80 ms pozostawiał stary obraz lub tekst | Końcowe rysowanie i synchronizacja przed snem; testy przy 30 i 60 FPS |
| Sprzężenie tłumienia kamery z invalidacją | OrbitControls wymuszał około 60 renderów i 60 aktualizacji UI mimo trybu oszczędnego | Synchroniczne `change` podczas renderowania korzysta z wyniku `controls.update()`; test rzeczywistych OrbitControls |
| Zegar po całkowitym zawieszeniu RAF ukrytej karty | Powrót integrował 0,1 s ukrytego czasu | Zdarzenie ukrycia natychmiast anuluje RAF i zeruje zegar |
| Resztkowy poślizg kół po wyłączeniu EV | Stojący pojazd mógł zasnąć z obracającymi się kołami | Predykat obejmuje wygaszanie `wheelSlip`; test EV na lodzie z hamowaniem |
| Niedokończone stany po zatrzymaniu wałów | Zamarzało doładowanie (manual 0,233 bar, DCT 0,029 bar, 8AT 0,020 bar) lub 0,7 s cooldown automatu | Wygaszanie boost do 0,001 bar oraz cooldown i zwalnianie lock-up przed snem |
| Zerowy pierwszy krok po wybudzeniu | Wyłączenie nieruchomej hybrydy mogło zachować napis EV i 300 W poboru; przy zerowym gazie pozostawał sam błędny napis | Po zerowym kroku wybudzenia jedna kolejna klatka używa rzeczywistego nowego odstępu czasu; pauza nadal zamraża fizykę |
| Widoczna telemetria kopiowana z ukrytego elementu | Odczyt skrzyni pokazywał stary zacisk zamiast aktualnego poślizgu/rozłączenia | Oba elementy korzystają z aktualnej prezentacji fizycznej, nie z tekstu DOM |
| Stare wymiary nakładek przy zmianie tekstu | Etykiety mogły nachodzić na rozszerzoną legendę lub podpowiedź gestów | Jawne unieważnianie pomiaru po zmianie warstwy i sterowania kamerą |
| Profiler akceptował obcy serwer na porcie 5174 | Raport mógł dotyczyć innej uruchomionej gałęzi | Własna instancja Vite na porcie systemowym; test zajętego portu i zamykania właściwego serwera |

Równania fizyki pozostają zgodne z dotychczasową symulacją. Nie dodano sztucznego
kroku czasu po wybudzeniu: pierwsza próbka ma `dt = 0`, a następna używa nowego
odstępu RAF. Globalna pauza nadal blokuje `Simulation.update`.

## Dowody przed i po poprawkach

Lokalne logi i obrazy są ignorowane przez Git, pod `artifacts/`:

- `cr-pr2/frame-loop-red.log`, `frame-loop-green.log` — początkowe cztery
  poprawne i dziesięć błędnych przypadków, następnie 14/14.
- `cr-pr2/zero-wake-red.log`, `zero-wake-green.log`, `wake-red.log` — brak
  dodatniej próbki po wybudzeniu, następnie 10/10 testów pętli i wyłączenia EV.
- `pr-review-activity-red.log`, `pr-review-activity-green.log` — pięć błędów
  wygaszania boost/automatu, następnie 12/12 testów aktywności.
- `cr-pr2/ui-red.log`, `ui-green.log` — rzeczywisty `main.js` w happy-dom,
  z wejściem LF i CRLF; 38/38 po poprawce ukrytej telemetrii.
- `cr-pr2/profiling-server-red.log`, `profiling-server-green.log` — obcy
  serwer na poprzednim porcie; własny serwer działa i jest prawidłowo zamykany.
- `cr-pr2/final-node.log` — **273/273**, bez pominięć.
- `cr-pr2/build.log` — produkcyjny build **PASS**. Pozostaje znane ostrzeżenie
  o rozmiarze wspólnego pakietu Three.js.

Przegląd własności instancji, geometrii i materiałów nie wykazał dodatkowej
potwierdzonej regresji. Niezależne porównanie rzeczywistych EngineModel z bazą
objęło 10 architektur i 80 przejść: cylinder, izolowana głowica, pełny silnik,
przekrój, zasilanie oraz pracę/wyłączenie. Widoczne macierze, instancje, kolory
i przezroczystości pozostały zgodne z bazą. Skrypt pomocniczy jest zapisany
w `.cache/pr2-model-comparison.mjs`.

## Weryfikacja przeglądarki i wdrożenia

`scripts/verify-site.mjs` sprawdza pakiet produkcyjny na własnym lokalnym serwerze
oraz na publicznym adresie Pages. Przeglądarka korzysta wyłącznie ze zwykłych
kontrolek aplikacji: nie importuje `/src/` ani nie odczytuje prywatnego stanu
symulacji. Sprawdza osiem widoków, wszystkie presety, sprzęgło, zatrzymany silnik
i zmianę 1 → N, 8AT, jazdę elektryczną i wyłączenie EV, telefon, usypianie
WebGL, brak błędów i lokalność zasobów. Porównuje też SHA-256 pobranych plików
JS/CSS i wspólnego chunku z `dist/`.

Wyniki przed scaleniem:

- Kontrole sprzęgła, telefonu, pauzy/jakości, nawigacji (360–1920 px i pełny
  ekran) oraz wszystkich zakładek: **6/6**; `cr-pr2/browser-controls.log`.
  Po ostatnim uzupełnieniu kroku wybudzenia ponowiono test pauzy/jakości: **1/1**;
  `cr-pr2/browser-final-quality.log`.
- Pakiet produkcyjny pod lokalnym `/Engine/`: **36/36**, wszystkie 15 presetów,
  bez błędów konsoli, żądań, obcych zasobów i fallbacku WebGL. JS, CSS i wspólny
  chunk mają identyczne SHA-256 z `dist/`; `cr-pr2/preview-site/report.json`.
- Ponowiony pomiar zasobów: **5/5 stabilnych rund**, 20 zmian presetów;
  bilans 956 śledzonych buforów, 435 geometrii, 2 tekstury, 9 programów
  i 1061 elementów DOM. To stabilność w tej sesji, nie porównanie zajętych
  bajtów VRAM ani FPS; `cr-pr2/resources.json`.
- Obejrzano zrzuty skrzyni manualnej i 8AT, hybrydy, zawieszenia, pojazdu W16,
  zatrzymanego silnika po 1 → N oraz sprzęgła telefonu. Obrazy zachowano pod
  `cr-pr2/preview-site/` i `cr-pr2/browser-controls/`.

Publiczny raport wdrożenia zapisuje ten sam skrypt w
`artifacts/cr-pr2/pages/report.json`. SHA scalenia, przebieg workflow i wynik
wdrożenia są zapisywane osobno w `artifacts/cr-pr2/deployment.json`, a odnośniki
do zakończonego workflow i strony trafiają do opisu PR po weryfikacji.

Przykład powtórzenia po zbudowaniu tej wersji:

```sh
node scripts/verify-site.mjs --url https://palum12.github.io/Engine/ --output artifacts/site-qa --expected-dist dist
```

Workflow `.github/workflows/pages.yml` buduje i testuje PR, natomiast wdrożenie
wykonuje wyłącznie dla `main`. Scalanie wyzwala właściwe wdrożenie; nie potrzeba
osobnego ręcznego publikowania. Wynik publicznej weryfikacji musi dotyczyć SHA
scalenia i zgodnych plików, nie samego HTTP 200 ani poprzedniej wersji strony.

Chromium korzysta z programowego WebGL SwiftShader. Kontrola operacji,
zasobów, interakcji i obrazów nie jest pomiarem płynności fizycznego GPU,
temperatury laptopa ani rzeczywistych gestów touchpada.
