# Driver troubleshooting case audit

Generated: 2026-09-11T17:25:14.882Z

This tests software outcomes, not whether a repair works on a real vehicle. 'Can confirm resolution' means the driver explicitly reports that the original problem has gone away after an approved observation. None of the current guide steps are classified as SAFE_ACTION repair procedures.

## Scope and totals

All active guides and approved answer branches; all original archive symptom examples; bounded uncertainty and safety wording probes. Car sessions, real Python and Node code; MongoDB and GPT are isolated substitutes.

- archiveRecords: 99
- activeGuides: 87
- excludedSourceRecords: 12
- canConfirmResolution: 3
- checksOnly: 22
- immediateProfessionalHelp: 62
- terminalPaths: 127
- resolvedPaths: 4
- uncertaintyPoints: 35
- startupExamples: 99
- safetyProbes: 72
- safetyPassed: 48
- safetyMismatches: 24

## Cases that can reach confirmed resolution

| Guide | Required answer sequence | Final result |
| --- | --- | --- |
| Battery Replacement | Clean terminals → resolved | Resolved |
| Windshield Washer Fluid | Sufficient fluid level → resolved | Resolved |
| Windshield Washer Fluid | Sufficient fluid level → unresolved → Pump operates correctly → resolved | Resolved |
| Tire Pressure Monitoring System (TPMS) | Correct pressure → resolved | Resolved |

Corroded terminals, incorrect tyre pressure, low washer fluid and faulty pumps still escalate: approved cleaning, inflation, refill and repair instructions are absent. A normal result without confirmation that the original problem is gone does not mark a session resolved.

## Outcomes by problem category

These are capabilities of the current chatbot, not a judgment that drivers can never address these problems. In particular, none of the cooling/temperature guides currently reaches confirmed resolution.

| Category | Can confirm resolution | Checks only | Immediate professional help |
| --- | --- | --- | --- |
| brake_system_fault | 0 | 0 | 10 |
| air_conditioning_fault | 0 | 5 | 1 |
| cooling_system_fault | 0 | 9 | 1 |
| drivetrain_fault | 0 | 0 | 11 |
| electrical_system_fault | 1 | 3 | 3 |
| emissions_system_fault | 0 | 0 | 9 |
| engine_system_fault | 0 | 5 | 13 |
| steering_system_fault | 0 | 0 | 2 |
| fuel_system_fault | 0 | 0 | 5 |
| visibility_system_fault | 1 | 0 | 0 |
| transmission_fault | 0 | 0 | 5 |
| wheel_tire_fault | 1 | 0 | 2 |

## Every active guide

