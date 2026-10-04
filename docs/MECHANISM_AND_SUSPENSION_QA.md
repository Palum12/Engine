# Sprzęgło, skrzynia i zawieszenie — odbiór 04.10.2026

## Zakres

Uwagi z `NEXT_SESSION.md` przełożono na trzy doświadczenia: sprzęgło ze
sprężyną talerzową i współosiowym wysprzęglikiem, ręczną zmianę biegu z
synchronizatorem oraz osobną oś zawieszenia nad ruchomą nawierzchnią.
Przebudowano również wspólny model DCT i opisano jego zakres względem
drogowego Ferrari 458. Źródła konstrukcji i uproszczenia zapisano w
[dokumencie sprzęgła i manuala](MANUAL_MECHANISM_REFERENCES.md),
[dokumencie DCT](DCT_MECHANISMS.md) i
[dokumencie zawieszenia](SUSPENSION_REFERENCES.md).

## Sprawdzenie zachowania

- `npm test`: 192/192, bez błędów. Obejmuje fizykę, rzeczywistą geometrię
  Three.js oraz interakcje aktualnego `main.js` w happy-dom z LF i CRLF.
- `npm run build`: zakończone powodzeniem. Pozostaje informacja Vite o
  rozmiarze wspólnego pakietu Three.js.
- Pełny `npm run test:browser -- --output artifacts/mechanisms-final`:
  11/11, lokalny Chromium z WebGL, 13,7 minuty.
- Końcowe powtórzenie zakładek i nowych doświadczeń po poprawkach kamery,
  etykiet i tekstu faz DCT: 2/2, 3,9 minuty. Polecenie
  `npm run test:browser -- --grep "clutch, selector|every tab" --output artifacts/mechanisms-polish`.

Pełny przebieg przełącza wszystkie zakładki i presety, sprawdza montaż,
zmiany biegów, izolację części, kroki doświadczeń oraz ekran 390 × 844.
MacPherson, wielowahacz, resory, pushrod i pullrod korzystają z tej samej
nawierzchni co fizyka opon. Testy sprawdzają równowagę, opóźnienie nadwozia,
zanikanie drgań, przechył, sztywną oś i oderwanie opony.

## Kontrola obrazu

Otworzono i obejrzano wygenerowane obrazy; sam wynik testów DOM nie był
podstawą odbioru widoku. Zrzuty są lokalne i ignorowane przez Git:

- `artifacts/mechanisms-final/browser-clutch-selector-DC-c6ab7-ion-layouts-are-inspectable/`:
  rozłożone i zwolnione sprzęgło, pokrywa, sprężyna, wysprzęglik,
  wybierak, kontakt stożka i zazębienie tulei, gałęzie DCT, pięć zawieszeń,
  izolowane podzespoły i telefon.
- `artifacts/mechanisms-final/browser-mechanism-views-remain-clear-*/`:
  widoki pojazdu, silnika, głowicy, sprzęgła i skrzyni dla Ibizy, A4, 911,
  508, Corolli i Veyrona. Połączenia napędu pozostają ciągłe po zmianach
  geometrii manuala i DCT.
- `artifacts/mechanisms-polish/`: końcowe ujęcia po korektach czytelności.

Pierwsza kontrola obrazu ujawniła zbyt niski obszar sceny zawieszenia mimo
widocznego canvas. Poprawiono nazwane obszary siatki CSS i dodano sprawdzenie
wysokości sceny. Zbliżenie synchronizatora kadruje widoczne części przekroju,
a jego okno nie znika po obrocie wału. Złożone sprzęgło pokazuje szczelinę
z boku; pokrywa i sprężyna mają osobne ujęcia ukośne. Etykiety ukrytych
elementów nie pozostają w izolowanym widoku zawieszenia.

Panel DCT pokazuje właściwy opis wyboru biegu, przejmowania momentu i
ustalenia docisku. Nie twierdzi już, że sprzęgło przygotowanego biegu jest
otwarte podczas przejmowania napędu. Odczyty można schować, aby odsłonić
model; końcowe ujęcia DCT korzystają z tej funkcji.

## Granice odbioru

To modele edukacyjne. Rozłożenie sprzęgła powiększa odstępy, pięć wodzików
manuala ułatwia obserwację, a DCT pozostaje wspólnym schematem sześciu
biegów. Zawieszenie pokazuje jedną oś i wspólne parametry porównawcze,
bez pełnego rozwiązania przestrzennej kinematyki ani przypisania do
fabrycznych zawieszeń presetów.

Chromium używa programowego WebGL SwiftShader. Odbiór nie potwierdza
wydajności GPU ani fizycznego touchpada na urządzeniu użytkownika.
Źródła pozostawały niezmienione podczas każdego przebiegu przeglądarki.
Zmiany przygotowano na lokalnej gałęzi; publikacja nie należała do tego
zlecenia.
