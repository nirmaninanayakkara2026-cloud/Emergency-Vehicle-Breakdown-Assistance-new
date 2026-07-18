# Emergency Vehicle Breakdown Assistance Mobile App

Current phase: **Mobile UI with backend authentication and temporary mock feature data**

This Expo React Native app is a beginner-friendly mobile UI demo for an Emergency Vehicle Breakdown Assistance final-year project.

## Install Dependencies

```bash
cd mobile
npm install
```

## Run

```bash
npx expo start
```

Open the app with Expo Go or an Android/iOS emulator.

## Completed Phase 1 Features

- Backend authentication with role-based navigation.
- Driver home screen with quick roadside assistance actions.
- Request mechanic form using simple vehicle and breakdown details.
- Mock provider recommendation list.
- Request tracking screen with status timeline.
- Self breakdown assistant using local troubleshooting guide data.
- Spare parts finder using local spare parts shop data.
- Provider dashboard with profile summary, online/offline toggle, and incoming requests.
- Provider request details screen with local status update buttons.
- Shared profile screen with logout.
- Reusable UI components for buttons, inputs, cards, selectors, and screen layout.

## Screens Implemented

- Login
- Register
- Driver Home
- Request Mechanic
- Recommendations
- Request Tracking / My Requests
- Self Breakdown Assistant
- Spare Parts Finder
- Provider Dashboard
- Provider Request Details
- Profile

## Mock Data

All app data is stored locally in `src/data`.

- `mockProviders.js` contains mechanic, garage, towing, and spare parts provider data.
- `mockRequests.js` contains sample driver breakdown requests.
- `mockSparePartsShops.js` contains nearby spare parts shop examples.
- `troubleshootingGuides.js` contains local guide steps for common breakdown types.
- `mockProviderProfile.js` contains a sample provider summary.

Authentication uses the backend API. Provider recommendations, request tracking demo data, spare parts shops, and troubleshooting guides still use temporary local mock data.

## Backend API Configuration

The mobile app cannot use `localhost` when running on a physical phone through Expo Go. Set the backend URL in:

```text
src/services/api.js
```

Current value:

```js
export const API_BASE_URL = "http://192.168.1.2:5050/api";
```

To find your computer IPv4 address on Windows:

```bash
ipconfig
```

Look for the Wi-Fi adapter `IPv4 Address`, then update `API_BASE_URL`.

If your backend runs on the requested default port `5000`, use:

```js
export const API_BASE_URL = "http://YOUR_LOCAL_IP:5000/api";
```

On this machine, port `5000` is occupied by Windows, so the backend has been tested on `5050`.

No AI model, photo upload, safety checklist, or triage screen is implemented in this phase.

## Next Phase

Phase 2: simple backend API integration for authentication, requests, providers, and request status updates.
