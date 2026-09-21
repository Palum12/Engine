# Źródła i zakres modelu

Weryfikacja: 21 września 2026. Aplikacja jest ruchomym schematem edukacyjnym. Przedstawia układ cylindrów, podział głowic i wałków oraz zależności ruchu. Nie jest modelem CAD konkretnego silnika ani instrukcją ustawiania rozrządu.

## Wybrane konfiguracje

| Konfiguracja | Rzędy / głowice / wałki | Rozrząd w modelu |
| --- | --- | --- |
| R4 | 1 / 1 / 2 | Przykładowy DOHC, pasek |
| Inline 6 (R6) | 1 / 1 / 2 | Przykładowy DOHC, łańcuch; nie każda rzędowa szóstka ma taki rozrząd |
| V6 60° | 2 / 2 / 4 | Przykładowy DOHC, osobna gałąź na głowicę |
| VR6 15°, 24V | 2 przesunięte rzędy / 1 / 2 | Wspólna głowica: wałek dolotowy i wydechowy obsługują oba rzędy przez dźwigienki. Łańcuch z przekazaniem napędu po stronie koła zamachowego |
| V12 60° | 2 / 2 / 4 | Przykładowy DOHC, osobna gałąź na głowicę |
| W16 Bugatti | 4 rzędy po 4 / 2 / 4 | Dwa zespoły wąskokątne 15°, ustawione względem siebie pod kątem 90°. Pokazano funkcjonalny rozdział napędu łańcuchowego do dwóch głowic |
| Boxer 4 | 2 przeciwległe / 2 / 4 | Wariant DOHC inspirowany Subaru FB; dwa obwody łańcucha. Przeciwległe tłoki mają osobne czopy, przesunięte o 180°, i równocześnie zbliżają się do swoich głowic |

W każdej konfiguracji pokazano cztery zawory na cylinder oraz jeden obrót wałka na dwa obroty wału. Przełącznik paska/łańcucha jest eksperymentem dydaktycznym; UI oznacza odstępstwo od wybranego wariantu. Nie oznacza to, że producent oferował obie wersje.

## Materiały producentów

- [Volkswagen, SSP 248 — The W Engine Concept](https://www.volkspage.net/technik/ssp/ssp/SSP_248.pdf), s. 5–7: porównanie R, V, VR i W, jedna głowica VR6 i kąt 15°. S. 23–28: głowice rodziny W, wałki i rozdział napędu łańcuchowego przez wałek pośredni. To dokument Volkswagen udostępniony na serwerze archiwalnym. Opis szczegółowy dotyczy W8/W12: **nie potwierdza fabrycznej trasy łańcuchów W16**. W16 w aplikacji wykorzystuje schemat funkcjonalny tej rodziny, bez deklaracji zgodności wszystkich kół i prowadnic z Bugatti.
- [Volkswagen, SSP 246 — Variable Valve Timing](https://www.volkspage.net/technik/ssp/ssp/SSP_246.pdf), s. 4–7: osobne wałki dolotowy i wydechowy, regulacja ich faz i różnice między stanami pracy. Dokument pokazuje także, dlaczego rzeczywistych faz zaworowych nie należy utożsamiać z równymi granicami czterech suwów.
- [Bugatti — W16 Engine, the last of its kind](https://newsroom.bugatti.com/press-releases/bugatti-w16-engine-the-last-of-its-kind), 29.07.2022: dwa ośmiocylindrowe zespoły pod kątem 90°, 8 litrów, cztery turbosprężarki i odstęp zapłonów 45°. Fabryczny Chiron ma również znacznie bardziej rozbudowane zasilanie, chłodzenie i sterowanie doładowaniem niż moduły demonstracyjne aplikacji.
- [Subaru — FHI Develops a New-generation Subaru Boxer Engine](https://www.subaru.co.jp/en/news/archives/press/2010/10_09_23e.html), 23.09.2010: przeciwległy, symetryczny ruch tłoków oraz czterocylindrowa architektura DOHC. Materiał opisuje sterowanie fazami zaworów dolotowych i wydechowych. Nie podaje wymiarów prowadnic ani liczby ogniw; ich przebieg w aplikacji jest schematyczny.

## Spalanie i widoczność gazów

[NASA Glenn — Combustion](https://www.grc.nasa.gov/www/k-12/airplane/combst1.html) wyjaśnia rolę paliwa, tlenu i źródła zapłonu oraz powstawanie gorących produktów spalania, w tym wody i CO₂. Spaliny są przeważnie gazowe; sadza jest produktem stałym, a nie synonimem spalin.

W animacji niebieski i żółty oznaczają składniki ładunku, pomarańczowy gorące produkty spalania, a jasnoszary pozostałe spaliny. Kolory i rozmiary znaczników są umowne. Mieszanka nie zmienia skokowo koloru przy 180°. Zapłon rozpoczyna się przed 360°, front spalania przechodzi przez ładunek, a płomień gaśnie w początkowej części suwu pracy. Potem energię przekazują rozprężające się gazy. Podczas wydechu znaczniki przemieszczają się do zaworu; nie przenikają przez tłok ani wał.

## Uproszczenia, których nie należy odczytywać jako danych fabrycznych

- Numeracja cylindrów i kolejność zapłonów W16 są dydaktyczne. Pokazujemy 16 równomiernych zdarzeń na 720°, nie zatwierdzoną numerację serwisową Bugatti.
- Skala, rozstawy, przekroje głowic, kształt denek tłoków, prowadnice i krzywki są umowne. Osie cylindrów VR/W w modelu przecinają oś wału: fabryczne przesunięcie osi cylindrów i wynikająca z niego korekta geometrii czopów nie są odwzorowane. Ruch korbowodów zachowuje długość w przyjętej geometrii.
- Łańcuchy przedstawiają przeniesienie napędu i prawidłowy stosunek prędkości, nie rzeczywistą liczbę zębów ani pełny układ napinaczy konkretnego silnika. W VR/W pokazano stopień pośredni, w bokserze osobne obwody po obu stronach.
- Zawory mają łagodne otwarcie i zamknięcie w obrębie idealizowanych suwów. Nie symulujemy VVT, nakładania faz zaworowych ani dynamiki sprężyn. Rzeczywisty profil zależy od silnika i warunków pracy.
- Przebieg frontu płomienia jest wizualizacją, nie obliczeniem CFD. Nie wyznaczamy rzeczywistej temperatury, emisji sadzy ani składu spalin.
- Wybór W16 zmienia architekturę silnika. Pozostałe moduły — pojedyncze turbo, mokra miska olejowa, ręczna skrzynia i pojedyncze sprzęgło — pozostają ogólnymi demonstracjami, a nie kompletnym napędem Bugatti z czterema turbo, suchą miską i dwusprzęgłową skrzynią.
