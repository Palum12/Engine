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
