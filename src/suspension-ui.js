export const SUSPENSION_CONTROLS = `
<aside id="suspension-controls" class="suspension-controls" aria-label="Sterowanie zawieszeniem" hidden>
  <div class="section-heading">LABORATORIUM ZAWIESZENIA</div>
  <label>Konstrukcja<select id="suspension-type">
    <option value="macpherson">Kolumna MacPhersona</option>
    <option value="multilink">Zawieszenie wielowahaczowe</option>
    <option value="leaf">Resory piórowe · sztywna oś</option>
    <option value="pushrod">Podwójny wahacz · pushrod</option>
    <option value="pullrod">Podwójny wahacz · pullrod</option>
  </select></label>
  <p id="suspension-type-note"></p>
  <label>Nawierzchnia<select id="suspension-road">
    <option value="bumps">Powtarzające się wyboje</option>
    <option value="holes">Dołki pod oboma kołami</option>
    <option value="split">Różne nierówności pod L / P</option>
    <option value="waves">Falująca droga</option>
    <option value="flat">Gładki asfalt</option>
  </select></label>
  <label>Prędkość przejazdu <output id="suspension-speed-value"></output><input id="suspension-speed" type="range" min="0" max="60" value="18" step="1"></label>
  <label>Wysokość / głębokość <output id="suspension-amplitude-value"></output><input id="suspension-amplitude" type="range" min="0" max="15" value="8" step="1"></label>
  <label>Sztywność sprężyny <output id="suspension-spring-value"></output><input id="suspension-spring" type="range" min="40" max="250" value="100" step="5"></label>
  <label>Tłumienie amortyzatora <output id="suspension-damping-value"></output><input id="suspension-damping" class="blue-range" type="range" min="0" max="250" value="100" step="5"></label>
  <label>Tempo pokazu<select id="suspension-tempo"><option value="0.25">¼ prędkości</option><option value="0.5" selected>½ prędkości</option><option value="1">Rzeczywiste tempo</option></select></label>
  <div class="suspension-actions"><button id="suspension-reset" class="secondary-button">Przejedź od początku</button><button id="suspension-step" class="secondary-button">Krok 0,1 s</button></div>
  <p>Sprężyna podtrzymuje nadwozie i magazynuje energię. Amortyzator wyhamowuje ruch: ustaw jego tłumienie na 0%, aby zobaczyć kołysanie po nierówności.</p>
  <p class="suspension-scope">Schemat jednej osi z uproszczonym napędem. Parametry są wspólne do porównania konstrukcji; to nie fabryczne zawieszenie wybranego auta. Ruch pionowy i przechył nadwozia wynikają z sił, kształty prowadzenia kół są ilustracyjne.</p>
</aside>`;

export const SUSPENSION_TELEMETRY = `
<div id="suspension-telemetry" class="suspension-telemetry" hidden>
  <div><strong>Koło reaguje na drogę, nadwozie podąża z opóźnieniem</strong><span id="suspension-body-state"></span></div>
  <table><thead><tr><th>Koło</th><th>Droga</th><th>Ugięcie</th><th>Siła sprężyny</th><th>Amortyzator</th><th>Kontakt</th></tr></thead>
  <tbody><tr><th>Lewe</th><td id="suspension-left-road"></td><td id="suspension-left-travel"></td><td id="suspension-left-spring"></td><td id="suspension-left-damper"></td><td id="suspension-left-contact"></td></tr>
  <tr><th>Prawe</th><td id="suspension-right-road"></td><td id="suspension-right-travel"></td><td id="suspension-right-spring"></td><td id="suspension-right-damper"></td><td id="suspension-right-contact"></td></tr></tbody></table>
  <small>Ugięcie względem położenia spoczynkowego. Siła amortyzatora zmienia znak z kierunkiem ruchu; kontakt znika, gdy opona odrywa się od drogi. Odstępy i ruch powiększono dla czytelności.</small>
</div>`;