| ID | Guide | Category | Risk | Outcome capability | Paths tested |
| --- | --- | --- | --- | --- | --- |
| ai2_aktc_0001 | ABS Control Module | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0002 | ABS Wheel Speed Sensor | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0003 | Brake Booster | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0004 | Brake Caliper | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0005 | Brake Hose | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0006 | Brake Master Cylinder | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0007 | Brake Pad | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0008 | Brake Rotor | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0009 | Brake Shoe & Drum | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0010 | AC Compressor | air_conditioning_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0011 | AC Condenser | air_conditioning_fault | CAUTION | Checks only; then professional help | 4 |
| ai2_aktc_0012 | AC Evaporator | air_conditioning_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0013 | AC Recharge | air_conditioning_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0015 | Cabin Air Filter | air_conditioning_fault | LOW | Checks only; then professional help | 2 |
| ai2_aktc_0017 | Heater Blower Motor Resistor | air_conditioning_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0018 | Coolant/Antifreeze | cooling_system_fault | CAUTION | Checks only; then professional help | 4 |
| ai2_aktc_0019 | Coolant Leak Diagnosis | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0020 | Engine Cooling System | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0021 | Heater Core | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0022 | Heater Hose | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0023 | Radiator/Cooling Fan | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0024 | Radiator Hose | cooling_system_fault | CAUTION | Checks only; then professional help | 4 |
| ai2_aktc_0025 | Water Pump | cooling_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0026 | Bevel Gears | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0027 | Center Differential | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0028 | Clutch Cable | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0029 | Clutch Slave Cylinder | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0030 | Differential | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0031 | Live Axle | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0032 | Rigid Axle | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0033 | Slushbox | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0034 | Universal Joint | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0035 | Viscous Coupling | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0036 | Battery Replacement | electrical_system_fault | CAUTION | Can confirm resolution | 3 |
| ai2_aktc_0040 | Door Window Regulator | electrical_system_fault | LOW | Checks only; then professional help | 2 |
| ai2_aktc_0042 | Ignition Distributor Cap | electrical_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0043 | Ignition Wire Set | electrical_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0045 | Starter Motor | electrical_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0046 | Windshield Washer Pump | electrical_system_fault | LOW | Checks only; then professional help | 2 |
| ai2_aktc_0048 | Canister Purge Valve | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0049 | Catalytic Converter | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0050 | Charcoal Canister | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0051 | Exhaust Manifold | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0052 | Exhaust Manifold Gasket | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0053 | Fuel Tank Pressure Sensor | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0054 | Knock Sensor | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0055 | M.A.P. Sensor | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0056 | Oxygen Sensor | emissions_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0058 | Boost Pressure | engine_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0059 | Diesel Injection Pump | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0061 | Engine Mounts | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0062 | Exhaust Valve | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0063 | Fuel Injector | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0064 | Idle Air Control Valve | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0065 | Intake Valve | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0066 | Oil Pump | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0067 | Piston Rings | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0068 | Timing Belt | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0069 | Valve Cover Gasket | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0070 | Fan Belt | engine_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0071 | Horn | electrical_system_fault | LOW | Checks only; then professional help | 2 |
| ai2_aktc_0073 | Engine Belt | engine_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0074 | Steering Noise | steering_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0075 | Shaft and Tires | drivetrain_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0076 | Air Filter | engine_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0077 | Engine Control Unit (ECU) | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0078 | Engine Oil | engine_system_fault | CAUTION | Checks only; then professional help | 4 |
| ai2_aktc_0079 | Fuel Filter | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0080 | PCV Valve | engine_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0082 | Fuel Injector | fuel_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0083 | Fuel Pressure Regulator | fuel_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0084 | Fuel Pump | fuel_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0085 | Fuel Tank | fuel_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0086 | Throttle Position Sensor | fuel_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0087 | Brake Fluid | brake_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0088 | Coolant Reservoir | cooling_system_fault | CAUTION | Checks only; then professional help | 4 |
| ai2_aktc_0089 | Power Steering Fluid | steering_system_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0090 | Radiator | cooling_system_fault | CAUTION | Checks only; then professional help | 2 |
| ai2_aktc_0091 | Windshield Washer Fluid | visibility_system_fault | LOW | Can confirm resolution | 5 |
| ai2_aktc_0092 | Clutch Master Cylinder | transmission_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0093 | Torque Converter | transmission_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0094 | Transmission Fluid | transmission_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0095 | Transmission Filter | transmission_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0096 | Transmission Solenoid | transmission_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0097 | Wheel Bearing | wheel_tire_fault | HIGH | Immediate professional help | 1 |
| ai2_aktc_0098 | Tire Pressure Monitoring System (TPMS) | wheel_tire_fault | LOW | Can confirm resolution | 3 |
| ai2_aktc_0099 | Wheel Hub | wheel_tire_fault | HIGH | Immediate professional help | 1 |

## Excluded source cases

These source records have no approved driver guide. Direct startup is unavailable; symptom routing can still select a different guide or ask for information. Exclusion does not mean the underlying fault can never be repaired.

- aktc_0014: Air Conditioning Diagnosis
- aktc_0016: Heater Blower Motor
- aktc_0037: Charging System
- aktc_0038: Check Engine Light Diagnosis
- aktc_0039: Door Window Motor
- aktc_0041: Headlamp Bulb
- aktc_0044: Power Door Lock Actuator
- aktc_0047: Wiper Motor
- aktc_0057: Balance Shaft
- aktc_0060: Diesel Glow Plug
- aktc_0072: Battery Charging
- aktc_0081: Throttle Body

