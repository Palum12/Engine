# Sprzęgło i synchronizator — model dydaktyczny

Sprawdzone 7 października 2026. Ten model objaśnia zasadę działania;
nie odtwarza konkretnej skrzyni ani wysprzęglika Seata.

## Źródła producentów

- [ZF SACHS: sprzęgła i układy wysprzęglania](https://aftermarket.zf.com/en/aftermarket-portal/our-portfolio/passenger-cars/products/clutches/).
  Wysprzęglik koncentryczny łączy siłownik z łożyskiem i pracuje bez widełek.
  Pedał uruchamia hydraulikę, a łożysko naciska palce sprężyny talerzowej.
- [ZF: budowa sprzęgła](https://www.zf.com/products/en/cv/products_65885.html).
  Pokrywa jest przykręcona do koła zamachowego. Sprężyna talerzowa zaciska
  ruchomą osiowo płytę dociskową na tarczy i kole zamachowym. Tarcza przekazuje
  moment na wał wejściowy skrzyni.
- [Valeo: zespół pokrywy i docisku](https://www.valeoservice.co.uk/en-uk/passenger-car/car-clutch-replacement-parts/pressure-plate-cover-assembly).
  Sprężyna talerzowa wytwarza zacisk; płyta dociskowa stanowi powierzchnię
  cierną i odprowadza ciepło.
- [ZF: hydrauliczny układ wysprzęglania](https://aftermarket.zf.com/en/aftermarket-portal/knowledge-hub/bleeding-clutch-actuations/).
  Pedał uruchamia pompę, płyn przekazuje nacisk do wysprzęglika. Wariant
  koncentryczny działa bezpośrednio, bez zewnętrznej dźwigni i widełek.
- [ZF SACHS: problemy z rozłączaniem sprzęgła](https://aftermarket.zf.com/en/aftermarket-portal/for-workshops/useful-tips/clutches/clutch-does-not-disengage/).
  Nadmierny skok może doprowadzić do kontaktu sprężyny talerzowej z tłumikiem
  tarczy. Geometria aplikacji musi zostawić prześwit również przy pełnym pedale.
  Tarcza musi przesuwać się po wielowypuście wału; odkształcone sprężyste taśmy
  obwodowe ograniczają unoszenie płyty dociskowej.
- [ZF SACHS: poślizg sprzęgła](https://aftermarket.zf.com/en/aftermarket-portal/for-workshops/useful-tips/clutches/clutch-slipping/).
  Niewystarczający docisk powoduje poślizg i wydzielanie ciepła. Zmiana siły
  następuje przed widocznym otwarciem szczeliny między powierzchniami.
- [Schaeffler: rozwój konstrukcji sprzęgieł](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/symposia_1/downloads_11/Schaeffler_Kolloquium_2010_03_en.pdf).
  Sprężyste taśmy łączą płytę dociskową z pokrywą i pozwalają na ruch osiowy;
  materiał omawia je w kontekście sprzęgieł samonastawnych.
- [Schaeffler INA: synchronizacja jedno- i wielostożkowa, str. 6–10](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/api/downloads_13/api06_de_en.pdf).
  Przesuwka przez elementy dociskowe uruchamia tarcie stożka. Pierścień blokuje
  przedwczesne połączenie; po wyrównaniu obrotów tuleja przechodzi przez jego
  zęby i zazębia się z wieńcem kłowym koła.
- [Schaeffler: układy wybierania i synchronizatory](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/symposia_1/downloads_11/Schaeffler_Kolloquium_2010_05_en.pdf).
  Przesuwka, piasta i elementy dociskowe tworzą układ synchronizacji; ruch
  mechanizmu wybierania dociera do tulei przez widełki.

## Geometria i świadome uproszczenia

- Model przedstawia suche sprzęgło jednotarczowe z naciskowym mechanizmem
  wysprzęglania. Zwolniony pedał pozwala sprężynie zaciskać tarczę. Wciśnięcie
  pedału przesuwa łożysko i palce sprężyny, odciąża docisk i otwiera szczelinę.
  Pedał służy do zwalniania zacisku; nie wytwarza siły zaciskającej tarczę.
- Sprzęgło przedstawia docisk ze sprężyną talerzową i koncentryczny siłownik
  hydrauliczny. Nie ma niepodpartej dźwigni wyciskowej. Pokrywa i siłownik są
  osobnymi, nazwanymi częściami. Kolorowe wystające znaczniki fazy usunięto.
- Otwarta pokrywa pozwala obejrzeć podparcie sprężyny. Jej pierścień znajduje
  się poza obrysem docisku; otwór docisku mieści sprężyny tłumiące tarczy.
  Wewnętrzne palce nie przechodzą przez docisk w żadnym położeniu pedału.
- `manualClutchState` nadal wspólnie steruje fizyką i modelem. Rozstrzelenie
  jest tylko rysunkiem montażowym. Podczas rozstrzelenia znikają rozciągnięte
  metalowe łączniki, a tłok siłownika jest pokazywany jako oddzielny element.
- Pokrywa jest połączona z kołem zamachowym śrubami, a docisk z pokrywą
  sprężystymi taśmami. Pierścień podparcia wyjaśnia pracę sprężyny talerzowej.
  Koło zamachowe, pokrywa, sprężyna i docisk wirują z silnikiem także po
  wysprzęgleniu. Tarcza, jej piasta i wielowypust wału wejściowego wirują razem.
  Korpus siłownika i prowadnica pozostają nieruchome; oprawa łożyska przesuwa
  się osiowo, a jego wirujący pierścień styka się ze sprężyną.
- Okno przekroju sprzęgła pozostaje od strony obserwacji, żeby stale odsłaniać
  mechanizm. Jest umownym sposobem prezentacji, a nie otworem w obracającej się
  części. W rozstrzelonym rysunku montażowym obroty są zatrzymane i znikają
  oznaczenia styku; po złożeniu wraca prezentacja pracy mechanizmu.
- Rzeczywiste skoki są znacznie mniejsze. Układ hydrauliczny nie oblicza
  ciśnienia ani objętości płynu; pokazuje kierunek i ciągłość przenoszenia ruchu.
- Pedał ma umowny zakres `0–1`. W `src/manual-clutch.js` względny zacisk maleje
  według wygładzonej krzywej do zera przy `0,72`. Dopiero dalszy ruch otwiera
  widoczną szczelinę. Próg `0,85` jest osobną blokadą rozruchu i zmiany biegu;
  nie określa, czy sprzęgło jeszcze przenosi moment.
- Maksymalny ruch docisku `plateGap = 0,28` i odsunięcie tarczy
  `discFloat = 0,08` to powiększone odległości w jednostkach modelu.
  Nie są wymiarami w metrach ani milimetrami konkretnego sprzęgła.
- Zdolność przenoszenia momentu wynosi `260 N·m × (moment silnika / 170 N·m)
  × względny zacisk`, a umowna siła `5200 N × (moment silnika / 170 N·m)
  × względny zacisk`. Są to kalibracje dydaktyczne. Nie używamy zmierzonych
  charakterystyk OEM siły sprężyny, nacisku pedału ani skoków mechanizmu.
  Model pomija dynamikę płynu, temperaturę, zużycie i osobne drgania skrętne
  sprężyn tłumiących tarczy; moc poślizgu objaśnia tempo wydzielania ciepła.
- Skrzynia używa osobnego wodzika i tulei dla każdego biegu. Typowe konstrukcje
  współdzielą tuleję i wodzik między dwoma biegami. Pięć równoległych wodzików
  ułatwia śledzenie połączenia dźwignia → wodzik → widełki → tuleja.
- Zbliżenie synchronizatora pokazuje wycięty fragment koła i stożków, a nie
  dodatkową skrzynię. Obroty oraz etap zmiany pozostają stanem `Simulation`.
  Stożek jest dociskany przed zazębieniem; niewielkie końcowe indeksowanie zębów
  jest ilustracją, bez osobnej symulacji kontaktów każdego zęba.
- Okno przekroju tulei, piasty i stożków pozostaje otwarte od strony obserwacji.
  Widoczne zęby wielowypustu nadal obracają się z wałem. Obracanie całego wycięcia
  wcześniej zasłaniało mechanizm w przypadkowej fazie zatrzymania.
- Izolacja pokrywy pokazuje samą pokrywę i jej podparcie, bez oderwanych końców
  sprężyny oraz taśm docisku.

## Integracja

`DrivetrainModel.setSection('selector')` wybiera mechanizm wodzików.
`setSection('synchronizer')` pokazuje przekrój pakietu, a
`setSynchronizerGear(1..5)` wybiera obserwowany bieg. Odpowiadają im
`bounds('selector')` i `bounds('synchronizer')`. Powrót do `all` odtwarza
pełne koła, wały, pokrywę, wodziki i mechanizm dźwigni.
