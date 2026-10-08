# Bugatti — połączenia napędu, 2026-10-08

W presecie Veyrona stała pozycja centralnego mechanizmu wypadała wewnątrz
DCT. Wał wychodzący ze skrzyni zawracał przez jej koła zębate. Wejście
centralnego mechanizmu pokrywało się też z wyjściem na tylną oś.

Pozycja rozdziału napędu wynika teraz z rzeczywistego wyjścia przekładni.
Wał powrotny przechodzi pod skrzynią przez proste odcinki z przegubami;
ich strzałki przepływu biegną po tych samych odcinkach. AWD i quattro
mają osobne wejście napędzające kosz przez parę kół 1:1. Tuleja kosza
i koło wejściowe omijają niezależnie obracające się pakiety quattro.

To wspólna geometria dydaktyczna. Dotychczasowe uproszczenia presetu
Veyrona, w tym sześciobiegowa DCT zamiast fabrycznej siedmiobiegowej,
pozostają opisane przy wyborze samochodu.

## Weryfikacja

- Test regresji najpierw odtworzył kolizję wału z rzeczywistymi trójkątami
  DCT oraz wspólny punkt wejścia i wyjścia centralnego mechanizmu.
- Testy sprawdzają oś i osiem punktów obwodu wału w trzech fazach obrotu
  DCT, przyłączenie do końca wału wyjściowego, odrębne porty, przełożenie
  wejścia 1:1 i odstęp od pakietu quattro.
- Macierz trzech przekładni, trzech położeń silnika i trzech wariantów
  napędu obu osi sprawdza prześwity oraz zgodność przepływu z wałami.
  Powtórna konfiguracja i zmiana inspekcji zachowują pozycję mechanizmu.
- `npm test`: 276/276; `npm run build`: poprawna kompilacja.
- Macierz przeglądarkowa mechanizmów Veyrona i Audi quattro: 2/2,
  Chromium z WebGL/SwiftShader; obejrzano wygenerowane zrzuty.

Zrzuty lokalnego WebGL zapisano w `artifacts/bugatti/`: oba kierunki
widoku zespołu napędowego, bok, cały samochód, rozdział napędu, sprzęgła,
skrzynia oraz przełączenie Audi quattro → Bugatti. Dodatkowa macierz
przeglądarkowa dla Veyrona i Audi jest w `artifacts/bugatti/matrix/`.
Kontrola dotyczy czytelności modelu i jego połączeń, a nie fabrycznych
wymiarów ani kompletnej konstrukcji układu AWD Bugatti.
