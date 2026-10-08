# Sprzęgło: czytelny przekrój i przyczyny ruchu — 08.10.2026

Ponowne uwagi użytkownika dotyczyły nieczytelnego tarcia, przenikania części
i ruchów bez widocznej przyczyny. Wcześniejszy raport
[geometrii i wydajności](CLUTCH_GEOMETRY_PERFORMANCE_QA.md) nie dowodził
czytelności tej lekcji. Nowa kontrola wykazała też dwa rzeczywiste błędy:
przednie żebra pokrywy przecinały ciągły stożek sprężyny, a metalowa tuleja
tłoka wydłużała się zamiast przesuwać jako sztywna część.

## Zmiana prezentacji

Model przedstawia zwarty półprzekrój suchego sprzęgła z koncentrycznym
wysprzęglikiem. Kamera odsłania oba styki okładzin. Wskaźniki przy modelu
pokazują osobno obroty koła i docisku, obroty tarczy i wału oraz zacisk.
Pół pedału oznacza mniejszy zacisk; samo położenie pedału nie dowodzi poślizgu.
Stan tarcia jest wspólny dla objaśnienia i oznaczeń na modelu.

Sztywny tłok z głowicą porusza łożyskiem; komora płynu zmienia objętość
za głowicą. Oznaczenia sił pokazują drogę od hydrauliki przez łożysko
i podparcie sprężyny do docisku. Osobny układ montażowy zatrzymuje obroty
i oznaczenia pracy. Drobne elementy tłumika drgań pozostają dostępne
w inspekcji tarczy zamiast dominować w objaśnieniu wysprzęglania.

Zasada działania i podparcia wynikają z materiałów producentów:
[Valeo — sprężyna i docisk](https://www.valeoservice.co.uk/en-uk/passenger-car/car-clutch-replacement-parts/pressure-plate-cover-assembly)
oraz [ZF — wysprzęglik, hydraulika i podparcie wału](https://aftermarket.zf.com/en/aftermarket-portal/our-portfolio/passenger-cars/products/clutches/).
Wybrane wymiary i widoczne skoki są dydaktyczne. To nie jest model CAD
konkretnego zespołu OEM ani symulacja ciśnienia i dynamiki płynu.

## Dowody odbioru

- `npm test`: 230/230 testów przeszło. Nowe kontrole sprawdzają trójkąty
  rzeczywistej sprężyny względem brył żeber i kołków w całym skoku i kilku
  niezależnych fazach. Sprawdzono sztywną długość tłoka, głowicę w cylindrze,
  miejsce komory płynu oraz prześwit prowadnicy i zębów wielowypustu.
- `npm run build`: poprawny build produkcyjny. Pozostaje wcześniejsze
  ostrzeżenie rozmiaru pakietu Three.js.
- Końcowy podgląd Chromium: 11 kontrolowanych ujęć, bez błędów aplikacji
  ani poziomego przewijania. Zacisk przy równych obrotach, mniejszy zacisk
  bez poślizgu, obciążony poślizg, pełne rozłączenie, pełny ekran, wyłączone
  etykiety i telefon zapisano w `artifacts/clutch-rethink/after/`.
  Otworzono i obejrzano obrazy. Pasek obu styków zmienia kolor na pomarańczowy
  przy poślizgu, znika po rozłączeniu, a obie szczeliny są widoczne.
- Dodatkowa kontrola po wznowieniu: inspekcja sprzęgła w całym napędzie
  korzysta z jednego panelu odczytów. Pełny ekran telefonu ma zwarty pasek
  narzędzi i zachowuje miejsce dla modelu; opcjonalny panel scenariuszy
  wraca po wyjściu z pełnego ekranu. Ujęcia i odczyty zapisano
  w `artifacts/clutch-rethink/followup-final/`. Po tej korekcie przeszło
  ponownie 35 testów interfejsu i kamery oraz build.
- Kontrola przeglądarkowa obejmuje pięć scenariuszy: wszystkie zakładki,
  presety i automat 8AT, lekcję sprzęgła/wybieraka/DCT/zawieszeń oraz dwa
  szczegółowe testy sprzęgła na komputerze i telefonie. Trzy ogólne
  scenariusze przeszły w pierwszym przebiegu; dwa testy sprzęgła przeszły
  ponownie po końcowej korekcie pełnego ekranu (2/2, 2,1 min).
  Test tarcia porównuje piksele tego samego kadru z oznaczeniami i bez nich:
  zielony styk przy równych obrotach, pomarańczowy przy poślizgu, brak
  oznaczeń po rozłączeniu i w układzie montażowym. Otworzono końcowe obrazy
  z `artifacts/clutch-rethink/browser-final/`.

Pierwszy podgląd tej przebudowy nadal pokazywał zbyt mały model. Powodem
był obracany kwadratowy obrys koła zamachowego oraz puste narożniki całego
zespołu. Końcowa kamera dopasowuje rzeczywiste wierzchołki części, pomijając
strzałki objaśniające. Widoczny mechanizm ma około 300 px wysokości na
komputerze i 230 px na telefonie. Te wartości opisują zapisane kadry,
nie wszystkie możliwe rozmiary ekranu.

Zrzuty, odczyty i logi są lokalne, ignorowane przez Git:
`artifacts/clutch-rethink/` oraz `.cache/clutch-work/`. Testy nie zastępują
kontroli GPU i gestów na urządzeniu użytkownika; ten odbiór używa Chromium
z renderowaniem programowym. Dotychczasowe pomijanie ukrytych zespołów,
przycinanie bez alokowania nowej geometrii i pamięć wymiarów etykiet
pozostają zachowane.
