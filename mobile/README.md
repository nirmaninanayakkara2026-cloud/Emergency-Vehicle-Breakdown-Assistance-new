# Emergency Vehicle Breakdown Assistance Mobile App

Current phase: **Mobile UI connected to backend authentication, provider profiles, and breakdown requests**

This Expo React Native app is a beginner-friendly mobile UI demo for an Emergency Vehicle Breakdown Assistance final-year project.

## Install Dependencies

This app uses **Expo SDK 57** and requires an Expo Go version that supports SDK 57.
Use Node.js 22.13 or newer in the Node.js 22 release line, or a supported newer LTS release.

```bash
cd mobile
npm install
```

## Run

```bash
npx expo start
```

Open the app with Expo Go or an Android/iOS emulator.

After upgrading from SDK 54, stop any running Expo server, then start with a clean Metro cache:

```bash
npm start -- --clear
```

Scan the new QR code with Expo Go. The phone and computer should be on the same network.
To check dependency compatibility, run `npx expo install --check` and `npx expo-doctor`.

## Maps in Android builds

For an installed Android build, set `GOOGLE_MAPS_API_KEY` in `mobile/.env` or the build environment. Enable Maps SDK for Android for that key and configure its Android package/signing certificate restrictions. `app.config.js` passes the key to the `react-native-maps` plugin. Rebuild and reinstall the native app after changing the key; restarting Metro alone does not update it.

On iPhone, the provider location picker starts with native Apple Maps, including in Expo Go. Android starts with Google Maps in both Expo Go and native builds. If the native map does not finish loading within 12 seconds, the picker switches to Leaflet and OpenStreetMap inside `react-native-webview`. A native map can report readiness even when its tiles are blank; in that case, use **Map blank? Use OpenStreetMap**. The selected coordinates and address are preserved when switching.

Both map options support tapping, dragging the pin, saved locations, and the existing GPS/address controls. Internet access is required for Leaflet assets and map tiles. OpenStreetMap attribution remains visible, and tiles use the WebView's normal HTTP cache with no prefetching.

If the location map times out, use **Retry Map** after checking connectivity. The loading overlay clears after 12 seconds so it cannot permanently hide the map. Current-location selection also remains available.

## Driver provider route

After a provider accepts, **Track Request** and **Request Details** show the provider's saved service location, the breakdown location, and a driving route between them. Both screens refresh active requests every 10 seconds while visible and refresh on returning to the app. This uses the profile's static location; it does not collect the provider's live GPS position.

The embedded map uses Leaflet/OpenStreetMap. Road geometry, distance, and travel time come from an OSRM-compatible service, defaulting to the public demo at `https://router.project-osrm.org`. Set `EXPO_PUBLIC_ROUTING_BASE_URL` to your own OSRM host for production. Coordinates are sent to the routing service without app authentication. Route requests run only when the coordinates change or the user retries. Driving time excludes live traffic and provider preparation time; the provider's arrival estimate remains separate.

**Open Route in Google Maps** opens directions from the provider to the breakdown location, including when the embedded route cannot load. Missing coordinates and network failures show an explanatory message and retry where applicable.

Manual check: select a provider as a driver, leave Track Request open, then accept on the provider account. Within 10 seconds, verify both pins and the road route appear. Check Request Details too, advance the job status, cancel the request, and test map retry with connectivity disabled/restored.

References: [OSRM route API](https://project-osrm.org/docs/v26.6.1/http), [Google Maps directions URLs](https://developers.google.com/maps/documentation/urls/get-started#directions).

## Completed Phase 1 Features

- Backend authentication with role-based navigation.
- Backend provider profile creation and availability updates.
- Backend driver breakdown request creation using Expo Location.
- Backend driver request list and request details.
- Backend provider assigned request dashboard and status updates.
- Driver home screen with quick roadside assistance actions.
- Request mechanic form using simple vehicle, breakdown, urgency, description, and location details.
- Approved provider listing from the backend.
- Self breakdown assistant using local troubleshooting guide data.
- Spare parts finder using local spare parts shop data.
- Provider dashboard with profile summary, availability controls, and assigned requests.
- Provider request details screen with backend status update buttons.
- Shared profile screen with logout.
- Reusable UI components for buttons, inputs, cards, selectors, and screen layout.

## Screens Implemented

- Login
- Register
- Driver Home
- Request Mechanic
- Recommendations
- My Requests
- Request Details
- Self Breakdown Assistant
- Spare Parts Finder
- Provider Profile
- Provider Dashboard
- Provider Request Details
- Profile

## Mock Data

All app data is stored locally in `src/data`.

- `mockProviders.js` contains mechanic, garage, and spare parts provider data.
- `mockRequests.js` contains sample driver breakdown requests.
- `mockSparePartsShops.js` contains nearby spare parts shop examples.
- `troubleshootingGuides.js` contains local guide steps for common breakdown types.
- `mockProviderProfile.js` contains a sample provider summary.

Authentication, provider profiles, approved provider listing, breakdown request creation, driver request history, provider assigned requests, provider selection, request cancellation, and status updates use the backend API.

Spare parts shops and troubleshooting guides still use temporary local mock data.

## Backend API Configuration

The mobile app cannot use `localhost` when running on a physical phone through Expo Go.
Copy `.env.example` to `.env` in the `mobile` directory and set the backend URL there:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_WIFI_IP:YOUR_BACKEND_PORT/api
```

To find your computer IPv4 address on Windows:

```bash
ipconfig
```

Look for the Wi-Fi adapter `IPv4 Address` and use the `PORT` configured in `backend/.env`.
Keep `/api` at the end of the URL. The phone and computer must be on the same network.
`src/services/api.js` reads `EXPO_PUBLIC_API_BASE_URL` automatically; no source-code edit is needed.
The local `.env` file is ignored by Git.

After changing `.env`, restart Expo with `npm start -- --clear` and reload the app.
With the backend running, open `http://YOUR_COMPUTER_WIFI_IP:YOUR_BACKEND_PORT/api/health`
on the phone to verify connectivity.

No AI model, photo upload, safety checklist, or triage screen is implemented in this phase.

## Next Phase

Phase 2: simple backend API integration for authentication, requests, providers, and request status updates.
