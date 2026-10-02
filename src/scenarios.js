import { FINAL_RATIO, WHEEL_RADIUS, evaluateTraction } from './powertrain.js';

export const SCENARIOS = {
  launch: { name: 'Ruszanie', types: ['manual', 'dct'] },
  shift: { name: 'Zmiana 1 → 2', types: ['manual', 'dct'] },
  corner: { name: 'Zakręt i różne obroty kół', types: ['manual', 'dct', 'hybrid'] },
  slip: { name: 'Jedno koło na lodzie', types: ['manual', 'dct', 'hybrid'] },
  transfer: { name: '2H → 4H → reduktor 4L', types: ['manual', 'dct'] },
  ev: { name: 'EV · bateria napędza koła', types: ['hybrid'] },
  assist: { name: 'Podział mocy · silnik + MG2', types: ['hybrid'] },
  regen: { name: 'Rekuperacja i pełna bateria', types: ['hybrid'] },
  charge: { name: 'Ładowanie na postoju', types: ['hybrid'] }
};

export class ScenarioPlayer {
  constructor(sim) { this.sim = sim; this.stop(); }
  stop() { this.id = null; this.steps = []; this.index = 0; this.elapsed = 0; }
  get step() { return this.steps[this.index]; }

  seed(speed = 0, gear = 1) {
    const s = this.sim;
    s.speed = speed;
    s.gear = s.transmission === 'hybrid' ? 0 : gear;
    s.clutch = 0;
    s.throttle = 0.25;
    s.brake = 0;
    s.rpm = s.transmission === 'hybrid' ? 0 : Math.max(1200, speed / WHEEL_RADIUS * FINAL_RATIO * s.ratios[gear] * 30 / Math.PI);
    s.traction = evaluateTraction(s, 0);
  }

