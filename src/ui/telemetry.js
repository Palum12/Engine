import { DomSync } from './dom-sync.js';
import { manualClutchState, manualClutchPresentation } from '../manual-clutch.js';
import { getEngine } from '../engines.js';
import { STROKES, strokeIndex, cycleDegrees } from '../simulation.js';
import { cycleVisuals } from '../cycle-visuals.js';
import { SUSPENSION_NOTES } from '../suspension-ui.js';

export function createTelemetry(context) {
  const { sim, player, $$, icon, fmt, lessonView, inspectedDifferential } = context;
  const elements = new Map();
  const $ = selector => {
    let element = elements.get(selector);
    if (!element?.isConnected) { element = context.$(selector); elements.set(selector, element); }
    return element;
  };
  const sync = new DomSync();
  function updateLessonState() {
    const { mode, scene } = context;
    const state = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
    const separated = !state.contact;
    const exploded = mode === 'clutch' && Number($('#explode').value) > 0;
    const presentation = manualClutchPresentation({ state, engineRpm: sim.rpm, inputOmega: sim.inputOmega, transmittedTorque: sim.transmittedTorque, exploded });
    sync.attr($('#clutch-status'), 'data-state', presentation.kind); sync.attr($('#clutch-lesson'), 'data-state', presentation.kind);
    const contactLabel = ({
      grip: 'ZACISK · obroty wyrównane',
      slip: 'STYK Z POŚLIZGIEM · tarcie przenosi moment i grzeje',
      contact: 'STYK · bez przenoszonego momentu',
      open: 'ROZŁĄCZONE · brak zacisku i momentu przez tarcie',
      exploded: 'WARSTWY MONTAŻOWE · nie pokazują pracy sprzęgła'
    })[presentation.kind];
    sync.text($('#contact-state'), contactLabel);
    sync.text($('#clutch-engine-rpm'), `${Math.round(sim.rpm)} obr./min`);
    sync.text($('#clutch-input-rpm'), `${Math.round(sim.inputOmega * 30 / Math.PI)} obr./min`);
    sync.text($('#contact-detail'), exploded ? 'Widok rozstrzelony służy rozpoznaniu części. Złóż sprzęgło, aby odczytać tarcie i przepływ momentu.' : `Docisk ${Math.round(state.clampFactor * 100)}% · limit ${Math.round(state.capacity)} Nm · przenoszone ${Math.round(presentation.torque)} Nm · poślizg ${Math.round(presentation.slipRpm)} obr./min · ciepło ${(presentation.heatPower / 1000).toFixed(2)} kW`);
    sync.text($('#clutch-clamp-value'), `${Math.round(state.clampFactor * 100)}%`);
    sync.property($('#clutch-clamp'), 'value', state.clampFactor);
    sync.text($('#clutch-gap-state'), exploded ? 'Odstępy montażowe · nie są szczelinami roboczymi' : state.release > 0 ? 'Dwie szczeliny · powierzchnie nie trą o siebie' : separated ? 'Brak siły zacisku · tarcza odciążona' : 'Obie okładziny stykają się z powierzchniami');
    sync.attr($('#clutch-display'), 'data-state', exploded ? 'exploded' : 'assembled');
    sync.text($('#clutch-display'), exploded ? 'Rozstrzelone · odstępy montażowe' : 'Złożone · ruch roboczy');
    sync.property($('#assemble-clutch'), 'disabled', !exploded);
    $$('[data-clutch-pedal]').forEach(button => sync.attr(button, 'aria-pressed', Math.abs(Number(button.dataset.clutchPedal) - sim.clutch) < 0.005));
    sync.text($('#clutch-mechanism-detail'), exploded
      ? 'Złóż części, aby zobaczyć, jak sprężyna zaciska tarczę i jak pedał ją zwalnia.'
      : state.pedal < 0.02
        ? 'Sprężyna → docisk → tarcza → koło. Sprężyna zaciska; pedał jest zwolniony.'
        : separated
          ? 'Pedał → hydraulika → łożysko ←. Sprężyna zwalnia docisk; taśmy odsuwają go →.'
          : 'Pedał → hydraulika → łożysko wciska palce sprężyny. Zacisk maleje, styk pozostaje.');
    sync.text($('#clutch-motion'), exploded ? 'Obroty i oznaczenia tarcia są tu wyłączone.' : presentation.kind === 'slip'
      ? `Różnica obrotów ${Math.round(presentation.slipRpm)} obr./min → ciepło ${(presentation.heatPower / 1000).toFixed(1)} kW.`
      : separated ? 'Silnik nadal obraca koło i docisk. Tarcza z wałem może obracać się niezależnie.'
        : presentation.synchronous ? 'Koło i docisk obraca silnik; tarcie obraca tarczę i wał skrzyni.'
          : 'Powierzchnie są zaciśnięte. Moment i ciepło odczytasz po wznowieniu ruchu.');
    if (sim.transmission === 'manual') {
      sync.text($('#mechanism-state'), contactLabel);
      if (lessonView() === 'clutch') sync.text($('#mechanism-detail'), 'Moment przez tarcie zależy od zacisku. Ciepło pojawia się, gdy powierzchnie przenoszą moment przy różnych obrotach. Podane skoki są powiększone, a docisk względny.');
    }
    const release = state.release;
    sync.attr($('#diagram-disc'), 'x', 90 + release * 8);
    sync.attr($('#diagram-pressure'), 'x', 102 + release * 28);
    sync.attr($('#diagram-bearing'), 'x', 199 - state.pedal * 28);
    sync.attr($('#diagram-spring'), 'd', `M${118 + release * 28} 34L154 40L${199 - state.pedal * 28} 58M${118 + release * 28} 100L154 94L${199 - state.pedal * 28} 76`);
    sync.attr($('#diagram-release'), 'd', `M${258 - state.pedal * 28} 46H${220 - state.pedal * 28}m8-5-8 5 8 5`);
    sync.style($('#diagram-release'), 'opacity', String(state.pedal > 0 ? 1 : 0.15));
    sync.style($('#diagram-torque'), 'opacity', String(separated || exploded ? 0 : state.clampFactor));
    const stage = sim.shiftStage;
    const inspectedGear = /^gear([1-5])$/.exec($('#inspect-section').value);
    const synchroView = $('#inspect-section').value === 'synchronizer';
    const selected = sim.shiftTarget || Number(inspectedGear?.[1] || (synchroView ? $('#synchronizer-gear').value : 0)) || sim.gear;
    const focusedFreeGear = Boolean((inspectedGear || synchroView) && selected !== sim.gear && sim.shiftTarget === null);
    $$('[data-shift-stage]').forEach(element => sync.toggle(element, 'active', element.dataset.shiftStage === stage && !focusedFreeGear && (sim.shiftTarget !== null || sim.gear > 0)));
    sync.property($('#shift-step'), 'disabled', sim.shiftTarget === null);
    sync.property($('#synchronizer-gear'), 'disabled', sim.shiftTarget !== null);
    const output = sim.outputOmega * 30 / Math.PI;
    const free = selected ? sim.inputOmega / sim.ratios[selected] * 30 / Math.PI : 0;
    sync.text($('#shift-detail'), sim.shiftTarget !== null ? `${sim.shiftFrom || 'N'} → ${sim.shiftTarget || 'N'} · ${stage === 'release' ? 'Tuleja opuszcza zęby poprzedniego biegu.' : stage === 'synchronize' ? 'Pierścień trze o stożek, wyrównując obroty.' : 'Tuleja zachodzi na zęby kłowe koła.'} Koło ${Math.round(free)} / wał ${Math.round(output)} obr./min.` : focusedFreeGear ? `Koło biegu ${selected} obraca się swobodnie na łożysku: ${Math.round(free)} obr./min. Piasta i wał: ${Math.round(output)} obr./min. Tuleja nie łączy tego koła z wałem. ${sim.gear ? `Bieg ${sim.gear} jest włączony w innej parze.` : 'Skrzynia jest na luzie.'}` : sim.gear ? `Bieg ${sim.gear}: tuleja łączy zęby kłowe koła z piastą wału. Koło i wał ${Math.round(output)} obr./min. Pozostałe koła obracają się na łożyskach.` : 'Luz: koła obracają się na łożyskach, a piasty są związane z wałem. Zazębienie pary nie wystarcza: dopiero tuleja łączy koło z wałem.');
    const diff = inspectedDifferential();
    sync.text($('#diff-left'), `${(diff?.leftSpeed || 0).toFixed(1)}`);
    sync.text($('#diff-carrier'), `${(diff?.carrierSpeed || 0).toFixed(1)}`);
    sync.text($('#diff-right'), `${(diff?.rightSpeed || 0).toFixed(1)}`);
    sync.text($('#diff-demo'), diff?.demo ? 'Zakończ pokaz stołowy' : 'Uruchom pokaz stołowy');
    sync.attr($('#diff-demo'), 'aria-pressed', Boolean(diff?.demo));
    $$('[data-turn]').forEach(button => { const active = Number(button.dataset.turn) === sim.turn; sync.toggle(button, 'active', active); sync.attr(button, 'aria-pressed', active); });
    const front = mode === 'differential' ? sim.driveLayout === 'fwd' : diff === scene?.vehicle.front;
    const locked = front ? sim.frontLock : sim.rearLock;
    sync.text($('#diff-detail'), `${diff?.demo ? 'Pokaz stołowy · umowne obroty, niezależne od jazdy auta.' : 'Otwarty dyferencjał działa mechanicznie: nie steruje nim komputer. Opory kół i długość toru wyznaczają różnicę obrotów.'} ${locked ? 'Blokada łączy półosie: wymusza wspólne obroty.' : sim.turn === 0 ? 'Na wprost: satelity krążą z koszem, bez obrotu na własnych osiach.' : 'W zakręcie satelity obracają się także na swoich osiach: jedna półoś zwalnia, druga przyspiesza.'} (L + P) / 2 = kosz · obr./min.`);
  }

  function updatePowertrainMetrics() {
    const { mode, scene } = context;
    for (const name of ['throttle', 'clutch']) {
      const value = Math.round(sim[name] * 100);
      sync.property($(`#${name}`), 'value', value); sync.property($(`#quick-${name}`), 'value', value);
      sync.html($(`#${name}-value`), `${value}<span>%</span>`);
      sync.text($(`#quick-${name}-value`), `${value}%`);
      sync.css($(`#${name}`), '--fill', `${value}%`);
      sync.css($(`#quick-${name}`), '--fill', `${value}%`);
    }
    sync.property($('#vehicle-turn'), 'value', sim.turn * 100);
    sync.attr($('#quick-brake'), 'aria-pressed', Boolean(sim.brake));
    sync.attr($('#brake'), 'aria-pressed', Boolean(sim.brake));
    sync.html($('#pause'), icon(sim.paused ? 'play' : 'pause'));
    sync.attr($('#pause'), 'aria-label', sim.paused ? 'Wznów symulację' : 'Wstrzymaj symulację');
    sync.attr($('#clutch-toggle'), 'aria-pressed', sim.clutch >= 0.85);
    sync.html($('#clutch-toggle'), `${sim.clutch >= 0.85 ? 'Zwolnij pedał' : 'Wciśnij pedał'} <kbd>Shift</kbd>`);
    sync.text($('#scenario-play'), player.id && !sim.paused ? 'Wstrzymaj' : 'Odtwórz');
    sync.property($('#scenario-next'), 'disabled', !player.id || player.index >= player.steps.length - 1);
    sync.text($('#scenario-description'), player.id ? `${player.index + 1}/${player.steps.length} · ${player.step.text}` : 'Wybierz doświadczenie. Możesz odtworzyć animację lub przechodzić krokami.');
    sim.traction.wheels.forEach((wheel, i) => {
      sync.text($(`#wheel-rpm-${i}`), `${Math.round(wheel.rpm)} obr./min`);
      sync.text($(`#wheel-torque-${i}`), `${Math.round(wheel.torque)} Nm${wheel.slip > 1 ? ' · poślizg' : ''}${wheel.driven ? '' : ' · toczy się'}`);
    });
    sync.text($('#traction-note'), sim.traction.binding ? 'Sztywne połączenie osi + zakręt na asfalcie: wymagane drogi osi różnią się. Pojawia się wymuszony poślizg opon i naprężenie napędu.' : sim.traction.slip ? 'Przyczepność ogranicza moment docierający do podłoża. Porównaj otwarty dyferencjał z blokadą i obserwuj poślizg słabszego koła.' : 'Model przyczepności jest quasi-statyczny. W otwartym dyferencjale moment obu półosi jest równy; obroty mogą być różne.');
    sync.text($('#dct-k1'), `K1 · bieg ${sim.dct.selected[0]} · docisk ${Math.round(sim.dct.engagement[0] * 100)}% · ${Math.round(sim.dct.torques[0])} Nm`);
    sync.text($('#dct-k2'), `K2 · bieg ${sim.dct.selected[1]} · docisk ${Math.round(sim.dct.engagement[1] * 100)}% · ${Math.round(sim.dct.torques[1])} Nm`);
    sync.text($('#dct-state'), sim.shiftTarget !== null ? `${sim.shiftFrom || 'N'} → ${sim.shiftTarget || 'N'} · ${sim.shiftStage === 'preselect' ? 'wybór biegu' : sim.shiftStage === 'handover' ? 'przejmowanie momentu z poślizgiem' : 'ustalenie docisku'}` : sim.gear ? `Aktywny ${sim.gear} · przygotowany ${sim.dct.prepared}` : 'N · brak napędu');
    sync.property($('#dct-shift-step'), 'disabled', sim.shiftTarget === null);
    sync.text($('#automatic-slip'), `Poślizg · ${Math.round(sim.automatic.slipRpm)} obr./min`);
    sync.text($('#automatic-lockup'), `Lock-up · ${Math.round(sim.automatic.lockup * 100)}%`);
    sync.text($('#automatic-state'), sim.gear ? `Bieg ${sim.gear} · moment turbiny ${Math.round(sim.automatic.turbineTorque)} Nm` : 'N · brak napędu kół');
    const h = sim.hybrid;
    const kw = power => `${(power / 1000).toFixed(1).replace('.', ',')} kW`;
    sync.text($('#hybrid-state'), h.state);
    if (document.activeElement !== $('#battery-soc')) sync.property($('#battery-soc'), 'value', h.soc * 100);
    sync.text($('#battery-soc-value'), `${Math.round(h.soc * 100)}%`);
    sync.text($('#battery-current'), `${Math.abs(h.batteryCurrent).toFixed(1).replace('.', ',')} A ${h.batteryPower > 50 ? '→ falownik' : h.batteryPower < -50 ? '→ bateria' : '· spoczynek'}`);
    sync.text($('#battery-power'), `${kw(Math.abs(h.batteryPower))} ${h.batteryPower > 50 ? 'oddaje' : h.batteryPower < -50 ? 'przyjmuje' : ''}`);
    sync.text($('#battery-energy'), `${(h.soc * h.capacityKwh).toFixed(2).replace('.', ',')} kWh`);
    sync.text($('#energy-battery-label'), `Bateria ${Math.round(h.soc * 100)}%`);
    sync.text($('#energy-mg1-value'), kw(h.generatorPower));
    sync.text($('#energy-mg2-value'), kw(h.motorPower));
    sync.text($('#energy-battery-value'), kw(h.batteryPower));
    sync.text($('#mg1-rpm'), `${Math.round(h.mg1Omega * 30 / Math.PI)} obr./min`);
    sync.text($('#mg2-rpm'), `${Math.round(h.mg2Omega * 30 / Math.PI)} obr./min`);
    sync.text($('#hybrid-engine-rpm'), `${Math.round(sim.rpm)} obr./min`);
    sync.text($('#hybrid-balance'), `Bilans: silnik ${kw(h.enginePower)} + bateria ${kw(h.batteryPower)} = wyjście ${kw(h.mechanicalPower + h.motorPower)} + straty ${kw(h.lossPower)}${h.startPower > 0 ? ` + rozruch ${kw(h.startPower)}` : ''}.`);
    const powers = { engine: h.enginePower - (h.startPower || 0), mechanical: h.mechanicalPower, generation: h.generatorMechanical, mg1: h.generatorPower, mg2: h.motorDcPower, wheel: h.motorPower, battery: h.batteryPower };
    Object.entries(powers).forEach(([id, power]) => {
      const line = $(`#energy-${id}`);
      const active = Math.abs(power) > 50;
      sync.attr(line, 'data-active', String(active));
      sync.attr(line, 'data-direction', power < 0 ? 'reverse' : 'forward');
      sync.attr(line, 'marker-end', active && power > 0 ? 'url(#energy-arrow)' : 'none');
      sync.attr(line, 'marker-start', active && power < 0 ? 'url(#energy-arrow)' : 'none');
      sync.style(line, 'strokeWidth', String(active ? String(2 + Math.min(3, Math.abs(power) / 10000)) : '1.3'));
    });
    sync.toggle($('.energy-map'), 'paused', sim.paused);
  }

  function updateSuspensionUI() {
    const { mode, scene } = context;
    const state = sim.suspension;
    sync.property($('#suspension-type'), 'value', state.type);
    sync.property($('#suspension-road'), 'value', state.road);
    sync.text($('#suspension-type-note'), SUSPENSION_NOTES[state.type]);
    for (const [name, value, label] of [
      ['speed', state.speed, `${Math.round(state.speed)} km/h`],
      ['amplitude', state.amplitude * 100, `${Math.round(state.amplitude * 100)} cm`],
      ['spring', state.spring * 100, `${Math.round(state.spring * 100)}%`],
      ['damping', state.damping * 100, `${Math.round(state.damping * 100)}%`]
    ]) {
      if (document.activeElement !== $(`#suspension-${name}`)) sync.property($(`#suspension-${name}`), 'value', value);
      sync.text($(`#suspension-${name}-value`), label);
    }
    sync.property($('#suspension-tempo'), 'value', sim.suspensionTempo);
    sync.text($('#suspension-body-state'), `Przejechane ${state.distance.toFixed(1)} m · przechył ${(state.roll * 180 / Math.PI).toFixed(1)}°`);
    state.wheels.forEach((wheel, index) => {
      const prefix = `#suspension-${index ? 'right' : 'left'}-`;
      sync.text($(prefix + 'road'), `${(wheel.roadHeight * 100).toFixed(1)} cm`);
      sync.text($(prefix + 'travel'), `${(wheel.travel * 100).toFixed(1)} cm`);
      sync.text($(prefix + 'spring'), `${Math.round(wheel.springForce)} N`);
      sync.text($(prefix + 'damper'), `${Math.round(wheel.damperForce)} N`);
      sync.text($(prefix + 'contact'), wheel.contact ? 'Styk' : 'Oderwane');
    });
  }

  function updateUI(visibleOnly = false) {
    sync.visibleOnly = visibleOnly;
    const { mode, scene, selectedCylinder } = context;
    if (mode === 'suspension') updateSuspensionUI();
    const manualClutch = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
    const manualPresentation = manualClutchPresentation({ state: manualClutch, engineRpm: sim.rpm, inputOmega: sim.inputOmega, transmittedTorque: sim.transmittedTorque });
    sync.text($('#rpm'), fmt.format(Math.round(sim.rpm / 10) * 10));
    sync.style($('#rpm-bar'), 'width', String(`${Math.min(100, sim.rpm / 6500 * 100)}%`));
    sync.text($('#speed'), Math.round(sim.speed * 3.6));
    sync.text($('#torque'), Math.round(sim.torque));
    sync.text($('#boost'), `${sim.boost.toFixed(2).replace('.', ',')} bar`);
    const status = sim.paused ? 'SYMULACJA WSTRZYMANA' : sim.transmission === 'hybrid' && sim.hybridEnabled && !sim.running ? 'GOTOWY · NAPĘD ELEKTRYCZNY' : sim.running ? 'SILNIK PRACUJE' : sim.stalled ? 'SILNIK ZGASŁ' : 'SILNIK WYŁĄCZONY';
    sync.text($('#engine-status'), mode === 'suspension' ? sim.paused ? 'POKAZ ZATRZYMANY' : 'PRZEJAZD PO NAWIERZCHNI' : status);
    sync.toggle($('#engine-status'), 'inactive', sim.paused || mode !== 'suspension' && !sim.running);
    sync.text($('#ignition span'), sim.transmission === 'hybrid' ? sim.hybridEnabled ? 'Wyłącz hybrydę' : 'Włącz hybrydę' : sim.running ? 'Wyłącz silnik' : 'Uruchom silnik');
    sync.property($('#quick-gear'), 'value', sim.transmission === 'hybrid' ? sim.hybrid.range : sim.shiftTarget ?? sim.gear);
    sync.text($('#ratio-label'), sim.gear ? `${sim.ratios[sim.gear].toFixed(2).replace('.', ',')} : 1` : 'Luz');
    $$('[data-gear]').forEach(button => {
      const active = Number(button.dataset.gear) === (sim.shiftTarget ?? sim.gear);
      sync.toggle(button, 'active', active);
      sync.attr(button, 'aria-pressed', active);
    });
    sync.text($('#drive-status'), sim.transmission === 'automatic' ? sim.shiftTarget !== null ? 'Zmiana automatu: hydraulika przełącza pakiety, konwerter pracuje z poślizgiem.' : sim.gear ? `Bieg ${sim.gear} · ${sim.automatic.lockup > 0.8 ? 'lock-up połączony' : 'napęd przez olej konwertera'}. Bez gazu możliwe pełzanie; użyj hamulca.` : 'N: konwerter obraca się, przekładnia nie napędza kół.' : sim.transmission === 'dct' ? sim.shiftTarget !== null ? 'Zmiana DCT: sterownik reguluje docisk i poślizg K1 / K2.' : sim.gear ? `Bieg ${sim.gear} aktywny; ${sim.dct.prepared} przygotowany na odłączonej gałęzi.` : 'N: oba sprzęgła nie przenoszą napędu.' : sim.shiftTarget !== null ? 'Zmiana biegu trwa. Obserwuj pierścień i przesuwkę; trzymaj pedał wciśnięty.' : sim.stalled ? 'Silnik zgasł. Wciśnij sprzęgło i uruchom go ponownie.' : sim.gear === 0 ? 'Luz: silnik nie napędza kół.' : manualPresentation.kind === 'open' ? 'Sprzęgło rozłączone: silnik nie napędza kół.' : manualPresentation.kind === 'slip' ? 'Poślizg sprzęgła: tarcza i koło zamachowe obracają się z różną prędkością.' : manualPresentation.kind === 'contact' ? 'Sprzęgło w kontakcie · brak przenoszonego momentu.' : 'Sprzęgło zaciśnięte · obroty wyrównane.');
    $$('[data-cylinder]').forEach(button => {
      const i = Number(button.dataset.cylinder);
      const phase = strokeIndex(sim.angle, i, sim.engineId);
      sync.css(button, '--cylinder-color', STROKES[phase].color);
      sync.toggle(button, 'selected', i === selectedCylinder);
      sync.attr(button, 'aria-pressed', i === selectedCylinder);
      sync.property(button, 'title', `Cylinder ${i + 1}: ${STROKES[phase].name}`);
    });
    sync.text($('#turbo-state'), !sim.turbo ? 'Turbo wyłączone' : !sim.running ? 'Silnik zatrzymany' : sim.boost > 0.05 ? 'Sprężarka zwiększa ciśnienie dolotu' : 'Turbo włączone · dodaj gazu');
    sync.text($('#turbo-pressure'), `${sim.boost.toFixed(2).replace('.', ',')} bar`);
    sync.text($('#wastegate-value'), `${Math.round((scene?.turbo.wastegateOpening || 0) * 100)}%`);
    sync.text($('#turbo-explanation'), !sim.turbo ? 'Włącz turbo, aby zobaczyć obrót i przepływ. Potem zwiększ gaz.' : 'Spaliny i powietrze płyną osobno. Wirniki łączy jeden wałek; wastegate to obejście spalin.');
    sync.text($('#turbo-activate'), sim.turbo ? 'Wyłącz turbo' : 'Włącz turbo');
    sync.text($('#mechanism-engine-rpm'), `${Math.round(sim.rpm)} obr./min`);
    sync.text($('#mechanism-input-rpm'), `${Math.round(sim.inputOmega * 30 / Math.PI)} obr./min`);
    sync.text($('#mechanism-output-rpm'), `${Math.round(sim.outputOmega * 30 / Math.PI)} obr./min`);
    if (sim.transmission === 'manual' && lessonView() !== 'clutch') sync.text($('#mechanism-detail'), sim.shiftTarget !== null ? 'Trwa zmiana biegu: śledź etapy w pasku nad modelem.' : mode === 'clutch' ? `Poślizg: ${Math.round(manualPresentation.slipRpm)} obr./min. Wciśnij pedał i obserwuj łożysko, sprężynę oraz docisk.` : sim.gear ? `Bieg ${sim.gear}: wejście obraca się ${sim.ratios[sim.gear].toFixed(2).replace('.', ',')} raza na obrót wyjścia. Strzałki pokazują drogę momentu.` : 'Luz: koła zębate obracają się swobodnie. Żadna para nie jest połączona z wałem wyjściowym.');
    if (sim.transmission === 'dct') {
      sync.text($('#mechanism-state'), sim.shiftTarget !== null ? `DCT · ${sim.shiftStage === 'preselect' ? 'wybór biegu' : sim.shiftStage === 'handover' ? 'przejmowanie napędu' : 'ustalenie docisku'}` : sim.gear ? `K${sim.dct.active + 1} napędza bieg ${sim.gear}` : 'DCT · N · oba pakiety odłączone');
      const dctExplanation = sim.shiftTarget === null
        ? sim.gear ? `Przygotowany bieg ${sim.dct.prepared} ma otwarte sprzęgło.` : 'Oba pakiety są otwarte.'
        : sim.shiftTarget === 0 ? 'Sterownik otwiera pakiety, odłączając napęd na luzie.'
        : sim.shiftStage === 'preselect' ? 'Wybierak ustawia nowy bieg; sterownik reguluje docisk pakietów.'
        : sim.shiftStage === 'lock' ? 'Sterownik ustala docisk sprzęgła nowego biegu.'
        : !sim.shiftFrom ? 'Sprzęgło nowego biegu przejmuje napęd z poślizgiem.'
        : sim.shiftFrom % 2 === sim.shiftTarget % 2 ? 'Sterownik otwiera i ponownie dociska sprzęgło tej samej gałęzi.'
        : 'Oba pakiety przejmują napęd z poślizgiem.';
      sync.text($('#mechanism-detail'), `K1: ${Math.round(sim.dct.torques[0])} Nm · K2: ${Math.round(sim.dct.torques[1])} Nm. ${dctExplanation}`);
    }
    if (sim.transmission === 'automatic') {
      sync.text($('#mechanism-state'), sim.shiftTarget !== null ? '8AT · zmiana przełożenia planetarnego' : sim.gear ? `8AT · bieg ${sim.gear} · ${sim.automatic.lockup > 0.8 ? 'lock-up' : 'konwerter z poślizgiem'}` : '8AT · N · wyjście odłączone');
      sync.text($('#mechanism-detail'), `Poślizg: ${Math.round(sim.automatic.slipRpm)} obr./min · mnożnik momentu ${sim.automatic.torqueRatio.toFixed(2)} · straty ${(sim.automatic.lossPower / 1000).toFixed(1)} kW. Kierownica: ${sim.automatic.statorLocked ? 'podparta' : 'swobodna'}.`);
    }
    const phase = strokeIndex(sim.angle, selectedCylinder, sim.engineId);
    const visual = cycleVisuals(cycleDegrees(sim.angle, selectedCylinder, sim.engineId));
    sync.text($('#intake-status'), `Dolot: ${visual.intake > 0.02 ? 'otwarty' : 'zamknięty'}`);
    sync.text($('#exhaust-status'), `Wydech: ${visual.exhaust > 0.02 ? 'otwarty' : 'zamknięty'}`);
    sync.text($('#combustion-status'), !sim.running ? 'Brak spalania' : visual.spark > 0.1 ? 'Iskra → zapłon' : visual.flame > 0.02 ? 'Front płomienia → spalanie' : phase === 2 ? 'Gorące gazy → rozprężanie' : phase === 3 ? 'Usuwanie spalin' : phase === 1 ? 'Ładunek → mniejsza objętość' : 'Napełnianie cylindra');
    {
      $$('[data-stroke]').forEach(button => {
        const active = Number(button.dataset.stroke) === phase;
        sync.toggle(button, 'active', active);
        sync.attr(button, 'aria-pressed', active);
      });
      sync.text($('#stroke-description'), phase === 1 && sim.injection !== 'gdi' ? 'Tłok zbliża się do głowicy, a zawory dolotowe i wydechowe są zamknięte. Mieszanka powietrza z paliwem zostaje sprężona. Pod koniec tego suwu świeca inicjuje spalanie.' : STROKES[phase].description);
      sync.text($('#stroke-badge'), `0${phase + 1}`);
      sync.style($('#stroke-badge'), 'color', String(STROKES[phase].color));
    }
    updateLessonState();
    updatePowertrainMetrics();
    sync.property($('#phase-overlay'), 'hidden', !['engine','cylinder','timing'].includes(mode));
    sync.text($('#phase-overlay'), `${String(selectedCylinder + 1).padStart(2,'0')} · ${STROKES[phase].name.toUpperCase()} ${phase % 2 ? '↑' : '↓'}`);
    sync.style($('#phase-overlay'), 'color', String(STROKES[phase].color));
    const degrees = Math.round(cycleDegrees(sim.angle, selectedCylinder, sim.engineId));
    if (document.activeElement !== $('#cycle-angle')) sync.property($('#cycle-angle'), 'value', Math.min(719, degrees));
    sync.text($('#angle-readout'), `${degrees}°`);
  }
  return { updateUI, updateLessonState, updateSuspensionUI };
}