## Safety wording failures

The probes below expected immediate backend handling, including when GPT is unavailable. Failures are reported without changing application behavior. They show that keyword matching is not comprehensive.

| Conversation state | Driver message | Expected stop | Actual stop | GPT requested |
| --- | --- | --- | --- | --- |
| TROUBLESHOOTING | The brakes are not working | true | false | false |
| TROUBLESHOOTING | My brakes have stopped working | true | false | false |
| TROUBLESHOOTING | I cannot control the steering | true | false | false |
| TROUBLESHOOTING | The temperature gauge is in the red | true | false | false |
| TROUBLESHOOTING | The engine temperature gauge is at maximum | true | false | false |
| TROUBLESHOOTING | I am stranded in the middle of the highway | true | false | false |
| TROUBLESHOOTING | The engine is not overheating | false | true | false |
| TROUBLESHOOTING | I don't smell fuel | false | true | false |
| VERIFYING_ACTION | The brakes are not working | true | false | true |
| VERIFYING_ACTION | My brakes have stopped working | true | false | true |
| VERIFYING_ACTION | I cannot control the steering | true | false | true |
| VERIFYING_ACTION | The temperature gauge is in the red | true | false | true |
| VERIFYING_ACTION | The engine temperature gauge is at maximum | true | false | true |
| VERIFYING_ACTION | I am stranded in the middle of the highway | true | false | true |
| VERIFYING_ACTION | The engine is not overheating | false | true | false |
| VERIFYING_ACTION | I don't smell fuel | false | true | false |
| CHECKING_RESOLUTION | The brakes are not working | true | false | true |
| CHECKING_RESOLUTION | My brakes have stopped working | true | false | true |
| CHECKING_RESOLUTION | I cannot control the steering | true | false | true |
| CHECKING_RESOLUTION | The temperature gauge is in the red | true | false | true |
| CHECKING_RESOLUTION | The engine temperature gauge is at maximum | true | false | true |
| CHECKING_RESOLUTION | I am stranded in the middle of the highway | true | false | true |
| CHECKING_RESOLUTION | The engine is not overheating | false | true | false |
| CHECKING_RESOLUTION | I don't smell fuel | false | true | false |

## Initial symptom routing: all original cases

The main problem is selected using each record's known category where the app has such a selector; otherwise it uses Other or Engine Problem. Actual AI 1 inference is used, except when an initial safety rule stops the request first. These are source-data examples, not an independent model-accuracy benchmark. Guide capability is listed separately because routing may choose another guide.

- professional_help_required: 70
- more_information_required: 12
- awaiting_safety_confirmation: 11
- ready_to_start: 6

Routing findings in this run: the washer-fluid symptom example asks for more information rather than directly reaching its resolution-capable guide. Door-lock symptoms with a clicking sound select Battery Replacement. Uneven tyre wear with vibration selects TPMS. These matches need review; reaching a guide with a resolution branch does not establish the cause or repair the reported fault.

