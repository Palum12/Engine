# Sprzęgło i synchronizator — model dydaktyczny

Sprawdzone 4 października 2026. Ten model objaśnia zasadę działania;
nie odtwarza konkretnej skrzyni ani wysprzęglika Seata.

## Źródła producentów

- [ZF SACHS: sprzęgła i układy wysprzęglania](https://aftermarket.zf.com/en/aftermarket-portal/our-portfolio/passenger-cars/products/clutches/).
  Wysprzęglik koncentryczny łączy siłownik z łożyskiem i pracuje bez widełek.
  Pedał uruchamia hydraulikę, a łożysko naciska palce sprężyny talerzowej.
- [ZF SACHS: problemy z rozłączaniem sprzęgła](https://aftermarket.zf.com/en/aftermarket-portal/for-workshops/useful-tips/clutches/clutch-does-not-disengage/).
  Nadmierny skok może doprowadzić do kontaktu sprężyny talerzowej z tłumikiem
  tarczy. Geometria aplikacji musi zostawić prześwit również przy pełnym pedale.
- [ZF SACHS: poślizg sprzęgła](https://aftermarket.zf.com/en/aftermarket-portal/for-workshops/useful-tips/clutches/clutch-slipping/).
  Niewystarczający docisk powoduje poślizg i wydzielanie ciepła. Zmiana siły
  następuje przed widocznym otwarciem szczeliny między powierzchniami.
- [Schaeffler INA: synchronizacja jedno- i wielostożkowa, str. 6–10](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/api/downloads_13/api06_de_en.pdf).
  Przesuwka przez elementy dociskowe uruchamia tarcie stożka. Pierścień blokuje
  przedwczesne połączenie; po wyrównaniu obrotów tuleja przechodzi przez jego
  zęby i zazębia się z wieńcem kłowym koła.
- [Schaeffler: układy wybierania i synchronizatory](https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/symposia_1/downloads_11/Schaeffler_Kolloquium_2010_05_en.pdf).
  Przesuwka, piasta i elementy dociskowe tworzą układ synchronizacji; ruch
  mechanizmu wybierania dociera do tulei przez widełki.

## Geometria i świadome uproszczenia

- Sprzęgło przedstawia docisk ze sprężyną talerzową i koncentryczny siłownik
  hydrauliczny. Nie ma niepodpartej dźwigni wyciskowej. Pokrywa i siłownik są
  osobnymi, nazwanymi częściami. Kolorowe wystające znaczniki fazy usunięto.
- Otwarta pokrywa pozwala obejrzeć podparcie sprężyny. Jej pierścień znajduje
  się poza obrysem docisku; otwór docisku mieści sprężyny tłumiące tarczy.
  Wewnętrzne palce nie przechodzą przez docisk w żadnym położeniu pedału.
- `manualClutchState` nadal wspólnie steruje fizyką i modelem. Rozstrzelenie
  jest tylko rysunkiem montażowym. Podczas rozstrzelenia znikają rozciągnięte
  metalowe łączniki, a tłok siłownika jest pokazywany jako oddzielny element.
- Rzeczywiste skoki są znacznie mniejsze. Układ hydrauliczny nie oblicza
  ciśnienia ani objętości płynu; pokazuje kierunek i ciągłość przenoszenia ruchu.
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
