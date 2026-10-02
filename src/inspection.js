export const INSPECTIONS = {
  'drive-detail': [
    { id: 'all', label: 'Cały układ', part: 'driveDetail', hint: 'Od spalania do kół. Wybierz podzespół, aby przybliżyć go bez opuszczania tego widoku.' },
    { id: 'engine', label: '1 · Silnik i kolektory', part: 'crank', hint: 'Tłoki → korbowody → wał korbowy. Kolektory łączą cylindry z dolotem i wydechem.' },
    { id: 'clutch', label: '2 · Sprzęgło', part: 'clutch', hint: 'Rozsuń części suwakiem. Wciśnij i zwolnij pedał, obserwując docisk oraz łożysko.' },
    { id: 'gearbox', label: '3 · Skrzynia biegów', part: 'gearbox', hint: 'Wciśnij sprzęgło i wybierz bieg. Przesuwka łączy wybrane koło z wałem wyjściowym.' },
    { id: 'finalDrive', label: '4 · Przekładnia i półosie', part: 'finalDrive', hint: 'Przekładnia 3,9:1 zmniejsza obroty; kosz mechanizmu różnicowego napędza dwie półosie.' },
    { id: 'timing', label: '6 · Rozrząd', part: 'timing', hint: 'Wał korbowy napędza wałki przez pasek lub łańcuch w stosunku 2:1.' },
    { id: 'oil', label: '7 · Obieg oleju', part: 'oilPump', hint: 'Miska, smok, pompa, filtr, magistrala i spływ oleju.' },
    { id: 'fuel', label: '8 · Zasilanie paliwem', part: 'fuelPump', hint: 'Zbiornik, pompa, filtr i wybrany układ przygotowania mieszanki.' },
    { id: 'turbo', label: '5 · Turbo i intercooler', part: 'turbo', hint: 'Oddzielne drogi: spaliny napędzają turbinę, powietrze płynie przez sprężarkę i intercooler.' }
  ],
  clutch: [{id:'all',label:'Styk tarcz i wał wejściowy',part:'clutch',hint:'Złóż części, zwolnij pedał i obserwuj zielone powierzchnie styku. Przy wciśniętym pedale powstaje szczelina.'}],
  gearbox: [
    { id: 'all', label: 'Cała skrzynia', part: 'gearbox', hint: 'Wciśnij sprzęgło i wybierz bieg. Pomarańczowy pierścień: synchronizacja; złota przesuwka: połączenie z wałem.' },
    ...[1,2,3,4,5].map(n => ({id: `gear${n}`, label: `Bieg ${n} · zbliżenie`, part: 'synchronizer', hint: 'Koło obraca się luźno. Pierścień wyrównuje obroty, potem przesuwka łączy zęby koła z piastą wału.'}))
  ],
  differential: [
    {id:'all',label:'Cała oś',part:'differential',hint:'Niebieskie koło lewe, złote prawe. Na zakręcie zewnętrzne koło pokonuje dłuższą drogę.'},
    {id:'core',label:'Satelity · zbliżenie',part:'differential',hint:'Na wprost satelity krążą z koszem. W zakręcie dodatkowo obracają się na własnych osiach.'}
  ],
  timing: [
    {id:'all',label:'Rozrząd przy silniku',part:'timing',hint:'Wałki rozrządu wykonują 1 obrót na 2 obroty wału. Gałęzie napędu zależą od głowic; VR/W mają w schemacie stopień pośredni.'},
    {id:'timing',label:'Napęd rozrządu',part:'timing',hint:'Wybierz pasek lub łańcuch w konfiguracji. Znaki na kołach pokazują stosunek obrotów 2:1.'}
  ],
  oil: [
    {id:'all',label:'Smarowanie silnika',part:'oilPump',hint:'Miska → smok → pompa → filtr → magistrala → łożyska → spływ do miski.'},
    {id:'oil',label:'Sam obieg oleju',part:'oilGallery',hint:'Jasnozielony: dopływ pod ciśnieniem. Ciemnozielony: spływ grawitacyjny; kanały są pokazane na zewnątrz dla czytelności.'}
  ],
  fuel: [
    {id:'all',label:'Zasilanie przy silniku',part:'fuelPump',hint:'Zbiornik → pompa → filtr → gaźnik lub listwa wtryskowa. Niebieska droga to powietrze, złota to paliwo.'},
    {id:'carburetor',label:'Gaźnik · zbliżenie',part:'carburetor',hint:'Niebieskie powietrze przechodzi przez zwężkę; złote paliwo wypływa z dyszy. Klapa poniżej to przepustnica.'},
    {id:'highPressurePump',label:'Pompa GDI · zbliżenie',part:'highPressurePump',hint:'Ruch tłoczka podnosi ciśnienie przed listwą wtryskową. To drugi stopień po pompie w zbiorniku.'},
    {id:'fuel',label:'Sam układ zasilania',part:'carburetor',hint:'Zmień gaźnik / MPI / GDI. GDI dodaje pompę wysokiego ciśnienia; gaźnik miesza paliwo z powietrzem w zwężce.'}
  ],
  turbo: [
    { id: 'all', label: 'Cała turbosprężarka', part: 'turbo', hint: 'Spaliny → turbina → wspólny wałek → sprężarka → intercooler → silnik.' },
    { id: 'turbine', label: '1 · Turbina spalinowa', part: 'turbine', hint: 'Spaliny wpływają do obudowy spiralnej, napędzają łopatki i opuszczają turbinę osiowo.' },
    { id: 'turboBearing', label: '2 · Wałek i łożyska', part: 'turboBearing', hint: 'Jeden wałek łączy oba wirniki. Olej smaruje łożyska i odprowadza część ciepła.' },
    { id: 'compressor', label: '3 · Sprężarka', part: 'compressor', hint: 'Powietrze wpływa osiowo i jest wyrzucane promieniowo do dyfuzora oraz obudowy spiralnej.' },
    { id: 'wastegate', label: '4 · Zawór wastegate', part: 'wastegate', hint: 'Otwarte obejście kieruje część spalin obok wirnika turbiny, ograniczając jego napęd.' },
    { id: 'intercooler', label: '5 · Intercooler i przepustnica', part: 'intercooler', hint: 'Po sprężeniu powietrze jest cieplejsze. Intercooler je chłodzi przed przepustnicą i cylindrami.' }
  ]
};

