# Sprzęgło: połączenia, przekrój i wydajność — 08.10.2026

## Zgłoszenie i poprawiona geometria

Po odbiorze z 7 października użytkownik wskazał wystające, niepodparte
elementy oraz bardzo wolne działanie zakładki. Poprzednie oględziny i testy
brył ograniczających nie wychwyciły narożników detali w różnych fazach obrotu.
Ten raport dotyczy kolejnej poprawki, nie zmienia wyników historycznego odbioru.

- Sprężyna talerzowa ma ciągłą zewnętrzną powierzchnię stożkową. Jej obrzeże
  pozostaje na tylnej powierzchni docisku przez cały skok pedału. Obie strony
  podparcia mają żebra połączone z pokrywą. Prostokątne palce i żebra zachowują
  stabilną orientację przekroju zamiast obracać szerokie narożniki wokół osi.
- Sprężyny tłumiące tarczy mieszczą się w otwartych oknach z gniazdami końców
  i żebrami łączącymi piastę z pierścieniem nośnym okładzin. Nie przechodzą
  przez pełną płytę ani nie zostają po wycięciu swojego podparcia.
- Wewnętrzne zęby piasty współpracują z krótkim wielowypustem wału. Zakończenie
  wielowypustu pozostaje przed nieruchomą tuleją prowadzącą, także przy
  przesunięciu wysprzęglonej tarczy.
- Przekrój przycina rzeczywiste narożniki, zwoje i taśmy na wspólnych, stałych
  płaszczyznach. Prostokątne elementy dostają zamknięte powierzchnie cięcia.
  Wyłączenie przekroju przywraca pełną geometrię. Rozstrzelenie nadal jest
  osobnym, nieruchomym układem; nie rozciąga taśm ani sprężyny między warstwami.

Zasada działania i granice odwzorowania pozostają opisane w
[MANUAL_MECHANISM_REFERENCES.md](MANUAL_MECHANISM_REFERENCES.md).

## Ograniczenie pracy podczas animacji

Scena aktualizuje macierze widocznych obiektów. Ukryte zespoły nie przechodzą
ponownie pełnego drzewa przy każdym renderowaniu; jawne aktualizacje dla
kadrowania i wybierania części pozostają dostępne. Ukryta skrzynia pomija
animację swoich mechanizmów, a ukryte sprzęgło obliczenia przekroju.

Etykiety korzystają z bieżących położeń sceny i pamiętają zmierzone wymiary.
Zmiana tekstu, rozmiaru okna lub załadowanie fontów unieważnia ten zapis.
Niezmieniona klatka nie zapisuje ponownie tych samych atrybutów. Usunięto
rozmywanie tła każdej etykiety nad poruszającym się płótnem WebGL, zachowując
czytelne tło, obramowanie i opisy pod prawym przyciskiem.

Bufory dokładnie przyciętej geometrii są używane ponownie. Dane lokalnego
położenia, płaszczyzn i obwiedni są buforowane; pełne lub niewidoczne trójkąty
nie przechodzą kosztownego przycinania wielokątów.

## Metoda pomiarów i dowody

Punkt odniesienia to `d06ddd7a09eb9a10a39f1a77e676968d75167138`.
Pomiar Node buduje tę samą scenę R4/manual ze wszystkimi zespołami i liczy
rzeczywiste wywołania `Object3D.updateMatrix`, niezależnie od użytego API
macierzy świata. Nie należy porównywać starego licznika `updateMatrixWorld`
z nowym `updateWorldMatrix`: są to różne metody. Czasy pierwszego pomiaru
Node miały równoległe obciążenie testami i budowaniem. Końcowy pomiar poniżej
odbył się już bez tych prac: po 1000 klatek rozgrzewki dla każdego wariantu,
w siedmiu naprzemiennych rundach po 500 klatek. Czas dotyczy wyłącznie
aktualizacji modelu napędu i przygotowania macierzy, bez fizyki, DOM i GPU.

| Widok | Operacje macierzy na klatkę, przed → po | Mediana CPU, przed → po |
| --- | ---: | ---: |
| Sprzęgło, pedał zwolniony | 5176 → 199 | 2,07 → 0,29 ms |
| Sprzęgło, pedał wciśnięty | 5176 → 197 | 1,48 → 0,32 ms |
| Skrzynia | 5176 → 579 | 2,05 → 0,23 ms |

To około 96,2% mniej operacji macierzy w sprzęgle, a nie deklaracja takiego
samego przyspieszenia całej aplikacji. Końcowe dane zawiera `matrix-cost.json`;
profile `clip-profile-before.json` i `clip-profile-after.json` dokumentują
ograniczenie kosztu nowego dokładnego przycinania, zachowując kształt przekroju.