  start(id) {
    if (!SCENARIOS[id]?.types.includes(this.sim.transmission)) return false;
    const s = this.sim;
    const config = { transmission: s.transmission, driveLayout: s.driveLayout, engineId: s.engineId, injection: s.injection, timing: s.timing, turbo: s.turbo, animationScale: s.animationScale };
    s.reset();
    s.setTransmission(config.transmission);
    s.setDriveLayout(config.driveLayout);
    s.setEngine(config.engineId);
    Object.assign(s, { injection: config.injection, timing: config.timing, turbo: config.transmission === 'hybrid' ? false : config.turbo, animationScale: config.animationScale });
    this.id = id;
    const step = (text, duration, enter = () => {}, animate) => ({ text, duration, enter, animate });
    const lowWheel = s.driveLayout === 'rwd' || s.driveLayout === 'partTime' ? 2 : 0;
    const lock = () => { if (lowWheel === 2) s.rearLock = true; else s.frontLock = true; };
    if (id === 'launch') this.steps = s.transmission === 'manual' ? [
      step('Pedał wciśnięty: silnik jest odłączony od skrzyni.', 1.5, () => { s.clutch = 1; }),
      step('Wybieramy jedynkę. Synchronizator i przesuwka przygotowują połączenie.', 2.5, () => s.shift(1)),
      step('Dodajemy gaz. Tarcza nadal nie przenosi momentu, bo pedał jest wciśnięty.', 2, () => { s.throttle = 0.25; }),
      step('Płynnie zwalniamy pedał. Tarcie wyrównuje obroty, a koła zaczynają napędzać pojazd.', 4, () => {}, p => { s.clutch = 1 - p; }),
      step('Pedał zwolniony: poślizg maleje. Droga napędu prowadzi przez wybraną parę kół.', 4, () => { s.clutch = 0; })
    ] : [
      step('DCT na N: żaden pakiet nie przekazuje momentu na koła.', 1.5),
      step('Wybieramy jedynkę. K1 stopniowo dociska tarcze; dwójka czeka na gałęzi K2.', 1.8, () => s.shift(1)),
      step('Dodajemy gaz. Sterownik reguluje poślizg K1 podczas ruszania.', 4, () => { s.throttle = 0.25; }),
      step('K1 przenosi moment. K2 jest otwarte, choć dwójka jest już wybrana.', 4)
    ];
    if (id === 'shift') {
      this.seed(8, 1);
      this.steps = s.transmission === 'manual' ? [
        step('Jedynka napędza koła. Koło jest połączone z wałem przesuwką.', 2),
        step('Odejmujemy gaz i wciskamy sprzęgło. Przerywamy przekazywanie momentu.', 1.2, () => { s.throttle = 0; s.clutch = 1; }),
        step('Wybieramy dwójkę. Luz → tarcie stożka → zazębienie przesuwki.', 2.5, () => s.shift(2)),
        step('Zwalniamy sprzęgło. Nowe przełożenie daje inne obroty silnika przy tej samej prędkości.', 2.5, () => { s.throttle = 0.25; }, p => { s.clutch = 1 - p; }),
        step('Dwójka jest połączona i przenosi moment.', 3, () => { s.clutch = 0; })
      ] : [
        step('K1 przenosi moment na jedynce. Dwójka jest przygotowana, ale K2 jest otwarte.', 2),
        step('Sterownik potwierdza wybranie dwójki na gałęzi K2.', 0.32, () => s.shift(2)),
        step('Docisk K1 maleje, docisk K2 rośnie. Sprzęgła pracują z kontrolowanym poślizgiem.', 0.96),
        step('K2 przejmuje napęd. Sterownik może przygotować trójkę na odciążonej gałęzi K1.', 3)
      ];
    }
    if (id === 'corner') {
      this.seed(7, 2);
      this.steps = [step('Na wprost oba koła osi mają podobne obroty. Satelity krążą z koszem.', 2), step('Skręcamy w lewo. Zewnętrzne prawe koło pokonuje dłuższą drogę i obraca się szybciej.', 4, () => {}, p => { s.turn = p * 0.8; }), step('Satelity obracają się także na swoich osiach. Średnia obrotów półosi równa się obrotom kosza.', 4, () => { s.turn = 0.8; }), step('Wracamy na wprost. Różnica obrotów łagodnie zanika.', 3, () => {}, p => { s.turn = 0.8 * (1 - p); })];
    }
    if (id === 'slip') {
      this.seed(3, 1);
      this.steps = [step('Oba koła mają przyczepność. Otwarty dyferencjał przenosi zbliżony moment na obie półosie.', 2), step('Jedno koło trafia na lód. Dostępny moment obu stron otwartego mechanizmu ogranicza słabsza strona.', 4, () => { s.surfaces[lowWheel] = 'ice'; }), step('Włączamy blokadę tej osi. Obroty półosi są połączone, a koło na asfalcie może przenieść większy moment.', 4, lock), step('Porównaj moment i obroty czterech kół. Blokada zmienia więzy mechaniczne, nie współczynnik tarcia opony.', 4)];
    }
    if (id === 'transfer') {
      s.setDriveLayout('partTime');
      this.seed(0, 1);
      s.rpm = 1700;
      s.throttle = 0.3;
      s.surfaces = ['asphalt', 'asphalt', 'ice', 'ice'];
      this.steps = [step('2H: napędzana jest tylko tylna oś, która stoi na lodzie.', 3), step('4H: dołączamy przednią oś. Sztywne połączenie wiąże obroty osi, a moment zależy od ich przyczepności.', 4, () => { s.driveMode = '4H'; }), step('Zatrzymujemy pojazd przed wyborem reduktora.', 3, () => { s.brake = 1; s.throttle = 0; if (s.transmission === 'manual') s.clutch = 1; }), step('4L: reduktor zmniejsza obroty 2,5 razy. Przy tym samym momencie wejściowym dostępny moment na wyjściu rośnie.', 4, () => { s.speed = 0; s.driveMode = '4L'; s.brake = 0; s.throttle = 0.3; s.clutch = 0.3; }), step('Reduktor pomaga jechać wolno z większym momentem. Nie zwiększa przyczepności opon.', 4, () => { s.clutch = 0; })];
    }
    if (id === 'ev') this.steps = [step('D: silnik benzynowy stoi. Przy braku gazu bateria nie zasila napędu.', 2, () => { s.hybrid.mode = 'ev'; }), step('Bateria oddaje prąd stały. Falownik zasila uzwojenia MG2 prądem przemiennym.', 4, () => { s.throttle = 0.25; }), step('MG2 obraca wyjście i koła. MG1 obraca się w przeciwnym kierunku, ale nie musi generować prądu.', 4), step('Odejmujemy gaz. Przepływ energii zanika, a samochód toczy się.', 3, () => { s.throttle = 0; })];
    if (id === 'assist') this.steps = [step('Zwiększamy zapotrzebowanie na napęd. Sterownik uruchamia silnik przez MG1.', 2, () => { s.hybrid.mode = 'hybrid'; s.throttle = 0.5; }), step('Jarzmo odbiera moment silnika. Przekładnia dzieli moc na drogę mechaniczną oraz MG1.', 4), step('Energia z MG1 może zasilać MG2 przez falownik. Bateria przyjmuje nadwyżkę albo pokrywa niedobór.', 4), step('Przy pełnym gazie obserwuj moc MG2 i kierunek prądu baterii.', 4, () => { s.throttle = 0.85; })];
    if (id === 'regen') {
      this.seed(16, 1);
      s.throttle = 0;
      this.steps = [step('Pojazd się toczy. MG2 jest mechanicznie połączone z kołami.', 2), step('Hamujemy: koła napędzają MG2 jako generator. Falownik prostuje prąd i ładuje baterię.', 4, () => { s.brake = 0.3; }), step('Ustawiamy pełną baterię w doświadczeniu. Sterownik ogranicza ładowanie; pozostałe hamowanie przejmują hamulce cierne.', 3, () => { s.hybrid.soc = 0.85; }), step('Zwalniamy hamulec. Sprawdź, że bateria nie ładuje się ponad przyjęty limit.', 3, () => { s.brake = 0; })];
    }
    if (id === 'charge') this.steps = [step('P: wyjście jest zablokowane, koła stoją. Bateria ma miejsce na energię.', 2, () => { s.hybrid.range = 'P'; s.hybrid.soc = 0.4; }), step('Włączamy ładowanie na postoju. MG1 uruchamia silnik.', 2, () => { s.hybrid.mode = 'charge'; }), step('Silnik obraca jarzmo. Przy nieruchomym wieńcu słońce i MG1 obracają się szybciej.', 4), step('MG1 → falownik → bateria. MG2 nie napędza kół, więc nie ma przepływu energii do jazdy.', 5)];
    this.index = 0;
    this.elapsed = 0;
    this.step.enter();
    this.step.animate?.(0);
    s.paused = false;
    s.update(0.002);
    s.paused = true;
    return true;
  }

  update(dt) {
    if (!this.id || this.sim.paused) return false;
    this.elapsed += dt;
    this.step.animate?.(Math.min(1, this.elapsed / this.step.duration));
    if (this.elapsed >= this.step.duration && this.index < this.steps.length - 1) {
      this.index++;
      this.elapsed = 0;
      this.step.enter();
      this.step.animate?.(0);
      return true;
    }
    return false;
  }

  next() {
    if (!this.id || this.index >= this.steps.length - 1) return false;
    this.sim.paused = false;
    while (this.elapsed < this.step.duration) {
      const dt = Math.min(1 / 60, this.step.duration - this.elapsed);
      this.elapsed += dt;
      this.step.animate?.(Math.min(1, this.elapsed / this.step.duration));
      this.sim.update(dt);
    }
    this.index++;
    this.elapsed = 0;
    this.step.enter();
    this.step.animate?.(0);
    this.sim.paused = true;
    return true;
  }
}
