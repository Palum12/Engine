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
    {id:'all',label:'Rozrząd przy silniku',part:'timing',hint:'24 zęby na wale, 48 na wałku: wałek rozrządu wykonuje 1 obrót na 2 obroty wału.'},
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