Pomiary Chromium używają jednego okna, widoku 1440 × 1000, rozgrzewki 3,5 s
i próbkowania 5 s. Sprawdzają silnik, sprzęgło podczas pracy i pauzy z
etykietami włączonymi/wyłączonymi oraz skrzynię. Dodatkowa próba używa
domyślnego renderera Chromium. Oba dostępne warianty uruchamiają programowy
WebGL SwiftShader; to nie jest pomiar na karcie graficznej użytkownika.
Mała liczba klatek i zmienny koszt renderowania programowego nie pozwalają
obiecać konkretnego FPS na jego urządzeniu.

Pomiary odbywają się przed zrzutami ekranu. Zrzut elementu wyższego od okna
może chwilowo zmieniać rozmiar viewportu i wysokość zależną od `dvh`;
dlatego końcowy pomiar zapisuje rzeczywiste wymiary sceny i bufora WebGL.
Duże ujęcia pełnoekranowe służą ocenie połączeń, a nie porównaniu FPS.

Końcowy przebieg potwierdził scenę i bufor WebGL 1048 × 524 przy DPR 1.
Poniżej mediany czasu samego wywołania `EngineScene.render`, obejmującego
aktualizacje modeli i wywołanie renderera, ale nie całą klatkę aplikacji:

| Przypadek, etykiety włączone | Przed | Po |
| --- | ---: | ---: |
| Aktywne sprzęgło, wymuszony SwiftShader | 8,2 ms | 12,2 ms |
| Sprzęgło podczas pauzy, wymuszony SwiftShader | 7,8 ms | 3,0 ms |
| Skrzynia, wymuszony SwiftShader | 16,3 ms | 6,1 ms |
| Aktywne sprzęgło, domyślny renderer Chromium | 6,4 ms | 5,3 ms |

Sama obsługa etykiet aktywnego sprzęgła spadła z około 1,7 do 0,4 ms
w wymuszonym wariancie. Aktywny model w tym samym przebiegu miał gorszy czas
wywołania niż przed zmianą; krótkie próby programowego WebGL dawały zmienne
wyniki (domyślny wariant także używał SwiftShader). Nie potwierdzamy na tej
podstawie stałego przyspieszenia całej klatki ani określonego FPS.
Ograniczenie zbędnych operacji i kosztu przygotowania modelu potwierdza
osobny pomiar Node powyżej. Wyniki Chromium są w `final/metrics.json` i
`final-default/metrics.json`, wraz z wymiarami, profilami i licznikami.

Logi, profile i obrazy są lokalne, ignorowane przez Git:
`artifacts/clutch-oct8/` oraz `.cache/clutch-work/`. Źródła aplikacji są
zamrożone podczas każdego przebiegu przeglądarkowego. Obrazy pierwszej
poprawki są w `after/` i `after-default/`; końcowy przebieg po ograniczeniu
kosztu przycinania zapisuje wyniki w `final/`, `final-default/` i `browser/`.

## Sprawdzenie końcowych źródeł

- `npm test`: 223/223, bez błędów.
- `npm run build`: sukces. Pozostaje istniejąca informacja Vite o rozmiarze
  pakietu Three.js; nie jest błędem budowania.
- Testy rzeczywistych siatek sprawdzają podparcia obu pierścieni, styk
  obrzeża sprężyny z dociskiem, końce cewek w gniazdach, gniazda w żebrach,
  prześwity od powierzchni ciernych i prowadnicy oraz zazębienie wielowypustu.
  Sprawdzają też rzeczywiste wierzchołki detali przy niezależnych fazach wałów
  i różnych położeniach pedału, zamknięcia przeciętych brył oraz unieważnianie
  pamięci przekroju podczas pauzy i zmiany lokalnego mocowania.
- Testy sceny potwierdzają pomijanie ukrytych potomków, prawidłowy powrót po
  pokazaniu lub zmianie rodzica, zachowanie macierzy instancji i brak ponownego
  mierzenia oraz zapisu niezmienionych etykiet.
- Otworzono ujęcia sprzęgła złożonego, wysprzęglonego, przy innych fazach,
  z pełną pokrywą i na telefonie. Dwa duże ujęcia pełnoekranowe pokazują
  podparcia i prześwity z pedałem zwolnionym oraz wciśniętym.
- Końcowy przebieg Chromium: 5/5 scenariuszy, bez błędów, 7,6 min. Obejmuje
  sprzęgło podczas pauzy, rozstrzelenie i izolację; telefon; wszystkie zakładki;
  wszystkie presety i inspekcje 8AT; wybierak, synchronizator, obie gałęzie
  DCT oraz pięć zawieszeń. Obejrzano także końcowe obrazy izolowanego sprzęgła,
  warstw, telefonu, pokrywy, wybieraka, DCT, pojazdu, 8AT i pullrodu.
  Podczas całego przebiegu nie zmieniano źródeł aplikacji.
