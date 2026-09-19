export const INSPECTIONS = {
  'drive-detail': [
    { id: 'all', label: 'Cały układ', part: 'driveDetail', hint: 'Od spalania do kół. Wybierz podzespół, aby przybliżyć go bez opuszczania tego widoku.' },
    { id: 'engine', label: '1 · Silnik i kolektory', part: 'crank', hint: 'Tłoki → korbowody → wał korbowy. Kolektory łączą cylindry z dolotem i wydechem.' },
    { id: 'clutch', label: '2 · Sprzęgło', part: 'clutch', hint: 'Rozsuń części suwakiem. Wciśnij i zwolnij pedał, obserwując docisk oraz łożysko.' },
    { id: 'gearbox', label: '3 · Skrzynia biegów', part: 'gearbox', hint: 'Wciśnij sprzęgło i wybierz bieg. Przesuwka łączy wybrane koło z wałem wyjściowym.' },
    { id: 'finalDrive', label: '4 · Przekładnia i półosie', part: 'finalDrive', hint: 'Przekładnia 3,9:1 zmniejsza obroty; kosz mechanizmu różnicowego napędza dwie półosie.' },
    { id: 'turbo', label: '5 · Turbo i intercooler', part: 'turbo', hint: 'Oddzielne drogi: spaliny napędzają turbinę, powietrze płynie przez sprężarkę i intercooler.' }
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
