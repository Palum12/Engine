// Factory configurations are referenced in docs/CAR_PRESET_REFERENCES.md.
// Presets choose architecture; shared educational models do not reproduce factory ratios or performance.
const source = (title, url) => Object.freeze({ title, url });
const definePreset = preset => Object.freeze({
  ...preset,
  sources: Object.freeze(preset.sources)
});

const manualNote = 'Fabryczna skrzynia ma 6 biegów; tutaj działa wspólny model ręcznej skrzyni 5-biegowej. Przełożenia, pojemność modelu i osiągi są dydaktyczne.';
const dctNote = gears => `Fabryczna skrzynia ma ${gears} biegów; tutaj działa wspólny model DCT 6-biegowego. Przełożenia, pojemność modelu i osiągi są dydaktyczne.`;
const automaticNote = 'Wspólny model automatu hydrokinetycznego ma 8 biegów, ale jego przełożenia, geometria i sterowanie są dydaktyczne; nie są danymi fabrycznej skrzyni.';

export const CAR_PRESETS = Object.freeze([
  definePreset({
    id: 'corolla-hybrid-2025', name: 'Toyota Corolla 1.8 Hybrid', year: 2025, variant: 'E210 hatchback · 1.8 Hybrid 140 · Europa',
    engineId: 'r4', engineOrientation: 'transverse', enginePlacement: 'front', transmission: 'hybrid', driveLayout: 'fwd',
    turbo: false, injection: 'mpi', timing: 'chain', factoryDisplacement: '1.8 l', factoryTransmission: 'Toyota e-CVT', factoryGears: null,
    summary: 'R4 poprzecznie z przodu · FWD · hybryda e-CVT z rozdziałem mocy.',
    note: 'Współczesna Corolla z hybrydą piątej generacji. e-CVT Toyoty wykorzystuje przekładnię planetarną oraz MG1/MG2; nie jest pasową CVT ani DCT. Model pokazuje zasadę działania, bez fabrycznych osiągów i pełnego sterowania hybrydy.',
    sources: [source('Toyota — Corolla 2025, dane techniczne', 'https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/250402-Corolla.pdf'), source('Toyota — piąta generacja napędu hybrydowego', 'https://media.toyota.co.uk/toyota-launches-the-new-corolla-with-fifth-generation-hybrid-electric-technology/')]
  }),
  definePreset({
    id: 'a4-quattro-2011', name: 'Audi A4 2.0 TFSI quattro', year: 2011, variant: 'B8 · 2.0 TFSI 211 PS · S tronic · Europa',
    engineId: 'r4', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'dct', driveLayout: 'quattro',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '2.0 l', factoryTransmission: '7-biegowa S tronic', factoryGears: 7,
    summary: 'R4 wzdłużnie z przodu · stałe quattro z centralnym dyferencjałem · S tronic.',
    note: `Wybrano B8 z mechanicznym centralnym dyferencjałem i nominalnym podziałem przód/tył 40:60. Nowsze quattro ultra ma inną konstrukcję. ${dctNote(7)}`,
    sources: [source('Audi — Annual Report 2011, specyfikacje A4', 'https://www.audi.com/content/dam/gbp2/downloads/report/annual-reports/2011/en/2011-audi-annual-report-financial.pdf'), source('Audi — samoblokujący centralny dyferencjał, stan 2011', 'https://www.audi-technology-portal.de/en/drivetrain/quattro_en/self-locking-center-differential')]
  }),
  definePreset({
    id: '911-carrera-s-2025', name: 'Porsche 911 Carrera S', year: 2025, variant: '992.2 · Carrera S Coupé · PDK · RWD',
    engineId: 'boxer6', engineOrientation: 'longitudinal', enginePlacement: 'rear', transmission: 'dct', driveLayout: 'rwd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '3.0 l', factoryTransmission: '8-biegowa PDK', factoryGears: 8,
    summary: 'Boxer 6 wzdłużnie za tylną osią · RWD · dwusprzęgłowa PDK.',
    note: `Carrera S ma 3.0 twin-turbo i napęd na tył. Silnik leży za osią, inaczej niż w samochodzie z silnikiem centralnym. Model turbo pokazuje jedną sprężarkę. ${dctNote(8)}`,
    sources: [source('Porsche — 2025 Carrera S', 'https://newsroom.porsche.com/en_US/2025/products/porsche-911-carrera-s-and-cabriolet-38321.html'), source('Porsche — historia i tylny silnik 911', 'https://newsroom.porsche.com/en_US/company/porsche-cars-north-america-historical-background-18072.html')]
  }),
  definePreset({
    id: 'veyron-2005', name: 'Bugatti Veyron 16.4', year: 2005, variant: '16.4 Coupé · 8.0 W16 · 1001 PS',
    engineId: 'w16', engineOrientation: 'longitudinal', enginePlacement: 'mid', transmission: 'dct', driveLayout: 'awd',
    turbo: true, injection: 'mpi', timing: 'chain', factoryDisplacement: '8.0 l', factoryTransmission: '7-biegowa DCT', factoryGears: 7,
    summary: 'W16 wzdłużnie centralnie · AWD · cztery turbo · DCT.',
    note: `Skrzynia fabrycznego Veyrona znajduje się przed silnikiem. AWD jest tu wspólnym schematem napędu obu osi, a turbo pokazuje zasadę jednej z czterech sprężarek. ${dctNote(7)}`,
    sources: [source('Bugatti — architektura W16 i położenie w Veyronie', 'https://newsroom.bugatti.com/en/press-releases/bugatti-w16-engine-the-last-of-its-kind'), source('Bugatti — 7-biegowa dwusprzęgłowa skrzynia i AWD', 'https://newsroom.bugatti.com/en/press-releases/the-world-s-first-twin-clutch-gearbox-with-seven-speeds')]
  }),
  definePreset({
    id: 'golf-gti-2013', name: 'Volkswagen Golf VII GTI', year: 2013, variant: '2.0 TSI 220 PS · 6-biegowa DSG',
    engineId: 'r4', engineOrientation: 'transverse', enginePlacement: 'front', transmission: 'dct', driveLayout: 'fwd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '2.0 l', factoryTransmission: '6-biegowa DSG', factoryGears: 6,
    summary: 'R4 poprzecznie z przodu · FWD · turbo · 6-biegowa DSG.',
    note: `Wariant GTI z początku generacji VII; późniejsze GTI oferowały też DSG 7-biegową. Fabryczne zasilanie EA888 łączy wtrysk bezpośredni i pośredni; wybrano ilustrację GDI. ${dctNote(6)}`,
    sources: [source('Volkswagen — Golf GTI 2013, napęd i 6-biegowa DSG', 'https://www.volkswagen-newsroom.com/en/new-golf-gti-international-press-presentation-2976/new-golf-gti-overview-facts-in-key-words-3015'), source('Volkswagen — EA888 i połączony wtrysk bezpośredni/pośredni', 'https://www.volkswagen-newsroom.com/en/new-golf-gti-international-press-presentation-2976')]
  }),
  definePreset({
    id: '508-eat8-2018', name: 'Peugeot 508 GT PureTech', year: 2018, variant: 'II · 1.6 PureTech 225 · EAT8 · bez hybrydy',
    engineId: 'r4', engineOrientation: 'transverse', enginePlacement: 'front', transmission: 'automatic', driveLayout: 'fwd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '1.6 l', factoryTransmission: '8-biegowa EAT8 Aisin', factoryGears: 8,
    summary: 'R4 poprzecznie z przodu · FWD · automat hydrokinetyczny EAT8.',
    note: `Benzynowy 1.6 PureTech z EAT8 pokazuje układ poprzeczny z konwerterem i blokadą lock-up. Wybrano wersję bez silnika elektrycznego. ${automaticNote}`,
    sources: [source('Peugeot — nowy 508, PureTech 180/225 EAT8', 'https://www.media.stellantis.com/em-en/download-model-document/186'), source('Peugeot — EAT8 opracowana z Aisin i konwerter momentu', 'https://www.media.stellantis.com/ch-de/peugeot/press/neuer-peugeot-308-die-technologieoffensive')]
  }),
  definePreset({
    id: 'mx5-2024', name: 'Mazda MX-5', year: 2024, variant: 'ND · 2.0 Skyactiv-G · Club · 6MT · USA',
    engineId: 'r4', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'manual', driveLayout: 'rwd',
    turbo: false, injection: 'gdi', timing: 'chain', factoryDisplacement: '2.0 l', factoryTransmission: '6-biegowa Skyactiv-MT', factoryGears: 6,
    summary: 'Wolnossące R4 wzdłużnie z przodu · RWD · skrzynia ręczna.',
    note: manualNote,
    sources: [source('Mazda — MX-5 2024, silnik i napęd', 'https://news.mazdausa.com/vehicles-2024-mx-5')]
  }),
  definePreset({
    id: '330i-2019', name: 'BMW 330i', year: 2019, variant: 'G20 Sedan · 2.0 turbo · RWD · USA',
    engineId: 'r4', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'automatic', driveLayout: 'rwd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '2.0 l', factoryTransmission: '8-biegowa Steptronic (ZF 8HP)', factoryGears: 8,
    summary: 'R4 wzdłużnie z przodu · RWD · 8-biegowy automat hydrokinetyczny.',
    note: `Wybrano 330i bez xDrive. Steptronic jest nazwą BMW; ten wariant ma ZF 8HP, a nie Aisin. ${automaticNote}`,
    sources: [source('BMW — nowe 330i 2019 i 8HP', 'https://www.press.bmwgroup.com/usa/article/detail/T0285572EN_US/the-all-new-2019-bmw-3-series?language=en_US')]
  }),
  definePreset({
    id: '340i-2016', name: 'BMW 340i', year: 2016, variant: 'F30 Sedan · 3.0 B58 · RWD · Steptronic · USA',
    engineId: 'r6', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'automatic', driveLayout: 'rwd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '3.0 l', factoryTransmission: '8-biegowa Steptronic (ZF 8HP50)', factoryGears: 8,
    summary: 'R6 wzdłużnie z przodu · RWD · turbo twin-scroll · automat 8AT.',
    note: `Rzędowa szóstka B58 i automat ZF; nazwa TwinPower Turbo nie oznacza dwóch sprężarek. ${automaticNote}`,
    sources: [source('BMW — 340i model 2016, B58 i 8HP50', 'https://www.press.bmwgroup.com/usa/article/detail/T0216443EN_US/the-new-bmw-3-series-sedan-and-sports-wagon?language=en_US')]
  }),
  definePreset({
    id: 'golf-r32-2005', name: 'Volkswagen Golf V R32', year: 2005, variant: '3.2 VR6 · 4MOTION · DSG · Europa',
    engineId: 'vr6', engineOrientation: 'transverse', enginePlacement: 'front', transmission: 'dct', driveLayout: 'awd',
    turbo: false, injection: 'mpi', timing: 'chain', factoryDisplacement: '3.2 l', factoryTransmission: '6-biegowa DSG', factoryGears: 6,
    summary: 'VR6 poprzecznie z przodu · 4MOTION · wolnossący · DSG.',
    note: `4MOTION R32 korzysta ze sprzęgła dołączającego tylną oś; wspólny model AWD pokazuje drogę momentu do obu osi, bez odtwarzania sterowania Haldex. ${dctNote(6)}`,
    sources: [source('Volkswagen — Golf V, R32 2005', 'https://www.volkswagen-newsroom.com/en/golf-5-20032008-19480'), source('Volkswagen — R32 2005, poprzeczna DSG i Haldex', 'https://www.volkswagen.es/comunicacion/dossier/dossier-golf-r32/')]
  }),
  definePreset({
    id: 'wrx-2024', name: 'Subaru WRX', year: 2024, variant: 'VB · 2.4 DIT · 6MT · USA',
    engineId: 'boxer4', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'manual', driveLayout: 'awd',
    turbo: true, injection: 'gdi', timing: 'chain', factoryDisplacement: '2.4 l', factoryTransmission: '6-biegowa ręczna', factoryGears: 6,
    summary: 'Boxer 4 wzdłużnie z przodu · Symmetrical AWD · turbo · skrzynia ręczna.',
    note: `Wybrano 6MT; Subaru Performance Transmission w innych wersjach to CVT, której ten preset nie udaje. Model AWD jest ogólny, bez charakterystyki sprzęgła wiskotycznego Subaru. ${manualNote}`,
    sources: [source('Subaru — WRX 2024, specyfikacja producenta', 'https://www.subaru.com/content/dam/subaru/downloads/pdf/brochures/2024/2024_WRX_Brochure_031924.pdf')]
  }),
  definePreset({
    id: '458-italia-2009', name: 'Ferrari 458 Italia', year: 2009, variant: '4.5 V8 · F1 DCT',
    engineId: 'v8', engineOrientation: 'longitudinal', enginePlacement: 'mid', transmission: 'dct', driveLayout: 'rwd',
    turbo: false, injection: 'gdi', timing: 'chain', factoryDisplacement: '4.5 l', factoryTransmission: '7-biegowa F1 DCT', factoryGears: 7,
    summary: 'Wolnossące V8 wzdłużnie centralnie · RWD · dwusprzęgłowa F1 DCT.',
    note: `Model V8 z płaskim wałem i wtryskiem bezpośrednim ilustruje architekturę 458, bez fabrycznej numeracji cylindrów i funkcji E-Diff. ${dctNote(7)}`,
    sources: [source('Ferrari — historia 458 Italia i 7-biegowej DCT', 'https://www.ferrari.com/en-MG/history/moments/2009/benchmark-car/more'), source('Ferrari — 458, położenie silnika i kąt V8', 'https://www.ferrari.com/en-PA/history/garage/2009/458-italia'), source('Prezentacja techniczna Ferrari — V8 458 i 488', 'https://www.nmpro.net/uploadImages/GalleryDocs/Doc5931.pdf')]
  }),
  definePreset({
    id: 'wrangler-2018', name: 'Jeep Wrangler Sport', year: 2018, variant: 'JL · 3.6 Pentastar V6 · 6MT · Command-Trac · USA',
    engineId: 'v6', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'manual', driveLayout: 'partTime',
    turbo: false, injection: 'mpi', timing: 'chain', factoryDisplacement: '3.6 l', factoryTransmission: '6-biegowa ręczna', factoryGears: 6,
    summary: 'V6 wzdłużnie z przodu · dołączane 4×4 · reduktor · skrzynia ręczna.',
    note: `Command-Trac: 2H napędza tył, 4H/4L sztywno łączą osie. Fabryczny reduktor ma 2,72:1; model używa dydaktycznych 2,5:1. ${manualNote}`,
    sources: [source('Jeep — Wrangler 2018, Pentastar, 6MT i Command-Trac', 'https://www.media.stellantis.com/br-pt/jeep/press/novo-jeep-wrangler-o-suv-mais-capaz-de-todos-os-tempos')]
  }),
  definePreset({
    id: '812-superfast-2017', name: 'Ferrari 812 Superfast', year: 2017, variant: '6.5 V12 · F1 DCT',
    engineId: 'v12', engineOrientation: 'longitudinal', enginePlacement: 'front', transmission: 'dct', driveLayout: 'rwd',
    turbo: false, injection: 'gdi', timing: 'chain', factoryDisplacement: '6.5 l', factoryTransmission: '7-biegowa F1 DCT', factoryGears: 7,
    summary: 'Wolnossące V12 wzdłużnie z przodu · RWD · dwusprzęgłowa skrzynia.',
    note: `Fabryczny V12 ma kąt 65° i leży za przednią osią (front-mid); wspólny model V12 ma 60° i ogólny układ przedni. Tylna skrzynia transaxle nie jest odwzorowana w schemacie. ${dctNote(7)}`,
    sources: [source('Ferrari — 812 Superfast, silnik V12 i DCT', 'https://www.ferrari.com/en-US/corporate/articles/the-ferrari-812-superfast-the-new-extreme-performance-v12-berlinetta'), source('Ferrari Approved — 812 Superfast, 7-biegowa DCT', 'https://preowned.ferrari.com/en-EN/a/north-america/used-ferrari/usa/ferrari-of-washington-/812-superfast/ZFF83CLA2K0243569-1767969512335')]
  })
]);

export const getCarPreset = id => CAR_PRESETS.find(preset => preset.id === id) ?? null;
