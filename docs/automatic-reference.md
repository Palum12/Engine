# Automatic transmission reference

Verified on 2026-10-03 against primary manufacturer material:

- [AISIN product range: AT, CVT, MT](https://www.aisin.com/en/product/mobility/ats-cvts-mts/) lists both FWD and RWD eight-speed automatic transmissions.
- [AISIN: GR-DAT development, part 2, 2026-06-25](https://aisin.com/en/aithink/innovation/blog/010664.html) explains that conventional ATs use torque-converter lock-up across much of the operating range, with launch as the main exception; GR-DAT widens that range and strengthens the damper.
- [Volkswagen self-study program 850193: The 8-Speed Automatic Transmission 09P](https://static.nhtsa.gov/odi/tsbs/2019/MC-10159424-0001.pdf), a manufacturer publication hosted by NHTSA, describes the pump, turbine, stator, torque multiplication and converter lock-up clutch in an AISIN eight-speed transmission.

## What this app represents

The converter demonstrates idle creep, slip, stator reaction at low turbine/pump speed ratios, stator freewheeling near coupling, and a separate lock-up friction path. Its characteristic curve, hydraulic coefficient, shift schedule and lock-up thresholds are educational calibrations. They are not measured AISIN data. Forward D, neutral N and parking P are supported; reverse is outside the current simulator.

The visible gearbox is a coherent **educational modular schematic**, not the factory topology or clutch application table of any AISIN transmission. Three simple planetary stages select reduction or direct drive, followed by one fixed overdrive stage. Every sun, carrier, ring and planet obeys the simple planetary equations. Their eight combinations give the ratios 4.42, 3.40, 2.60, 2.00, 1.4733, 1.1333, 0.8667 and 0.6667. The model therefore shows why hydraulic brakes and friction packs can select ratios without a clutch pedal, while making the simplification explicit.

`src/automatic.js` computes hydraulic and lock-up torque separately. Converter input power minus turbine output power is nonnegative heat loss. The gearbox ratio multiplies torque; wheel-side traction limits and braking still run through the shared `Simulation.move()` function. The simplified model omits oil temperature, pressure dynamics, elastic damper motion and the mass/inertia of the entire gearbox. Changing transmission resets converter and gearbox state.
