export const DRIVING_HELP = {
  manual: {
    launch: '<strong>Rusz z miejsca.</strong> Wciśnij sprzęgło, wybierz pierwszy bieg, ustaw około 25% gazu i powoli zwalniaj sprzęgło suwakiem.',
    shift: '<strong>Zmień bieg.</strong> Odejmij gaz, wciśnij sprzęgło, wybierz następny bieg i płynnie zwolnij pedał.',
    lesson: '<strong>Poczuj różnicę między biegami.</strong> Wciśnij sprzęgło, wybierz 1, dodaj gazu i powoli zwalniaj pedał. W widoku „Napęd” obserwuj drogę momentu do koła.',
    shortcuts: 'spacja — pauza, Shift — sprzęgło (przytrzymaj), strzałki góra/dół — gaz, N i 1–5 — bieg.'
  },
  dct: {
    launch: '<strong>Rusz z miejsca.</strong> Wybierz bieg 1 i dodaj gazu. Sterownik sam reguluje docisk sprzęgieł K1 i K2.',
    shift: '<strong>Zmień bieg.</strong> Wybierz następny bieg lub włącz automatyczne zmiany. Obserwuj przejmowanie momentu przez drugi pakiet.',
    lesson: '<strong>Porównaj dwa sprzęgła.</strong> Wybierz 1 i dodaj gazu, a potem wybierz 2. Obserwuj K1, K2 i przygotowany bieg w widoku skrzyni.',
    shortcuts: 'spacja — pauza, strzałki góra/dół — gaz, N i 1–6 — bieg.'
  },
  automatic: {
    launch: '<strong>Rusz z miejsca.</strong> Wybierz bieg 1, zwolnij hamulec i dodaj gazu. Konwerter umożliwia pełzanie także bez gazu.',
    shift: '<strong>Zmień bieg.</strong> Wybierz bieg lub włącz automatyczne zmiany. Obserwuj pakiety przekładni planetarnej i lock-up.',
    lesson: '<strong>Sprawdź konwerter i osiem biegów.</strong> Wybierz 1, użyj hamulca i dodaj gazu. W widoku konwertera porównaj obroty pompy i turbiny.',
    shortcuts: 'spacja — pauza, strzałki góra/dół — gaz, N i 1–8 — bieg.'
  },
  hybrid: {
    launch: '<strong>Rusz z miejsca.</strong> Włącz hybrydę, wybierz D i dodaj gazu. Obserwuj przepływ energii między baterią a MG2.',
    shift: '<strong>Porównaj zakresy.</strong> D służy do jazdy, N odłącza napęd, a P wybieraj wyłącznie na postoju. e-CVT nie ma stopniowych biegów.',
    lesson: '<strong>Śledź energię hybrydy.</strong> Wybierz D, dodaj gazu, a następnie zahamuj. Porównaj napęd elektryczny i rekuperację na mapie energii.',
    shortcuts: 'spacja — pauza, strzałki góra/dół — gaz. Zakresy D, N i P wybierz w polu sterowania.'
  }
};

export function updateDrivingHelp(transmission, document) {
  const help = DRIVING_HELP[transmission];
  for (const [selector, value] of [['#help-launch', help.launch], ['#help-shift', help.shift], ['.learning-strip p', help.lesson],
    ['#help-shortcuts', `<strong>Skróty:</strong> ${help.shortcuts} Skróty nie działają podczas edycji pól.`]]) {
    const element = document.querySelector(selector);
    if (element.innerHTML !== value) element.innerHTML = value;
  }
}
