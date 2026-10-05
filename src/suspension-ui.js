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
  <p>Sprężyna podtrzymuje nadwozie, amortyzator uspokaja kołysanie. Kliknij element prawym przyciskiem, aby poznać jego działanie — także z wyłączonymi opisami.</p>
  <p class="suspension-scope">Pokaz jednej osi. Wspólne parametry pozwalają porównywać konstrukcje; kształty i ruch są uproszczone.</p>
</aside>`;

export const SUSPENSION_TELEMETRY = `
<div id="suspension-telemetry" class="suspension-telemetry" hidden>
  <div><strong>Koło reaguje na drogę, nadwozie podąża z opóźnieniem</strong><span id="suspension-body-state"></span></div>
  <table><thead><tr><th>Koło</th><th>Droga</th><th>Ugięcie</th><th>Siła sprężyny</th><th>Amortyzator</th><th>Kontakt</th></tr></thead>
  <tbody><tr><th>Lewe</th><td id="suspension-left-road"></td><td id="suspension-left-travel"></td><td id="suspension-left-spring"></td><td id="suspension-left-damper"></td><td id="suspension-left-contact"></td></tr>
  <tr><th>Prawe</th><td id="suspension-right-road"></td><td id="suspension-right-travel"></td><td id="suspension-right-spring"></td><td id="suspension-right-damper"></td><td id="suspension-right-contact"></td></tr></tbody></table>
  <small>Ugięcie mierzymy od położenia spoczynkowego. Ruch powiększono dla czytelności.</small>
</div>`;

export const SUSPENSION_NOTES = {
  macpherson: 'Wahacz i kolumna prowadzą koło. Sprężyna oraz amortyzator są razem w kolumnie.',
  multilink: 'Pięć oddzielnych ramion prowadzi każde koło. Sprężyna podtrzymuje nadwozie, amortyzator tłumi ruch.',
  leaf: 'Koła łączy sztywna oś. Resory podtrzymują nadwozie i prowadzą oś.',
  pushrod: 'Koło pcha drążek. Dźwignia ściska sprężynę schowaną wewnątrz nadwozia.',
  pullrod: 'Koło ciągnie drążek. Nisko osadzona dźwignia ściska sprężynę wewnątrz nadwozia.'
};

export const SUSPENSION_PARTS = {
  suspensionDrive: ['Uproszczony napęd', 'Przekładnia i półosie pokazują miejsce napędu między elementami zawieszenia. Prędkość przejazdu ustawiasz w panelu.'],
  suspensionLinks: ['Wahacze', 'Łączą zwrotnicę z mocowaniami nadwozia. Prowadzą koło podczas uginania zawieszenia.'],
  suspensionSpring: ['Sprężyna', 'Podtrzymuje nadwozie i ugina się na nierówności. Bez amortyzatora nadwozie kołysze się dłużej.'],
  suspensionDamper: ['Amortyzator', 'Stawia opór przy ściskaniu i rozciąganiu, dzięki przepływowi oleju przez zawory. Uspokaja kołysanie po nierówności.'],
  suspensionRoad: ['Nawierzchnia', 'Nierówność pod jednym kołem pozwala obserwować przechył nadwozia. W panelu zmienisz jej wysokość i prędkość przejazdu.'],
  suspensionWheel: ['Koło', 'Opona przenosi siłę z drogi na koło. Zawieszenie pozwala kołu poruszać się względem nadwozia.'],
  suspensionBody: ['Nadwozie i mocowania', 'Podłoga, progi i nadkola pokazują fragment karoserii. Kielichy i rama pomocnicza przenoszą siły zawieszenia na nadwozie.'],
  suspensionRocker: ['Dźwignia', 'Obraca się na osi zamocowanej do nadwozia. Zmienia kierunek ruchu drążka i przekazuje go na sprężynę oraz amortyzator.']
};

export function suspensionPartDescription(part, type) {
  if (part === 'suspensionLinks') {
    const descriptions = {
      macpherson: 'Dolny wahacz i kolumna łączą zwrotnicę z nadwoziem. Prowadzą koło podczas uginania zawieszenia.',
      multilink: 'Pięć ramion łączy zwrotnicę z mocowaniami nadwozia. Razem ustalają tor koła i jego ustawienie.',
      leaf: 'Resory łączą sztywną oś z nadwoziem i prowadzą ją. Ruch jednego koła wpływa również na drugie.',
      pushrod: 'Górny i dolny wahacz prowadzą zwrotnicę. Ukośny drążek przenosi ruch do sprężyny, ale nie zastępuje wahaczy.',
      pullrod: 'Górny i dolny wahacz prowadzą zwrotnicę. Ukośny drążek przenosi ruch do sprężyny, ale nie zastępuje wahaczy.'
    };
    return [type === 'leaf' ? 'Prowadzenie sztywnej osi' : 'Wahacze', descriptions[type] || SUSPENSION_PARTS[part][1]];
  }
  if (part === 'suspensionSpring' && type === 'leaf') return ['Resor piórowy', 'Stalowe pióra uginają się i podtrzymują nadwozie. Ich końce są zamocowane do nadwozia, środek obejmuje oś.'];
  if (part === 'suspensionRocker' && ['pushrod', 'pullrod'].includes(type)) return ['Dźwignia', `${type === 'pushrod' ? 'Koło pcha drążek' : 'Koło ciągnie drążek'}, obracając dźwignię na mocowaniu nadwozia. Jej drugie ramię ściska sprężynę i amortyzator.`];
  return SUSPENSION_PARTS[part];
}
