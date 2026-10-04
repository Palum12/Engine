# DCT — połączenia i zakres modelu

Aktualizacja: 04.10.2026.

## Źródła

- [Volkswagen, SSP 308 — skrzynia 02E](https://www.volkspage.net/technik/ssp/ssp/SSP_308.pdf), materiał producenta w archiwum Volkspage. Strony 12–19 opisują dwie gałęzie, mokre K1/K2, ich kosze oraz wewnętrzny i rurowy wał wejściowy. Strony 23–27 opisują synchronizację i drogi napędu; rozdziały mechatroniki oraz siłowników pokazują hydrauliczne przesuwanie widełek. Przygotowany bieg może być wybrany przy otwartym sprzęgle swojej gałęzi.
- [Ferrari — 458 Italia, historia modelu](https://www.ferrari.com/en-MG/history/moments/2009/benchmark-car/more). Ferrari nazywa skrzynię tego samochodu „F1 dual-clutch” i podaje siedem biegów. W presecie chodzi o skrzynię samochodu drogowego 458. Materiał nie stanowi podstawy do odtwarzania skrzyni bolidu Formuły 1.

## Widoczna droga napędu

Wspólny kosz jest połączony z kołem zamachowym. Srebrne tarcze obraca silnik; naprzemienne niebieskie lub miedziane tarcze mają wewnętrzne wypusty związane z piastą odpowiedniego wału. Piasty, żebra koszy i odcinki wałów tworzą ciągłe połączenia. K1 obsługuje biegi 1/3/5, K2 2/4/6. Rurowy wał K2 ma otwór większy od wału K1; przekrój zmniejsza jego krycie, aby pokazać wał wewnętrzny.

Koła wejściowe zazębiają się ze swobodnymi kołami wyjściowymi. Tuleja łączy wybrane koło z piastą wału wyjściowego. Połączone koło drugiej gałęzi pozostaje przygotowane, dopóki jej sprzęgło jest otwarte. Złoty bieg i animowany przepływ wskazują przenoszenie momentu. Otwarta, przygotowana gałąź nie ma animowanej drogi momentu.

Siłownik hydrauliczny, wodzik, widełki i tuleja przesuwają się po tej samej osi. Przewody łączą siłowniki z mechatroniką. Pompa, filtr i chłodnica są zamocowane pod miską oraz połączone przewodami, aby nie sugerowały dodatkowych wałów skrzyni. Zmiana na tej samej gałęzi pokazuje zwolnienie przesuwki przed załączeniem następnego koła.

## Uproszczenia

To wspólny sześciobiegowy schemat inspirowany 02E, a nie wnętrze Ferrari/Getrag. Pakiety K1/K2 są odsunięte osiowo, co pozwala odróżnić ich tarcze i połączenia bez przenikania piast. Rozłożenie dodatkowo powiększa odstępy w osobnej zakładce sprzęgła. W skrzyni oraz pojeździe zachowany jest złożony układ.

Każdy bieg ma osobną tuleję i siłownik; rzeczywista 02E grupuje biegi na przesuwkach i współdzieli wybrane koła wejściowe. W modelu nie ma wstecznego, blokady parkingowej, fabrycznych kanałów olejowych ani sterownika konkretnej skrzyni. Przełożenia są dydaktyczne. Pompa obraca się ilustracyjnie z silnikiem. Nie obliczamy ciśnienia, temperatury ani wymiany ciepła oleju. Szczegółowe wyrównywanie prędkości na stożku pokazuje doświadczenie skrzyni ręcznej; DCT ilustruje wybór gałęzi, przygotowanie i przejmowanie momentu.

## Weryfikacja

`tests/dct-detail.test.js` sprawdza swobodne koła i brak momentu w otwartej gałęzi, wspólny ruch siłownika/wodzika/widełek/tulei, skok tłoka w korpusie, ciągłość koszy w rozłożeniu, pełne granice widocznych części po zmianie rodzica, zachowany punkt wyjścia do pojazdu oraz zatrzymywanie i odwracanie przepływów. Widok WebGL wymaga osobnej kontroli obrazu.
