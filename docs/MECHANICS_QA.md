# Kontrola zmian mechaniki — 3 października 2026

## Zakres

| Zgłoszenie | Wdrożone zachowanie |
| --- | --- |
| Brak widocznej własnej konfiguracji | Skrzynia, napęd kół, orientacja i położenie silnika znajdują się nad modelem. Automatyczne dopasowania odświeżają wszystkie pola. |
| Same wałki, brak głowicy i rozrządu | Pasek/łańcuch jest widoczny także w widoku pojazdu. Głowica ma odlew, gniazda, prowadnice, kanały, uszczelkę i sprężyny zaworów oraz osobne zbliżenie. |
| Sprzęgło działało dopiero na końcu skoku | W całym skoku poruszają się łożysko, palce i taśmy. Docisk maleje przed otwarciem szczeliny. Pokaz ruszania zestawia obroty, limit momentu i moc tarcia. |
| Skrzynia zbyt ogólna | Widoczne łożyska igiełkowe, piasty, tuleje, stożki, pierścienie, kły i połączone wybieraki. Można przybliżyć każdą parę i przejść etapami zmiany biegu. |
| FWD wyglądał jak sztywne połączenie | Pokaz przedniego dyferencjału odsłania satelity i porównuje obroty półosi na wprost/w zakręcie. Objaśnia mechaniczne działanie i równy moment otwartego mechanizmu. |
| Własny samochód | SEAT Ibiza IV/6P 1.0 MPI 75 KM, 2016, Europa: R3, MPI, pasek, przód/poprzecznie/FWD i manual pięciobiegowy. Źródła i granice odwzorowania w CAR_PRESET_REFERENCES.md. |

## Weryfikacja

- `npm test`: **133/133**. Fizyka, geometria i rzeczywisty interfejs w happy-dom. Po końcowym doprecyzowaniu opisu swobodnego koła ponownie przeszły wszystkie testy interfejsu.
- `npm run build`: poprawny. Pozostaje ostrzeżenie Vite o rozmiarze paczki Three.js.
- `npm run test:browser`: **4/4**, lokalny Chromium z WebGL przez SwiftShader. Wszystkie zakładki, 15 presetów, automat, interakcje manuala, głowica, rozrząd, FWD i układ telefonu.
- Po kontroli obrazów poprawiono margines kadru głowicy oraz opis swobodnego koła przy innym włączonym biegu. Powtórzony test nowych mechanizmów: **1/1**.

Obrazy pełnego przebiegu są w `artifacts/browser/`, a końcowej kontroli nowych mechanizmów w `artifacts/browser-final/`. Obejrzano konfigurację, głowicę, pasek/łańcuch, półsprzęgło, wysprzęglanie, parę drugiego biegu, synchronizację, Ibizę, przedni dyferencjał i układ telefonu. Głowica mieści się w kadrze, a satelity są widoczne między niebieskim i złotym kołem bocznym.

To kontrola renderowania programowego, bez oceny wydajności GPU ani fizycznych gestów touchpada użytkownika. Modele pozostają dydaktyczne; pokaz ciepła nie oblicza temperatury sprzęgła, a preset nie kalibruje fabrycznych osiągów Ibizy.

## Kolejna korekta proporcji i czytelności

- Dyferencjał w pojeździe ma mniejszy mechanizm centralny, ale półosie nadal
  dochodzą do piast. Widok stołowy zachowuje powiększenie do nauki. Obniżenie
  poprzecznego zespołu napędowego zmniejsza również koła przekładni głównej;
  przełożenie oraz zależności prędkości pozostają wspólne z symulacją.
- Przedłużenia wałków rozrządu kończą się na rzeczywistych końcach ich geometrii,
  a nie na dłuższym końcu wału korbowego. Dotyczy to wszystkich architektur.
- Ciągły odlew głowicy ma osobny kolor i jasną krawędź przekroju. Etykieta
  w całym aucie i przycisk „Zobacz głowicę” prowadzą do jej budowy i działania.
- Sprzęgło ma większe odstępy inspekcyjne oraz „Pokaż warstwy” / „Złóż części”.
  Rozłożenie jest umowne; fizyczny docisk, poślizg i otwarcie szczeliny nadal
  wynikają z pedału. Wybrane rozłożenie wraca po zmianie zakładki.
- W rozłożeniu długie połączenia metalowe zastępują dyskretne kreskowane linie
  złożenia, żeby nie zasłaniać warstw. Po złożeniu wracają palce oraz taśmy.
  Odczyty na płótnie można włączyć przyciskiem „Pokaż parametry”.
- Skrócono zbiorcze etykiety rozrządu i pokazano je tylko przy izolacji.
  Zakładki Corolli nazywają się „Podział mocy” i „e-CVT”.
- Nowe testy porównują rzeczywiste obwiednie części, ciągłość połączeń,
  zazębienie kompaktowej przekładni i położenie końców półosi.

Kontrola wizualna obejmuje dodatkowo silnik, głowicę, sprzęgło i skrzynię w
Ibizie, A4, 911, 508 EAT8, Corolli hybrid i Veyronie. Kadry mechanizmów są
zapisywane jako cały panel, tak aby pełny canvas mieścił się na obrazie.

Końcowa kontrola logiki, geometrii i rzeczywistego interfejsu: **168/168**.
Budowa produkcyjna przeszła. Renderowanie i obrazy są sprawdzane lokalnym
Chromium z WebGL przez SwiftShader; nie oznacza to pomiaru wydajności GPU.

Końcowy przebieg przeglądarkowy: **10/10** — wszystkie zakładki, 15 presetów,
inspekcje 8AT, telefon, pokaz FWD oraz osobne konfiguracje sześciu samochodów.
Obejrzano m.in. końcowy przekrój i rozłożenie sprzęgła Ibizy, otwarty dyferencjał,
DCT A4, konwerter 508 oraz głowice i rozrząd 911/W16. Końcowe obrazy są w
`artifacts/browser-final/`. Pierwszy przebieg przerwała aktualizacja źródła
podczas testu, a zbiorczy test sześciu aut wyczerpał limit czasu; powtórzenie
na zamrożonych źródłach i osobne przypadki dla aut przeszły w całości.
