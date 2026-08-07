# Emergency Vehicle Breakdown Assistance Mobile App

Current phase: **Mobile UI connected to backend authentication, provider profiles, and breakdown requests**

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

- `mockProviders.js` contains mechanic, garage, towing, and spare parts provider data.
- `mockRequests.js` contains sample driver breakdown requests.
- `mockSparePartsShops.js` contains nearby spare parts shop examples.
- `troubleshootingGuides.js` contains local guide steps for common breakdown types.
- `mockProviderProfile.js` contains a sample provider summary.

Authentication, provider profiles, approved provider listing, breakdown request creation, driver request history, provider assigned requests, provider selection, request cancellation, and status updates use the backend API.

Spare parts shops and troubleshooting guides still use temporary local mock data.

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
