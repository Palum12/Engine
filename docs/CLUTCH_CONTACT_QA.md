# Sprzęgło: styk, podparcia i wysprzęglanie — 07.10.2026

## Powód i zachowanie

Użytkownik zgłosił, że rozstawione części nie składają się przy zaciskaniu,
wirują bez widocznego podparcia i nie wyjaśniają źródła nacisku.
Zakładka sprzęgła otwiera teraz złożony mechanizm. Sprężyna talerzowa zaciska
tarczę bez naciskania pedału; pedał przez hydraulikę, tłok i łożysko odciąża
sprężynę. Najpierw maleje limit momentu, następnie powstają szczeliny.

Pokrywa, śruby, podparcia sprężyny, taśmy docisku, prowadnica i stała pokrywa
skrzyni pokazują połączenia. Współosiowy wysprzęglik pozostaje nieruchomy;
osobna bieżnia łożyska współpracuje z wirującą sprężyną. Przekrój pozostaje
w tej samej płaszczyźnie podczas obrotu części. „Pokaż warstwy” jest osobnym,
nieruchomym układem do rozpoznawania części, z wyłączonymi oznaczeniami styku
i przepływu. „Złóż części” oraz reset przywracają układ złożony.

Schemat przekroju, względny docisk, moment i ciepło korzystają ze wspólnego
`manualClutchState`. Próg styku 72% nie jest progiem blokady zmiany biegu 85%.
Źródła i uproszczenia opisuje [dokument mechanizmu](MANUAL_MECHANISM_REFERENCES.md).

## Odbiór lokalny

- `npm test`: 214/214, bez błędów, po końcowych zmianach źródeł.
- `npm run build`: sukces.
- Przed przerwaniem pracy potwierdzono 13 scenariuszy Chromium; nowy test
  pauzy wymagał poprawy synchronizacji przechwytywania klatki, a ostatni
  preset pozostał do sprawdzenia. Po wznowieniu przeszły 3/3 próby:
  sprzęgło podczas pauzy, telefon i Veyron. Łącznie sprawdzono wszystkie
  15 różnych scenariuszy, obejmujące zakładki, presety, automatyczną skrzynię,
  montaż napędu, mechanizmy, zawieszenia oraz układy wąskie i pełnoekranowe.
- Testy rzeczywistych siatek sprawdzają styk obu okładzin, ciągłość mocowań,
  stały wysprzęglik podczas skoku, przekrój oraz brak obrotu i fałszywych
  oznaczeń kontaktu w rozstrzelonym widoku.
- Otworzono obrazy złożonego i wysprzęglonego modelu, warstw, telefonu,
  manualnej skrzyni oraz całego pojazdu. Zrzuty przed i po wciśnięciu pedału
  podczas pauzy pokazują rzeczywisty ruch łożyska, sprężyny i docisku.
- Telefon 390 × 844: brak poziomego przepełnienia, większy schemat i pasek
  kamery pod modelem, odsłaniający wysprzęglik.

Logi i obrazy są lokalne, ignorowane przez Git: `.cache/clutch-work/`,
`.cache/clutch-final-browser.log`, `artifacts/browser/` oraz
`artifacts/browser-clutch-final/`. Dodatkowy przebieg desktopowy przeszedł 1/1;
pełny kadr izolowanego sprzęgła zapisano i obejrzano w
`artifacts/browser-clutch-desktop-final/`.

## Granice

Geometria i powiększony skok są ilustracyjne, a docisk procentowy jest
względny. Nie jest to rekonstrukcja CAD konkretnego sprzęgła OEM.
Odbiór wykorzystuje programowy WebGL SwiftShader; nie potwierdza wydajności
GPU ani działania fizycznego touchpada użytkownika. Źródła aplikacji
pozostawały niezmienione podczas każdego przebiegu Chromium.
