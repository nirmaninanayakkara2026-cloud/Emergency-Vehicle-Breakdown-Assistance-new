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
