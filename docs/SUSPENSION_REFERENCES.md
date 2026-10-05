# Zawieszenie: źródła i zakres modelu

Zakładka pokazuje jedną oś z przekrojem nadwozia, punktami mocowania i uproszczonym
napędem. Służy porównaniu prowadzenia kół, sprężynowania i tłumienia. Nie przypisuje
pokazywanych konstrukcji do istniejących presetów samochodów.

## Konstrukcje

- [Audi: Front suspension](https://www.audi-technology-portal.de/en/chassis/wheel-suspension-steering/front-suspension):
  MacPherson łączy dolny wahacz z kolumną, która uczestniczy w prowadzeniu koła.
  Konstrukcja wielowahaczowa używa osobnych łączników; przykład pięciowahaczowy
  obejmuje dwa górne, dwa dolne i drążek ustalający zbieżność. Dwa wahacze
  poprzeczne mogą prowadzić koło niezależnie od miejsca umieszczenia sprężyny.
- [ZF: Control Arm](https://www.zf.com/products/en/cars/products_65828.html):
  połączenia ramion ze zwrotnicą i nadwoziem oraz przeguby ustalają tor ruchu koła.
- [Audi: A6, Suspension](https://www.audi.com/en/the-audi-a6-until-2025-the-car-of-many-talents-in-the-business-class-10240/sportiness-10255):
  ramiona pięciowahaczowych osi łączą się z nadwoziem przez ramy pomocnicze.
  Sposób mocowania ramy może być różny na obu osiach. Źródło uzasadnia pokazanie
  oddzielnych wahaczy, ramy pomocniczej i nadwozia; nie dostarcza wymiarów modelu.
- [ZF / SACHS: Shock Absorbers and Dampers](https://aftermarket.zf.com/us/aftermarket-portal/our-portfolio/passenger-cars/products/shock-absorbers-dampers/):
  sprężyna podpiera masę nadwozia, a amortyzator tłumi jego ruch względem koła.
  Model pokazuje osobno cylinder amortyzatora, tłoczysko oraz sprężynę.
- [Hendrickson: SOFTEK / SNAKE SPRING](https://www.hendrickson-intl.com/getattachment/791609a1-5d15-4f5d-ab63-0e14f77592cd/45745-573.pdf):
  resor współpracuje ze wspólną belką osi; amortyzatory pozostają osobnymi
  elementami. Przykład w aplikacji pokazuje pakiet piór, obejmy, mocowania i wieszak.
  Dokument producenta przedstawia także resor jednopiórowy; pakiet w aplikacji
  jest schematem zasady działania, a nie kopią produktu SNAKE SPRING.
- [Honda: Pull-rod](https://global.honda/jp/tech/motorsports/Formula-1/glossary/terms/Pull-rod/)
  oraz [Formula 1: Pull-rod and push-rod suspension](https://www.formula1.com/en/latest/article/explainer-whats-the-difference-between-pull-rod-and-push-rod-suspension.1I3wL4LEL0nQZbKZbx1Dhz):
  pushrod przekazuje ruch przez ściskany popychacz do wyżej położonej dźwigni,
  pullrod przez rozciągane cięgno do niżej położonej dźwigni. W obu przykładach
  koło prowadzą dwa wahacze. To sposoby przekazywania ruchu do elementów
  sprężystych, a nie zamienniki wahaczy. W aplikacji widoczna sprężyna śrubowa
  ułatwia śledzenie ruchu; nie odtwarza drążka skrętnego konkretnego bolidu F1.
- [McLaren: MCL60 technical specification](https://www.mclaren.com/racing/formula-1/2023/car-launch/mclaren-mcl60-technical-specification/):
  dokumentacja bolidu potwierdza umieszczenie sprężyny, amortyzatora i drążka
  skrętnego wewnątrz konstrukcji oraz uruchamianie ich przez pushrod lub pullrod.
  Pokazuje, dlaczego model edukacyjny nie powinien utożsamiać widocznego
  coilovera z dokładnym rozwiązaniem konkretnego auta F1.

## Mocowania i kontekst nadwozia

Przekrój karoserii ma wyjaśniać, gdzie kończy się zawieszenie: wewnętrzne
przeguby wahaczy łączą się z ramą pomocniczą, górne mocowania kolumn i
amortyzatorów z konstrukcją nadwozia, a zewnętrzne przeguby ze zwrotnicą.
Sprężyna musi mieć widoczne dwa oparcia. W pushrodzie i pullrodzie połączenie
prowadzi od zwrotnicy przez ukośny drążek i dźwignię do wewnętrznej sprężyny
z amortyzatorem. Oś obrotu dźwigni i nieruchomy koniec coilovera należą do nadwozia.

To projekt ilustracyjny wyprowadzony z zasad opisanych w źródłach, bez
odtwarzania wymiarów fabrycznych. Karoseria pozostaje przekrojem jednej osi;
nie dodajemy drugiej osi ani osobnej dynamiki samochodu. Bryła nadwozia,
mocowania i ruchome części muszą korzystać z tego samego pionowego ruchu
i przechyłu `SuspensionSimulation`.

Wielowahacz pokazuje pięć osobnych łączników i ich przeguby. Poszczególne
końce mogą być rozsunięte dla czytelności, ale muszą mieć fizyczne wsporniki
zwrotnicy i ramy. Popychacz nie zastępuje wahacza. Uproszczona geometria
przestrzenna nie uzasadnia pozostawiania końców ramion, amortyzatorów ani
sprężyn bez widocznych mocowań.

## Dynamika i świadome uproszczenia

`SuspensionSimulation` ma wspólne nadwozie o masie 720 kg, jego pionowy ruch i
przechył oraz dwa koła z masą nieresorowaną. Niezależne zawieszenia mają po 42 kg
na koło. W resorach wspólna sztywna oś ma 130 kg i dwa stopnie swobody: ruch
pionowy oraz obrót. Wymiary ramion są ilustracyjne. Geometria nie jest pełnym
rozwiązaniem przestrzennych więzów, zbieżności, pochylenia i skrętu zwrotnicy.

Wszystkie konstrukcje mają tę samą wyjściową sztywność przy kole (25 kN/m) i
tłumienie (1.8 kN·s/m), aby różnica układu części nie sugerowała automatycznie
lepszych osiągów jednej konstrukcji. Dźwignie push/pull są schematem ruchu;
fizyka używa parametrów przeliczonych na koło, bez symulacji ugięcia popychaczy.
Zmiana sztywności zachowuje statyczną wysokość poprzez odpowiednie napięcie
wstępne. Sprężyna przenosi siłę zależną od ugięcia, amortyzator od prędkości
względnej. Mechaniczne ograniczniki dopuszczają maksymalnie 22 cm dobicia
i 23 cm odbicia względem położenia spoczynkowego. Reakcja ogranicznika jest
jednostronna i uwzględnia masy nadwozia, koła lub wspólnej osi oraz bezwładności
przechyłu. Uderzenie jest nieelastyczne: zachowuje pionowy pęd całego układu,
a część energii ruchu rozprasza. Korekta resorów zachowuje wspólne stopnie
swobody sztywnej osi. W funkcji sił pozostaje progresywna reakcja dla penetracji
ogranicznika; więzy skoku zapobiegają dużemu przestrzeleniu, które wcześniej
pojawiało się przy małej sztywności i zerowym tłumieniu.

Przechył nadwozia i sztywnej osi ograniczono do ±0,25 rad (około ±14,3°).
To zakres tej lekcji z pionowym ruchem kół, w którym uproszczone prowadzenie
i drążki push/pull zachowują ciągłe połączenia. Na granicy nieelastyczny
ogranicznik usuwa ruch obrotowy skierowany dalej poza zakres, bez dodawania
energii. Nie oznacza to fizycznego kąta przewrócenia konkretnego auta ani
fabrycznego ogranicznika jego karoserii. Model nie symuluje wywrotki, kolizji
nadwozia z drogą ani pełnej przestrzennej kinematyki. Bez tego ograniczenia
rezonans przy zerowym tłumieniu pozwalał wcześniejszemu schematowi obracać
nadwozie wielokrotnie przez okresowy człon `sin(roll)`.

Opona ma promień 0.33 m, sztywność pionową 190 kN/m i tłumienie 420 N·s/m.
Siła kontaktu jest jednostronna: po oderwaniu koła od drogi wynosi zero.
Ograniczniki zawieszenia nie zastępują kontaktu opony i nie dociskają jej do drogi.
Grawitacja działa na obie masy. Krok wewnętrzny wynosi maksymalnie 1/600 s.
Nie ma aktywnego sterownika, aerodynamiki, przyspieszeń wzdłużnych, pełnych
czterech kół ani powiązania prędkości tego doświadczenia z prędkością presetów.

Widoczna droga i siły na oponach korzystają z tej samej funkcji wysokości i
pochylenia. Profile obejmują garby, dołki, fale oraz różne przeszkody pod L/P.
Prędkość określa czas przejazdu, a suwak wysokości rzeczywistą amplitudę w metrach.
Animacja powiększa wszystkie odległości czterokrotnie; spowolnienie czasu wybiera
interfejs aplikacji. Pauza zamraża stan zamiast uruchamiać osobny zegar modelu.

Źródła konstrukcji i mocowań ponownie sprawdzone 2026-10-05. Parametry liczbowe są dobrane do doświadczenia
edukacyjnego; nie są danymi homologacyjnymi ani symulacją konkretnego samochodu.
