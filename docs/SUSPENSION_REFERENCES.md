# Zawieszenie: źródła i zakres modelu

Nowa zakładka pokazuje jedną oś i uproszczoną ramę z napędem. Służy porównaniu
prowadzenia kół, sprężynowania i tłumienia. Nie przypisuje pokazywanych konstrukcji
do wszystkich istniejących presetów samochodów.

## Konstrukcje

- [Audi: Front suspension](https://www.audi-technology-portal.de/en/chassis/wheel-suspension-steering/front-suspension):
  MacPherson łączy dolny wahacz z kolumną, która uczestniczy w prowadzeniu koła.
  Konstrukcja wielowahaczowa używa osobnych łączników; przykład pięciowahaczowy
  obejmuje dwa górne, dwa dolne i drążek ustalający zbieżność. Dwa wahacze
  poprzeczne mogą prowadzić koło niezależnie od miejsca umieszczenia sprężyny.
- [ZF: Control Arm](https://www.zf.com/products/en/cars/products_65828.html):
  połączenia ramion ze zwrotnicą i nadwoziem oraz przeguby ustalają tor ruchu koła.
- [ZF / SACHS: Shock Absorbers and Dampers](https://aftermarket.zf.com/us/aftermarket-portal/our-portfolio/passenger-cars/products/shock-absorbers-dampers/):
  sprężyna podpiera masę nadwozia, a amortyzator tłumi jego ruch względem koła.
  Model pokazuje osobno cylinder amortyzatora, tłoczysko oraz sprężynę.
- [Hendrickson: SOFTEK / SNAKE SPRING](https://www.hendrickson-intl.com/getattachment/791609a1-5d15-4f5d-ab63-0e14f77592cd/45745-573.pdf):
  resor współpracuje ze wspólną belką osi; amortyzatory pozostają osobnymi
  elementami. Przykład w aplikacji pokazuje pakiet piór, obejmy, mocowania i wieszak.
- [Honda: Pull-rod](https://global.honda/jp/tech/motorsports/Formula-1/glossary/terms/Pull-rod/)
  oraz [Formula 1: Pull-rod and push-rod suspension](https://www.formula1.com/en/latest/article/explainer-whats-the-difference-between-pull-rod-and-push-rod-suspension.1I3wL4LEL0nQZbKZbx1Dhz):
  pushrod przekazuje ruch przez ściskany popychacz do wyżej położonej dźwigni,
  pullrod przez rozciągane cięgno do niżej położonej dźwigni. W obu przykładach
  koło prowadzą dwa wahacze. To sposoby przekazywania ruchu do elementów
  sprężystych, a nie zamienniki wahaczy. W aplikacji widoczna sprężyna śrubowa
  ułatwia śledzenie ruchu; nie odtwarza drążka skrętnego konkretnego bolidu F1.

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
względnej, a progresywne odboje ograniczają skok.

Opona ma promień 0.33 m, sztywność pionową 190 kN/m i tłumienie 420 N·s/m.
Siła kontaktu jest jednostronna: po oderwaniu koła od drogi wynosi zero.
Grawitacja działa na obie masy. Krok wewnętrzny wynosi maksymalnie 1/600 s.
Nie ma aktywnego sterownika, aerodynamiki, przyspieszeń wzdłużnych, pełnych
czterech kół ani powiązania prędkości tego doświadczenia z prędkością presetów.

Widoczna droga i siły na oponach korzystają z tej samej funkcji wysokości i
pochylenia. Profile obejmują garby, dołki, fale oraz różne przeszkody pod L/P.
Prędkość określa czas przejazdu, a suwak wysokości rzeczywistą amplitudę w metrach.
Animacja powiększa wszystkie odległości czterokrotnie; spowolnienie czasu wybiera
interfejs aplikacji. Pauza zamraża stan zamiast uruchamiać osobny zegar modelu.

Źródła sprawdzone 2026-10-04. Parametry liczbowe są dobrane do doświadczenia
edukacyjnego; nie są danymi homologacyjnymi ani symulacją konkretnego samochodu.
