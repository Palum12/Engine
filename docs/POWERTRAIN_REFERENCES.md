# Zespoły napędowe — źródła i zakres odwzorowania

Aktualizacja: 03.10.2026. Modele wyjaśniają zasady działania. Nie są modelami CAD ani symulatorami fabrycznych sterowników. Proporcje, przewody, pokrywy i odstępy montażowe są dobrane do przekroju edukacyjnego.

## Źródła pierwotne

| Źródło | Zastosowanie w aplikacji |
| --- | --- |
| [Volkswagen, Self Study Programme 308 — 02E Direct Shift Gearbox](https://www.volkspage.net/technik/ssp/ssp/SSP_308.pdf), materiał producenta, kopia w archiwum Volkspage | Mokre K1/K2, wały wejściowe wewnętrzny i rurowy, dwa wyjścia, przygotowanie kolejnego biegu, mechatronika, pompa, filtr i chłodnica oleju. |
| [Audi — Self-locking center differential](https://www.audi-technology-portal.de/en/drivetrain/quattro_en/self-locking-center-differential) | Wybrany mechaniczny, planetarny wariant quattro: bazowo 40:60, do 60% na przód lub 80% na tył; koła śrubowe i samoblokowanie. |
| [Audi — quattro with ultra technology](https://www.audi-technology-portal.de/en/drivetrain/quattro_en/audi-quattro-with-ultra-technology-en) | Rozróżnienie od układu ze sprzęgłami do odłączania napędu. Quattro ultra nie zostało zaimplementowane. |
| [Jeep — 4x4 FAQ and glossary](https://www.jeep.com/4x4/faq-and-glossary.html) | Part-time 4WD, 2H/4H/4L, reduktor oraz różnica między spięciem osi a centralnym dyferencjałem. |
| [Toyota — lider technologii hybrydowej](https://www.toyotanews.eu/pl/aktualnosci/1839-item-toyota-liderem-technologii-hybrydowej) | e-CVT z rozdziałem mocy, MG1 jako generator/rozrusznik, MG2 jako napęd/generator i różnice kolejnych generacji. |
| [Toyota Technical Review, Vol. 47, No. 2](https://global.toyota/pages/global_toyota/mobility/technology/toyota-technical-review/TTR_Vol47-2_E.pdf) | Połączenia rozdzielacza mocy: MG1 — słońce, silnik — jarzmo, wyjście/MG2 — wieniec; drogi energii mechanicznej i elektrycznej. |
| [Toyota Technical Training — Hybrid System Overview](https://www.5021.tips/ujanja/wp-content/uploads/2020/10/Hybrid01.pdf), materiał producenta, kopia archiwalna | Bateria, falownik, rozruch, napęd elektryczny, podział mocy i odzysk energii. |
| [Eaton — Open differential](https://www.eaton.com/nl/nl-nl/products/differentials-traction-control/open-differential.html) | Różne prędkości kół i ograniczenie momentu przez słabszą stronę otwartego dyferencjału. |

## Dyferencjały i przyczepność

Wewnętrzne koła boczne 16-zębowe i satelity 12-zębowe mają komplementarne kąty stożków podziałowych. Obie pary wychodzą ze wspólnego wierzchołka; satelity obracają się na poprzecznej osi, a półosie kończą się przed jej środkiem. Łożyska i koła mają otwory. Korona przekładni głównej jest odsunięta od tyłu koła bocznego. Widok rozstrzelony i odsłanianie kosza ułatwiają rozpoznanie części.

To proste, ilustracyjne zęby stożkowe. Nie odwzorowujemy fabrycznych zębów spiralnych, korekcji profilu, luzów roboczych ani przekładni hipoidalnej. Przy montażu poprzecznym przekładnia główna jest walcowa i ma osie równoległe do skrzyni. FWD może być także wzdłużne: wówczas model zachowuje koło talerzowe i zmianę kierunku osi obrotu.

Otwarty dyferencjał ogranicza dostępny moment osi do dwukrotności limitu słabszego koła i dzieli go po równo. Blokada wiąże prędkości półosi; w quasi-statycznym modelu moment rozdziela się według dostępnej przyczepności. Stałe naciski na koła, współczynniki tarcia i narastanie poślizgu są uproszczeniami. Średnia prędkość kół odpowiada koszowi; skręt zwiększa drogę zewnętrznych kół i przedniej osi. Przy spiętych osiach pokazujemy konieczność poślizgu oraz komunikat o naprężeniu, bez wyliczania naprężeń elementów.

## Sprzęgło ręczne i synchronizatory

`manualClutchState` jest wspólne dla fizyki, geometrii i objaśnień. Pedał 0% oznacza pełny docisk. Siła zacisku i limit momentu maleją płynnie przy wciskaniu pedału; w tym modelu osiągają zero przy 72% skoku. Dopiero dalej powstaje widoczna szczelina. Łożysko i palce sprężyny przesuwają się podczas odciążania; sprężyste taśmy zmieniają kształt wraz z rzeczywistym odsunięciem docisku. Podział skoku, siły i powiększone odległości są dydaktyczne, nie są pomiarami sprzęgła konkretnego auta. Próg 85% pozostaje interlockiem zmiany biegu i rozruchu.

Różnica prędkości silnika i wejścia skrzyni wyznacza poślizg. Przenoszony moment jest ograniczony dociskiem, a moc tarcia wynosi moment razy różnica prędkości kątowej. Odczyt w kW opisuje chwilowe ciepło; model nie liczy temperatury, zużycia okładzin ani ich zależności od nagrzania. Ruszanie przyciskiem przygotowuje półsprzęgło, po czym użytkownik może zmieniać pedał i porównywać obroty.

Koła biegów na wyjściu obracają się swobodnie na łożyskach igiełkowych; piasty są związane z wałem. Stożek i pierścień cierny wyrównują obroty, potem tuleja łączy zęby kłowe koła z piastą. Model pokazuje osobną przesuwkę każdego biegu i powiększone etapy. Drobne końcowe indeksowanie fazy kłów jest wizualne; nie zmienia stanu wałów symulacji.

Pokaz stołowy dyferencjału jest niezależny od jazdy auta i podaje umowne obroty. W FWD używa przedniego mechanizmu. Odsłonięcie satelitów i zakręt pozwalają zobaczyć różnicę obrotów; jazda na wprost naturalnie daje równe prędkości. Otwarty mechanizm działa bez sterownika. Pokaz kończy się przy zmianie widoku, konfiguracji, presetu lub pedałów.

## DCT

K1: biegi 1/3/5, wał wewnętrzny. K2: 2/4/6, wał rurowy. Dwa wały wyjściowe prowadzą do wspólnego wyjścia. Koła są stale zazębione; przesuwka łączy wybrane koło z wałem. Samo przygotowanie biegu na drugiej gałęzi nie przenosi momentu silnika. Dopiero docisk właściwego pakietu pozwala mu przejąć napęd.

Podczas zmiany na drugą gałąź docisk jednego pakietu maleje, a drugiego rośnie. Oba mogą przenosić moment z poślizgiem; model nie blokuje sztywno dwóch przełożeń jednocześnie. Zmiana na tej samej gałęzi otwiera pakiet przed przełożeniem przesuwki. Czas zmiany 1,6 s jest dydaktyczny.

Przełożenia 3,60 / 2,20 / 1,52 / 1,15 / 0,90 / 0,74 i osobne przesuwki każdego biegu są umowne. Model pokazuje zasadę mokrej DCT inspirowanej 02E, bez biegu wstecznego, pełnego zestawu fabrycznych synchronizatorów, map ciśnień, temperatur i zużycia oleju.

## Rozdział napędu

| Tryb | Więzy i działanie |
| --- | --- |
| RWD | Skrzynia, wał i tylny dyferencjał. Przednie koła toczą się biernie. |
| FWD | Napęd przedniej osi. Poprzeczny zespół używa walcowej przekładni głównej; możliwy jest także montaż wzdłużny. |
| 2H | Tył. Przesuwka rozłącza drogę do przedniego wału. |
| 4H | Osie połączone sztywno przez przekładnię łańcuchową; nie ma centralnego dyferencjału. Nie zakładamy równego podziału momentu. |
| 4L | Spięcie osi jak w 4H, dodatkowy idealny reduktor planetarny 2,5:1. Wymagany postój przy przełączaniu. |
| AWD | Otwarty centralny dyferencjał pozwala różnicować obroty osi. Opcjonalna blokada wiąże ich obroty. |
| quattro | Planetarny mechanizm mechaniczny, bazowo 40:60. W tym modelu udział przodu zmienia się w granicach 20–60%, zależnie od oporu osi. |

Quattro pokazuje słońce, wieniec, satelity, jarzmo, śrubowe zęby i elementy cierne. Liczby zębów 24/36/6 realizują przykładową geometrię dla podziału 40:60. Rzeczywiste profile, siły osiowe i opory tarcia nie są obliczane. Nie należy uogólniać wybranego wariantu na wszystkie auta z oznaczeniem quattro. Nie dodano quattro ultra ani tylnego sportowego dyferencjału.

## Hybryda e-CVT

Model przedstawia zasadę planetarnego THS z MG1, silnikiem benzynowym i MG2. MG1 łączy się ze słońcem, silnik z jarzmem, a MG2 i przekładnia główna z wieńcem. Nie ma pasa CVT ani wybieranych par biegów. Obroty spełniają:

`30 × ωMG1 + 78 × ωwyjścia = 108 × ωsilnika`.

W idealnej standardowej geometrii satelity mają 24 zęby. Nie kopiujemy fabrycznych profili, liczby satelitów ani układu konkretnej generacji Priusa. Rzeczywiste konstrukcje mogą mieć korekcję profilu oraz dodatkową redukcję MG2; w późniejszych generacjach maszyny bywają na równoległych osiach.

Bateria zawiera 28 widocznych modułów, styczniki, szyny i osłonę. Pakiet ma stałe 201,6 V oraz umowne 1,3 kWh. Doświadczenie reguluje SOC 20–85%. Napięcie, chemia, temperatura, trwałość i charakterystyka ogniw nie są obliczane. Do ładowania na postoju służy P; N nie przenosi napędu ani rekuperacji.

| Stan | Przepływ |
| --- | --- |
| EV | Bateria → falownik → MG2 → wyjście. Silnik stoi; MG1 może obracać się przeciwnie bez generowania energii. |
| Rozruch | Bateria → falownik → MG1 → uruchamiany silnik. Umowny pobór rozruchu jest osobno widoczny w bilansie. |
| Podział mocy | Silnik → jarzmo → mechaniczne wyjście i MG1. MG1 → falownik → MG2/bateria; bateria pokrywa niedobór lub przyjmuje nadwyżkę. |
| Rekuperacja | Koła → MG2 → falownik → bateria. Limit przyczepności, maszyn i ładowania ogranicza odzysk. Hamulce cierne uzupełniają żądane hamowanie. |
| Ładowanie na P | Silnik → MG1 → falownik → bateria. Wieniec i koła stoją. |

W dodatnim przewodzie DC strzałki przedstawiają umowny kierunek prądu. Przewód powrotny ma kierunek przeciwny; przy ładowaniu oba się odwracają. Trzy przewody AC mają strzałki kierunku **energii**: fazowy prąd przemienny zmienia kierunek, więc nie pokazujemy go jako prądu jednokierunkowego. Animowane strzałki nie są elektronami ani przemieszczającymi się częściami napędu.

Sprawność konwersji jest umownie stała: 92%. Moc DC baterii jest różnicą mocy pobieranej przez MG2 i oddawanej przez MG1. Znak dodatni oznacza rozładowanie. Prąd to moc podzielona przez napięcie, a zmiana energii baterii wynika z całki mocy. Maksymalnie 25 kW rozładowania i 20 kW ładowania; do tego limit 40 kW na torze elektrycznym oraz zakres momentu MG2. Sterowanie jest ilustracyjne, bez map maszyn, pełnej dynamiki bezwładności rozruchu, akcesoriów i fabrycznych algorytmów zarządzania energią.

## Czytelność i weryfikacja

Cały pojazd ma cztery koła, oznaczony przód/tył i skróty do podzespołów. Szczegóły można odsłaniać warstwami lub odizolować. Oddalone drobne części są ukrywane; tryb serwisowy je przywraca. Kompaktowy panel czterech suwów pozostaje widoczny. Pauza zatrzymuje mechanikę i przepływy.

Testy sprawdzają współpracę manuala i DCT, przyczepność i blokady, relację prędkości planetarki, kierunki i bilans energii, ograniczenia przy granicach SOC, wszystkie scenariusze, geometrie i przybliżenia w kombinacjach napędu oraz zdarzenia rzeczywistego interfejsu w DOM. To nie zastępuje kontroli wydajności i obrazu WebGL na docelowym telefonie lub komputerze.
