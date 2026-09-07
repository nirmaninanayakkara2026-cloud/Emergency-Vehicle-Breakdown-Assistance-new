# Emergency Vehicle Breakdown Assistance

React Native Expo mobile application with an Express/MongoDB backend, an AI 1
fault classifier, deterministic AI 2 safety-aware troubleshooting, and
rule-based provider recommendation and tracking.

## Requirements

- Node.js 22.13+ in the Node.js 22 release line (or a supported newer LTS release) and npm
- Python 3.11+
- MongoDB
- Expo Go supporting SDK 57, or an Android/iOS emulator

## 1. Start FastAPI

```powershell
cd backend\ai
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

PowerShell activation requires the leading `.\`; `venv\Scripts\activate`
without it may be interpreted as a module name.

## 2. Start the Node backend

Copy `backend/.env.example` to `backend/.env` and configure MongoDB and JWT.
OpenAI is optional.

```powershell
cd backend
npm install
npm run dev
```

Available variables include `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`AI_SERVICE_URL`, `AI_SERVICE_TIMEOUT_MS`, and optional `OPENAI_API_KEY` /
`OPENAI_MODEL`.

## 3. Start mobile

Copy `mobile/.env.example` to `mobile/.env` and set the backend address reachable
from the phone/emulator.

```powershell
cd mobile
npm install
npm start
```

After an Expo SDK upgrade, stop the old mobile server and run `npm start -- --clear`,
then scan the new QR code in Expo Go.

`EXPO_PUBLIC_API_BASE_URL` must include `/api`, for example
`http://192.168.1.100:5000/api` for a physical device on the same network.

## Demo data

Copy `backend/.env.demo.example` to `backend/.env`, replace all placeholders,
then explicitly run:

```powershell
cd backend
npm run seed:demo
```

The seeder uses upserts, never deletes real data, and reads its demo password
from `DEMO_PASSWORD`.

## Visible test output

```powershell
cd backend
npm run test:verbose

cd ..
python backend/ai/scripts/test_ai1_prediction.py
python -m unittest discover -s backend/ai/ai2/tests -v
python backend/ai/ai2/scripts/validate_ai2_knowledge.py
```

Project evidence and presentation material are under [docs](docs/).