| Source case | Main problem | Initial result | Selected guide | Selected guide can confirm resolution |
| --- | --- | --- | --- | --- |
| ABS Control Module | brake_problem | professional_help_required | ABS Control Module | No |
| ABS Wheel Speed Sensor | brake_problem | professional_help_required | ABS Wheel Speed Sensor | No |
| Brake Booster | brake_problem | professional_help_required | Brake Booster | No |
| Brake Caliper | brake_problem | professional_help_required | Brake Caliper | No |
| Brake Hose | brake_problem | professional_help_required | Brake Fluid | No |
| Brake Master Cylinder | brake_problem | professional_help_required | Brake Master Cylinder | No |
| Brake Pad | brake_problem | professional_help_required | Brake Pad | No |
| Brake Rotor | brake_problem | professional_help_required | Brake Rotor | No |
| Brake Shoe & Drum | brake_problem | professional_help_required | Brake Shoe & Drum | No |
| AC Compressor | other | more_information_required | — | No |
| AC Condenser | other | awaiting_safety_confirmation | Radiator/Cooling Fan | No |
| AC Evaporator | other | more_information_required | — | No |
| AC Recharge | other | more_information_required | — | No |
| Air Conditioning Diagnosis | other | professional_help_required | Starter Motor | No |
| Cabin Air Filter | other | more_information_required | — | No |
| Heater Blower Motor | other | more_information_required | — | No |
| Heater Blower Motor Resistor | other | professional_help_required | — | No |
| Coolant/Antifreeze | engine_overheating | professional_help_required | — | No |
| Coolant Leak Diagnosis | engine_overheating | professional_help_required | — | No |
| Engine Cooling System | engine_overheating | professional_help_required | — | No |
| Heater Core | engine_overheating | professional_help_required | — | No |
| Heater Hose | engine_overheating | professional_help_required | — | No |
| Radiator/Cooling Fan | engine_overheating | professional_help_required | — | No |
| Radiator Hose | engine_overheating | professional_help_required | — | No |
| Water Pump | engine_overheating | professional_help_required | — | No |
| Bevel Gears | other | professional_help_required | Bevel Gears | No |
| Center Differential | other | professional_help_required | Center Differential | No |
| Clutch Cable | other | more_information_required | — | No |
| Clutch Slave Cylinder | other | more_information_required | — | No |
| Differential | other | professional_help_required | Differential | No |
| Live Axle | other | professional_help_required | Live Axle | No |
| Rigid Axle | other | professional_help_required | Rigid Axle | No |
| Slushbox | other | professional_help_required | Slushbox | No |
| Universal Joint | other | professional_help_required | Universal Joint | No |
| Viscous Coupling | other | professional_help_required | Viscous Coupling | No |
| Battery Replacement | electrical_problem | awaiting_safety_confirmation | Battery Replacement | Yes |
| Charging System | electrical_problem | awaiting_safety_confirmation | Battery Replacement | Yes |
| Check Engine Light Diagnosis | electrical_problem | professional_help_required | Ignition Wire Set | No |
| Door Window Motor | electrical_problem | ready_to_start | Door Window Regulator | No |
| Door Window Regulator | electrical_problem | ready_to_start | Door Window Regulator | No |
| Headlamp Bulb | electrical_problem | professional_help_required | Starter Motor | No |
| Ignition Distributor Cap | electrical_problem | professional_help_required | Ignition Distributor Cap | No |
| Ignition Wire Set | electrical_problem | professional_help_required | Ignition Wire Set | No |
| Power Door Lock Actuator | electrical_problem | awaiting_safety_confirmation | Battery Replacement | Yes |
| Starter Motor | electrical_problem | awaiting_safety_confirmation | Battery Replacement | Yes |
| Windshield Washer Pump | electrical_problem | ready_to_start | Windshield Washer Pump | No |
| Wiper Motor | electrical_problem | professional_help_required | Starter Motor | No |
| Canister Purge Valve | other | awaiting_safety_confirmation | Engine Oil | No |
| Catalytic Converter | other | awaiting_safety_confirmation | Engine Oil | No |
| Charcoal Canister | other | professional_help_required | — | No |
| Exhaust Manifold | other | professional_help_required | Exhaust Valve | No |
| Exhaust Manifold Gasket | other | professional_help_required | Exhaust Valve | No |
| Fuel Tank Pressure Sensor | other | professional_help_required | Fuel Injector | No |
| Knock Sensor | other | professional_help_required | Fuel Injector | No |
| M.A.P. Sensor | other | awaiting_safety_confirmation | Engine Oil | No |
| Oxygen Sensor | other | professional_help_required | Fuel Injector | No |
| Balance Shaft | engine_problem | professional_help_required | Engine Mounts | No |
| Boost Pressure | engine_problem | more_information_required | — | No |
| Diesel Injection Pump | engine_problem | professional_help_required | — | No |
| Diesel Glow Plug | engine_problem | more_information_required | — | No |
| Engine Mounts | engine_problem | professional_help_required | Engine Mounts | No |
| Exhaust Valve | engine_problem | professional_help_required | Engine Control Unit (ECU) | No |
| Fuel Injector | engine_problem | professional_help_required | Fuel Injector | No |
| Idle Air Control Valve | engine_problem | more_information_required | — | No |
| Intake Valve | engine_problem | professional_help_required | Engine Control Unit (ECU) | No |
| Oil Pump | engine_problem | professional_help_required | — | No |
| Piston Rings | engine_problem | professional_help_required | — | No |
| Timing Belt | engine_problem | professional_help_required | Timing Belt | No |
| Valve Cover Gasket | engine_problem | professional_help_required | Valve Cover Gasket | No |
| Fan Belt | engine_problem | professional_help_required | — | No |
| Horn | electrical_problem | ready_to_start | Horn | No |
| Battery Charging | electrical_problem | awaiting_safety_confirmation | Battery Replacement | Yes |
| Engine Belt | engine_problem | awaiting_safety_confirmation | Engine Belt | No |
| Steering Noise | steering_problem | professional_help_required | Steering Noise | No |
| Shaft and Tires | other | ready_to_start | Tire Pressure Monitoring System (TPMS) | Yes |
| Air Filter | engine_problem | professional_help_required | — | No |
| Engine Control Unit (ECU) | engine_problem | professional_help_required | Fuel Injector | No |
| Engine Oil | engine_problem | professional_help_required | — | No |
| Fuel Filter | engine_problem | professional_help_required | Fuel Filter | No |
| PCV Valve | engine_problem | awaiting_safety_confirmation | Engine Oil | No |
| Throttle Body | engine_problem | more_information_required | — | No |
| Fuel Injector | fuel_problem | professional_help_required | Fuel Injector | No |
| Fuel Pressure Regulator | fuel_problem | professional_help_required | — | No |
| Fuel Pump | fuel_problem | professional_help_required | Fuel Pump | No |
| Fuel Tank | fuel_problem | professional_help_required | — | No |
| Throttle Position Sensor | fuel_problem | professional_help_required | Throttle Position Sensor | No |
| Brake Fluid | brake_problem | professional_help_required | Brake Fluid | No |
| Coolant Reservoir | engine_overheating | professional_help_required | — | No |
| Power Steering Fluid | steering_problem | professional_help_required | Steering Noise | No |
| Radiator | engine_overheating | professional_help_required | — | No |
| Windshield Washer Fluid | other | more_information_required | — | No |
| Clutch Master Cylinder | transmission_problem | professional_help_required | Clutch Master Cylinder | No |
| Torque Converter | transmission_problem | professional_help_required | Transmission Fluid | No |
| Transmission Fluid | transmission_problem | professional_help_required | — | No |
| Transmission Filter | transmission_problem | professional_help_required | Transmission Filter | No |
| Transmission Solenoid | transmission_problem | professional_help_required | Transmission Solenoid | No |
| Wheel Bearing | flat_tyre | professional_help_required | Wheel Bearing | No |
| Tire Pressure Monitoring System (TPMS) | flat_tyre | ready_to_start | Tire Pressure Monitoring System (TPMS) | Yes |
| Wheel Hub | flat_tyre | professional_help_required | Wheel Hub | No |

## Verified invariants

- All HIGH guides expose no active repair step
- All terminal paths finish in a supported state
- Every resolved path includes an explicit driver resolution answer
- No completed check repeats
- First uncertainty does not immediately escalate

Full answer-by-answer paths, uncertainty results, input texts, predictions and safety results are in [the JSON evidence](troubleshooting-case-audit.json).

Run again: `cd backend` then `node scripts/auditTroubleshootingCases.js`. Requires the project's installed Python AI dependencies. The script never loads backend/.env, contacts OpenAI, or connects to MongoDB. It uses serialized Mongoose documents to isolate test sessions and one local Python worker for real inference/guide decisions. It does not cover every free-text phrasing, other vehicle types, mobile interaction, or live database concurrency.