export function getInspections(view, sim) {
  if (['drive', 'drive-detail'].includes(view)) {
    const transmission = sim.transmission === 'hybrid' ? [
      { id: 'psd', label: 'Podział mocy · przekładnia planetarna', part: 'psd', hint: 'Jarzmo: silnik. Słońce: MG1. Wieniec: wyjście. Koła pozostają zazębione, a sterownik dobiera obroty maszyn.' },
      { id: 'mg1', label: 'MG1 · generator / rozrusznik', part: 'mg1', hint: 'MG1 może generować, napędzać albo obracać się biernie. Sam obrót nie oznacza przepływu energii.' },
      { id: 'mg2', label: 'MG2 · napęd / rekuperacja', part: 'mg2', hint: 'MG2 jest połączone z wyjściem. Przy hamowaniu koła napędzają generator.' },
      { id: 'battery', label: 'Bateria · moduły / styczniki / prąd DC', part: 'battery', hint: 'Pomarańczowy przewód: dodatni, jasny: powrotny. Kierunek prądu stałego odwraca się podczas ładowania.' },
      { id: 'inverter', label: 'Falownik · DC ↔ trójfazowe AC', part: 'inverter', hint: 'Prąd fazowy zmienia kierunek. Strzałki na kablach AC przedstawiają średni kierunek przekazywania energii.' }
    ] : [
      { id: 'clutch', label: sim.transmission === 'dct' ? 'Dwa sprzęgła · K1 / K2' : 'Sprzęgło · tarcza / docisk', part: sim.transmission === 'dct' ? 'dctClutches' : 'clutch', hint: sim.transmission === 'dct' ? 'Docisk pakietu przenosi moment. Bieg przygotowany na drugim wale pozostaje odłączony od silnika.' : 'Wciśnij pedał. Tarcza zwalnia się i silnik może obracać się niezależnie od skrzyni.' },
      { id: 'gearbox', label: sim.transmission === 'dct' ? 'DCT · wały / biegi / przesuwki' : 'Manual · pary kół / synchronizatory', part: sim.transmission === 'dct' ? 'dct' : 'gearbox', hint: 'Stale zazębione pary kół. Przesuwka łączy wybrane koło z wałem; sama obecność zazębienia nie oznacza napędu.' },
      ...(sim.transmission === 'dct' ? [{ id: 'mechatronics', label: 'Mechatronika i hydraulika DCT', part: 'mechatronics', hint: 'Zawory regulują ciśnienie tłoków docisku i sterują wybierakami. Obieg oleju obejmuje pompę, filtr i chłodnicę.' }] : [])
    ];
    return [
      { id: 'all', label: 'Cały pojazd', part: 'driveDetail', hint: 'Wybierz warstwę, podzespół i poziom detalu. Gaz, bieg i hamulec zmieniają wspólną symulację wszystkich podzespołów.' },
      { id: 'engine', label: 'Silnik · tłoki / wał / rozrząd', part: 'crank', hint: 'Zbliżenie zachowuje położenie silnika w pojeździe. „Odizoluj” pozwala ukryć pozostałe zespoły.' },
      ...transmission,
      ...(['awd', 'quattro', 'partTime'].includes(sim.driveLayout) ? [{ id: 'transfer', label: sim.driveLayout === 'partTime' ? 'Skrzynia rozdzielcza i reduktor' : 'Centralny mechanizm różnicowy', part: sim.driveLayout === 'quattro' ? 'quattro' : 'transfer', hint: 'Rozdział napędu między osiami. Porównaj obroty, moment i zachowanie na różnej nawierzchni.' }] : []),
      { id: 'frontAxle', label: 'Przednia oś · dyferencjał / półosie', part: 'frontAxle', hint: 'Przednie koła skręcają. W FWD/AWD są napędzane; w RWD toczą się bez momentu napędowego.' },
      { id: 'rearAxle', label: 'Tylna oś · dyferencjał / półosie', part: 'rearAxle', hint: 'Różnica obrotów półosi wynika z zakrętu lub utraty przyczepności. Moment i obroty są oddzielnymi wielkościami.' },
      ...INSPECTIONS['drive-detail'].filter(entry => ['timing', 'oil', 'fuel', 'turbo'].includes(entry.id))
    ];
  }
  if (view === 'hybrid') return [
    { id: 'all', label: 'Cała hybryda', part: 'hybrid', hint: 'Wybierz EV, podział mocy, rekuperację lub ładowanie na postoju. Śledź osobno mechanikę oraz prąd DC / energię AC.' },
    ...getInspections('drive-detail', { ...sim, transmission: 'hybrid' }).filter(entry => ['psd', 'mg1', 'mg2', 'battery', 'inverter'].includes(entry.id))
  ];
  if (view === 'transfer') return [{ id: 'all', label: 'Rozdział napędu między osiami', part: sim.driveLayout === 'quattro' ? 'quattro' : 'transfer', hint: 'Wybierz 4WD / AWD / quattro w konfiguracji. Blokada wymusza wspólne obroty, a nie stały podział momentu 50:50.' }];
  if (sim.transmission === 'dct' && view === 'clutch') return [{ id: 'all', label: 'Pakiety K1 / K2', part: 'dctClutches', hint: 'Tarcze wejściowe obraca silnik, tarcze wyjściowe obraca odpowiedni wał. Ciśnienie docisku reguluje moment.' }];
  if (sim.transmission === 'dct' && view === 'gearbox') return [
    { id: 'all', label: 'Cała DCT', part: 'dct', hint: 'Niebieski K1: 1/3/5. Miedziany K2: 2/4/6. Bieg przygotowany ma wybraną przesuwkę i otwarte sprzęgło.' },
    { id: 'dctShafts', label: 'Dwa współosiowe wały wejściowe', part: 'dctShafts', hint: 'Wewnętrzny wał K1 obraca się niezależnie od rurowego wału K2. Dwa wały wyjściowe przekazują napęd dalej.' },
    { id: 'mechatronics', label: 'Mechatronika i obieg oleju', part: 'mechatronics', hint: 'Elektrozawory sterują dociskiem sprzęgieł i ruchem wybieraków. Olej także smaruje oraz chłodzi.' }
  ];
  return INSPECTIONS[view];
}
