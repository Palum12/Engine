# Uwagi i realizacja — 4 października 2026

Zapis uwag użytkownika z 3 października, ponowionych w zleceniu 4 października.
Poniższy zakres zaimplementowano i sprawdzono lokalnie. Wyniki, obrazy oraz
granice odwzorowania opisuje [raport odbioru](MECHANISM_AND_SUSPENSION_QA.md).

## 1. Sprzęgło — osobna zakładka

- [x] Zweryfikować przenikanie docisku z pozostałymi elementami podczas całego
  skoku pedału oraz przy składaniu i rozkładaniu modelu.
- [x] Zidentyfikować wystający „języczek”: jasno pokazać, czym jest, do czego
  jest zamocowany i jaką pełni funkcję. Sprawdzić geometrię względem źródeł.
- [x] Dopracować osobną zakładkę sprzęgła: kolejność części, ich rzeczywiste
  punkty podparcia i ruch. Samo zwiększenie odstępów nie rozwiązało niejasności.
- [x] Pokazać osobno nacisk łożyska, ugięcie sprężyny, zmianę siły docisku,
  poślizg tarczy i ostateczne rozłączenie. Użytkownik powinien móc zatrzymać
  każdy etap i obejrzeć go z kilku stron.

## 2. Skrzynia — synchronizatory i wybierak

- [x] Pokazać połączenie sterowania biegiem z wybierakiem, widełkami i tuleją,
  zamiast samego przesuwania części bez widocznej drogi ruchu.
- [x] Wyraźnie pokazać etap synchronizacji obrotów, a potem połączenie koła
  z wałem. Objaśnić rolę stożka, pierścienia, piasty, tulei i zębów kłowych.
- [x] Zweryfikować konstrukcję i geometrię skrzyni określonej przez użytkownika
  jako „DCT F1”: obecny kształt i połączenia są dla niego niezrozumiałe.
  Ustalić konkretny wariant i źródła; nie zakładać, że sama nazwa „F1” opisuje
  konstrukcję. Sprawdzić wały, sprzęgła, koła i układ zmiany biegów.

## 3. Nowa zakładka — zawieszenie i nawierzchnia

- [x] Osobny widok z uproszczonym napędem i szczegółowym zawieszeniem.
- [x] Pokazać MacPhersona, zawieszenie wielowahaczowe, resory piórowe oraz
  układy pushrod i pullrod. Zweryfikować geometrię i sposób ich porównywania.
- [x] Dodać nawierzchnię z dołkami i nierównościami oraz ruch kół i nadwozia.
  Widoczny ruch powinien wynikać z kontaktu z podłożem i modelu zawieszenia.
- [x] Pozwolić obserwować ugięcie, pracę sprężyny i amortyzatora oraz drogę
  przenoszenia sił. Nierówności pod lewym i prawym kołem mogą być różne.

## Odbiór

- Zrozumiała budowa i działanie mają pierwszeństwo przed liczbą detali.
- Obejrzeć rzeczywiste renderowanie w lokalnym Chromium, w tym ruch,
  zatrzymane etapy i zbliżenia. Sprawdzić przenikanie z różnych stron.
- Nie zmieniać źródeł podczas testów przeglądarkowych.
- Dodać odpowiednie testy połączeń i fizyki oraz uzupełnić instrukcje AGENTS.
- Publikację uzgadniać z zakresem następnego polecenia użytkownika.
