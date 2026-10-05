# Zawieszenie: połączenia i czytelność — 05.10.2026

## Powód zmian

Zgłoszone ujęcia zawierały końce ramion i amortyzatorów bez widocznych mocowań,
zbyt małą zwrotnicę dla rozstawionych przegubów oraz dźwignię push/pull, której
bryła nie dochodziła do pinów drążka i sprężyny. Górny prostokąt nie wyjaśniał
powiązania z nadwoziem, a etykiety koła i nawierzchni zasłaniały mechanizm.

Zasady konstrukcji sprawdzono w materiałach producentów i Formula 1.
Źródła oraz granice schematu zapisano w
[SUSPENSION_REFERENCES.md](SUSPENSION_REFERENCES.md).

## Zakres odbioru

Sprawdzenie powinno objąć pięć układów: MacPherson, wielowahacz, resory piórowe,
pushrod i pullrod. Dla każdego ważne są widoczne połączenia zwrotnicy z piastą,
końców wahaczy z ramą i zwrotnicą oraz mocowań sprężyny i amortyzatora.
Pushrod/pullrod wymagają ponadto połączenia drążka z pinem dźwigni, osi dźwigni
z nadwoziem i drugiego pinu ze sprężyną. Połączenia powinny pozostać ciągłe
po przejeździe nierówności i przechyle nadwozia.

Widok karoserii ma pozwalać rozpoznać nadkole, podłogę oraz miejsca przenoszenia
obciążeń. Mniejsza liczba etykiet nie może utrudnić odkrywania mechanizmu:
prawy przycisk myszy na jego siatce powinien otworzyć opis także wtedy,
gdy przełącznik opisów jest wyłączony.

Przegląd zakresu suwaków ujawnił wcześniejsze przestrzelenie progresywnych
ograniczników: przy prędkości 60 km/h, nierówności 15 cm, sztywności 40%
i zerowym tłumieniu względny skok przekraczał 40 cm. Dodano jednostronne
mechaniczne granice 22 cm dobicia i 23 cm odbicia. Reakcja jest rozdzielana
między nadwozie i koło lub sztywną oś, z uwzględnieniem bezwładności przechyłu.
Nieelastyczne uderzenie rozprasza energię przy zachowaniu pionowego pędu;
kontakt opony z drogą pozostaje odrębną jednostronną siłą.

Dłuższy przejazd falistej drogi przy zerowym tłumieniu ujawnił także obrót
nadwozia poza zakresem uproszczonego prowadzenia. Lekcja ma teraz zakres
przechyłu nadwozia i sztywnej osi ±0,25 rad. Granica rozprasza ruch skierowany
poza zakres, nie wprowadza energii ani nie zastępuje pełnej symulacji wywrotki.
W tym zakresie oba drążki push/pull zachowują stałą długość, a sprężyny skracają
się wraz z dobiciem koła. Dźwignia i drążek mają osobne zbliżenie dostępne tylko
dla tych dwóch konstrukcji; mocowania nadwozia można obejrzeć niezależnie.

## Wyniki weryfikacji

Odbiór lokalny zakończono 5 października 2026:

- `npm test`: 206/206. Nowe testy sprawdzają rzeczywiste końce ramion,
  mocowania zwrotnicy i piasty, oczy amortyzatorów, sztywną dźwignię,
  stałą długość drążków i skracanie sprężyn podczas dobicia. Osobno
  sprawdzono ograniczniki, pionowy pęd, rozpraszanie energii, sztywną oś
  resorów i 30-sekundowy rezonans przy wyłączonym tłumieniu.
- `npm run build`: sukces. Pozostało wcześniejsze ostrzeżenie o wielkości
  pakietu Three.js; nie jest błędem kompilacji.
- Chromium z WebGL/SwiftShader: przeszło sprawdzenie wszystkich zakładek
  oraz końcowy scenariusz pięciu zawieszeń. Sprawdzono etykiety włączone
  i wyłączone, przejazd różnej nawierzchni pod kołami, zbliżenia wahaczy,
  drążków i dźwigni oraz odizolowane układy push/pull.
- Prawy klik na rzeczywistą siatkę amortyzatora otworzył krótki opis
  przy wyłączonych etykietach, w zwykłym widoku i na pełnym ekranie.
  Przeciągnięcie prawym przyciskiem nadal przesuwa kamerę; powrót kursora
  do początku przeciągnięcia nie otwiera opisu.
- Układ telefonu 390 × 844: brak poziomego przewijania strony,
  widoczna zakładka zawieszenia i najwyżej cztery krótkie etykiety.

Obejrzano końcowe obrazy pięciu konstrukcji, zbliżenia wielowahacza i obu
dźwigni, opisy w obu trybach ekranu oraz widok telefonu. Wcześniejsze
zbliżenie pullroda odrzuciłem: koło zasłaniało jego niską dźwignię.
Końcowa kamera patrzy od ujemnego X, wzdłuż osi obrotu dźwigni;
widać sprężynę, ramiona dźwigni, piny i połączenie z drążkiem.
Odizolowanie pozostaje opcjonalne. Przejrzyste nadkola i podłoga pokazują
kontekst karoserii, a lokalne mocowania pozostają przy wybranym mechanizmie.

Końcowe zrzuty są w
`artifacts/suspension-final/browser-suspension-body-mo-235a4--descriptions-stay-readable/`,
m.in. `multilink-connections.png`, `pullrod-connections.png`,
`pullrod-actuation-isolated.png`, `right-click-description-labels-off.png`,
`right-click-fullscreen.png` i `pushrod-phone.png`.
Logi: `artifacts/suspension-tests-final.log`,
`artifacts/suspension-build-final.log`,
`artifacts/suspension-browser-final.log` (wszystkie zakładki),
`artifacts/suspension-browser-accepted.log` (końcowe zawieszenie).
Pliki QA są lokalne i ignorowane przez Git.

Niezależny przegląd rzeczywistych transformacji Three.js sprawdził ponadto
30 s przejazdu falistej drogi o wysokości 15 cm przy zerowym tłumieniu,
dla 100% sztywności i 18 km/h oraz 250% i 30 km/h, w obu układach push/pull.
Nie pojawił się stan poza zasięgiem drążka. Maksymalny błąd jego długości wyniósł
4,9 × 10⁻¹⁵ jednostki sceny, a błąd położenia oka amortyzatora 2,1 × 10⁻¹⁵.
Przechył osiągał granicę 0,25 rad, bez dalszego obrotu. Sprawdzano końce
rzeczywistych siatek po transformacjach, nie samą zgodność deklarowanych punktów.

## Granice modelu

To porównanie jednej osi o wspólnych parametrach fizycznych. Wymiary mocowań,
kształt karoserii i ramy są ilustracyjne. Ciągłe wizualne połączenia nie oznaczają
pełnego rozwiązania przestrzennej kinematyki, zmiennej zbieżności ani odtworzenia
fabrycznego zawieszenia wybranego presetu. Sprężyna śrubowa w push/pull wyjaśnia
dźwignię i nie jest dokładnym układem drążków skrętnych współczesnego bolidu F1.
Wyniki Chromium nie zastępują sprawdzenia wydajności na GPU i fizycznych gestów
touchpada użytkownika. W tej sesji nie wykonywano publikacji.
