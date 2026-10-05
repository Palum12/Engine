# Czytelność nawigacji — 05.10.2026

Główny pasek ma osiem widoków: Silnik, Cylinder, Napęd, Sprzęgło,
Skrzynia, Dyferencjał, Hybryda i Zawieszenie. Rozrząd, olej, paliwo,
turbo oraz rozdział AWD/4WD są zbliżeniami w Napędzie. Zwykły i szczegółowy
napęd połączono w jedną zakładkę. Nazwy sprzęgła i skrzyni nadal zależą
od wybranej przekładni.

Pasek nie przewija się poziomo. Jego siatka dobiera liczbę kolumn do
szerokości panelu, a wysokość rośnie wraz z liczbą rzędów. Zawieszenie
ma własny widoczny przycisk również na telefonie i pełnym ekranie.

Wybór silnika ma dziewięć krótkich nazw. Boxer 4 usunięto z nagłówka;
wewnętrzny model pozostaje potrzebny do prawidłowego presetu Subaru WRX.
Metadane silnika są osobnym rzędem. Zniesiono stare ograniczenie
`max-width:58%`, które przycinało Boxer 6 mimo usunięcia jednego przycisku.

## Weryfikacja

- Ostatni pełny `npm test`: 194/194. Rzeczywisty interfejs sprawdza nowe
  zakładki, zachowane zbliżenia oraz preset Subaru, z LF i CRLF.
- Końcowy `npm run build`: powodzenie; pozostaje ostrzeżenie Vite o
  rozmiarze pakietu Three.js.
- Chromium: scenariusze wszystkich zakładek i wszystkich presetów przeszły
  w `artifacts/navigation-final` (2/2). Test czytelności wymagał poprawki
  pełnego ekranu; końcowe powtórzenie w `artifacts/navigation-verified`
  zakończyło się powodzeniem (1/1, 5,9 minuty).

Nowy test przeglądarki sprawdza rozmiary 1920 × 1080, 1440 × 900,
1280 × 800, 1024 × 768, 768 × 1024, 390 × 844 i 360 × 780.
Mierzy pełne nazwy zakładek i silników w ich przyciskach, granice
kontenerów, brak przewijania poziomego oraz dostępność zawieszenia.
Pełny ekran zawieszenia jest sprawdzany na komputerze, tablecie i telefonie.
Pozostałe wybrane testy przełączają wszystkie zakładki i presety samochodów.

Pierwszy przebieg przerwano po wykryciu przycięcia Boxer 6 na rzeczywistym
obrazie. Poprawiono ograniczenie szerokości i rozszerzono test o pełne
nazwy silników. Kolejny przebieg wykrył obszar modelu zawieszenia o wysokości
52 px na pełnym ekranie. Ogólna reguła używała ośmiu nazwanych obszarów
siatki, a zawieszenie pięciu wierszy. Widok zawieszenia ma teraz jawne
pięć obszarów również w pełnym ekranie, z odpowiednią specyficznością CSS.
Podczas przebiegów Chromium nie zmieniano źródeł aplikacji.
Zrzuty i logi znajdują się w ignorowanym przez Git katalogu `artifacts/`.

Otworzono i obejrzano obrazy nagłówka przy 1280 px, menu na komputerze
i telefonie oraz pełnego ekranu zawieszenia przy 768 i 390 px. Wszystkie
nazwy mieszczą się w przyciskach, a zawieszenie ma widoczny model i telemetrię.
Chromium używa SwiftShader; wydajność sprzętowego GPU wymaga osobnego
sprawdzenia na docelowym urządzeniu. Zmiany przygotowano lokalnie.