export const SUSPENSION_NOTES = {
  macpherson: 'Dolny wahacz prowadzi koło, a kolumna łączy zwrotnicę z nadwoziem. Sprężyna i amortyzator pracują współosiowo w kolumnie.',
  multilink: 'Kilka osobnych ramion prowadzi zwrotnicę. Ich punkty mocowania określają tor koła; sprężyna i amortyzator mają osobne zadania.',
  leaf: 'Oba koła łączy sztywna oś. Pakiety stalowych piór uginają się i podtrzymują nadwozie, a osobne amortyzatory tłumią ruch.',
  pushrod: 'Dwa wahacze prowadzą koło. Uginające się koło pcha ukośny drążek, który obraca dźwignię i ściska sprężynę z amortyzatorem wewnątrz nadwozia.',
  pullrod: 'Dwa wahacze prowadzą koło. Uginające się koło ciągnie ukośny drążek, który obraca nisko umieszczoną dźwignię i uruchamia sprężynę z amortyzatorem.'
};

export const SUSPENSION_PARTS = {
  suspensionDrive: ['Uproszczony napęd', 'Blok przekładni i półosie służą jako kontekst przestrzenny zawieszenia. Ten pokaz oblicza siły pionowe kół i nadwozia; prędkość przejazdu ustawiasz bezpośrednio w panelu. Rozwinięte modele silnika, sprzęgła i skrzyni są dostępne w swoich zakładkach.'],
  suspensionLinks: ['Prowadzenie koła', 'Wahacze i przeguby ustalają położenie zwrotnicy. Pozwalają kołu poruszać się względem nadwozia, jednocześnie przenosząc siły hamowania, przyspieszania i skręcania. Liczba i układ ramion zależą od wybranej konstrukcji. W tym schemacie punkty mocowania pokazują zasadę działania; nie odtwarzają geometrii konkretnego samochodu.'],
  suspensionSpring: ['Sprężyna / resor', 'Element sprężysty podtrzymuje ciężar nadwozia. Przy ugięciu magazynuje energię, a podczas rozprężania ją oddaje. Sama sprężyna nie zatrzymuje kołysania. Resor piórowy składa się z wyginających się stalowych listew i w tym modelu prowadzi również sztywną oś.'],
  suspensionDamper: ['Amortyzator', 'Tłok wymusza przepływ oleju przez zawory i stawia opór ruchowi. Energia ruchu zamienia się w ciepło. Amortyzator ogranicza odbijanie po nierówności i pomaga utrzymać kontakt opony z drogą. W uproszczonym modelu siła jest proporcjonalna do względnej prędkości koła i nadwozia.'],
  suspensionRoad: ['Nawierzchnia', 'Profil drogi trafia pod lewe i prawe koło wraz z przejazdem. Dołek pod jednym kołem pozwala porównać niezależne prowadzenie kół ze sztywną osią. Zwiększ prędkość lub głębokość, aby zobaczyć większe siły i możliwość oderwania opony.'],
  suspensionWheel: ['Koło i masa nieresorowana', 'Koło, zwrotnica i część ramion tworzą masę nieresorowaną. Opona także jest sprężysta: jej odkształcenie przenosi siłę z drogi na koło. Koło może reagować szybko, podczas gdy cięższe nadwozie porusza się wolniej.'],
  suspensionBody: ['Nadwozie i masa resorowana', 'Sprężyny podtrzymują cięższe nadwozie. Różne siły po lewej i prawej stronie wywołują przechył; suma sił powoduje jego ruch pionowy. Prosty blok napędu zostawia miejsce na obserwację zawieszenia.'],
  suspensionRocker: ['Dźwignia pushrod / pullrod', 'Drążek łączy zwrotnicę z obracaną dźwignią. Dźwignia zmienia kierunek ruchu i przekazuje go na sprężynę z amortyzatorem wewnątrz nadwozia. Pushrod przenosi przede wszystkim ściskanie, pullrod rozciąganie. Koło nadal prowadzą dwa wahacze.']
};
