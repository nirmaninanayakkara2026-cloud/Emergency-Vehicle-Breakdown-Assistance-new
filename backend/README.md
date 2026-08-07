# Emergency Breakdown Backend

Backend foundation for the Emergency Vehicle Breakdown Assistance Mobile Application.

Current phase: **Backend foundation with authentication**

No AI model, mobile app connection, photo upload, detailed vehicle management, safety checklist, or triage feature is implemented in this phase.

## Technology

- Node.js
- Express.js
- MongoDB
- Mongoose
- JavaScript
- JWT authentication package
- bcryptjs password hashing package
- dotenv
- cors
- nodemon

## Installation

```bash
cd backend
npm install
```

## Environment Setup

Create a `.env` file in the `backend` folder using `.env.example` as a guide.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

If `MONGO_URI` is empty, the server still starts and skips the database connection. Add a valid MongoDB connection string when database work begins.

## Run Backend

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

## Health Check

```http
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Emergency Breakdown API is running"
}
```

## Authentication API

All successful responses use this structure:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Supported user roles:

- `driver`
- `mechanic`
- `garage`
- `towing_service`
- `spare_parts_shop`
- `admin`

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

Request body:

```json
{
  "name": "Test Driver",
  "email": "driver@example.com",
  "phone": "0712345678",
  "password": "Password123",
  "role": "driver"
}
```

Example response:

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "user_id",
      "name": "Test Driver",
      "email": "driver@example.com",
      "phone": "0712345678",
      "role": "driver",
      "isActive": true,
      "isVerified": false,
      "createdAt": "2026-07-17T00:00:00.000Z",
      "updatedAt": "2026-07-17T00:00:00.000Z"
    },
    "token": "jwt_token"
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

Request body:

```json
{
  "email": "driver@example.com",
  "password": "Password123"
}
```

### Get Logged-In User

```http
GET /api/auth/me
Authorization: Bearer jwt_token
```

This route requires authentication.

### Update Profile

```http
PATCH /api/auth/profile
Authorization: Bearer jwt_token
Content-Type: application/json
```

Allowed fields:

```json
{
  "name": "Updated Driver",
  "phone": "0799999999",
  "email": "updated-driver@example.com"
}
```

Passwords are hashed with `bcryptjs` before saving and are not returned in API responses.

## Provider Profile API

Provider profile routes use provider roles only:

- `mechanic`
- `garage`
- `towing_service`
- `spare_parts_shop`

### Create Provider Profile

```http
POST /api/providers/profile
Authorization: Bearer provider_jwt_token
Content-Type: application/json
```

```json
{
  "providerType": "mechanic",
  "businessName": "City Auto Mechanics",
  "phone": "0771234567",
  "specializations": ["engine_mechanic", "battery_electrical_mechanic"],
  "supportedVehicleTypes": ["car", "van"],
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo, Sri Lanka"
  },
  "availabilityStatus": "available",
  "serviceRadiusKm": 12,
  "averageResponseTimeMinutes": 20,
  "estimatedPriceRange": {
    "minimum": 2500,
    "maximum": 8000
  },
  "openingHours": "8.00 AM - 8.00 PM"
}
```

Rules:

- Only provider roles can create profiles.
- A provider user can have only one profile.
- `providerType` must match the logged-in user's role.
- New provider profiles are not public until `isApproved` is true.

### Get My Provider Profile

```http
GET /api/providers/profile/me
Authorization: Bearer provider_jwt_token
```

### Update My Provider Profile

```http
PATCH /api/providers/profile/me
Authorization: Bearer provider_jwt_token
Content-Type: application/json
```

```json
{
  "businessName": "City Auto Mechanics Updated",
  "serviceRadiusKm": 15,
  "availabilityStatus": "busy"
}
```

### Update Availability

```http
PATCH /api/providers/availability
Authorization: Bearer provider_jwt_token
Content-Type: application/json
```

```json
{
  "availabilityStatus": "available"
}
```

Allowed values: `available`, `busy`, `offline`.

### Public Provider Listing

```http
GET /api/providers
```

Returns approved providers only. Optional filters:

```http
GET /api/providers?providerType=mechanic&vehicleType=car&availabilityStatus=available
```

### Public Provider Details

```http
GET /api/providers/:id
```

Returns one approved provider profile.

## Breakdown Request API

Temporary service-type mapping is used for Phase 1 backend logic. This will later be replaced by the trained AI model.

Mapping:

- `flat_tyre` -> `tire_mechanic`
- `battery_issue` -> `battery_electrical_mechanic`
- `engine_overheating` -> `engine_mechanic`
- `brake_problem` -> `brake_mechanic`
- `fuel_issue` -> `roadside_fuel_support`
- `accident` -> `towing_service`
- `towing_needed` -> `towing_service`
- `other` -> `general_mechanic`

### Create Breakdown Request

```http
POST /api/breakdown-requests
Authorization: Bearer driver_jwt_token
Content-Type: application/json
```

```json
{
  "vehicleType": "car",
  "vehicleModel": "Toyota Aqua",
  "breakdownType": "battery_issue",
  "urgencyLevel": "medium",
  "problemDescription": "Vehicle will not start near the main road.",
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo, Sri Lanka"
  }
}
```

Only drivers can create breakdown requests.

### Get My Driver Requests

```http
GET /api/breakdown-requests/my
Authorization: Bearer driver_jwt_token
```

### Get Assigned Provider Requests

```http
GET /api/breakdown-requests/provider/assigned
Authorization: Bearer provider_jwt_token
```

Providers can view requests assigned to their provider profile.

### Get Breakdown Request By ID

```http
GET /api/breakdown-requests/:id
Authorization: Bearer jwt_token
```

Drivers can view their own requests. Selected providers can view requests assigned to them.

### Select Provider

```http
PATCH /api/breakdown-requests/:id/select-provider
Authorization: Bearer driver_jwt_token
Content-Type: application/json
```

```json
{
  "providerId": "provider_profile_id"
}
```

Only the driver who created the request can select a provider.

### Get Rule-Based Recommendations

```http
GET /api/breakdown-requests/:id/recommendations
Authorization: Bearer driver_jwt_token
```

Returns up to five approved, available providers that match the request vehicle type, required service type, specialization, and service radius. This is temporary rule-based logic and will later be replaced by the trained AI model.

Example response item:

```json
{
  "providerId": "provider_profile_id",
  "businessName": "City Auto Mechanics",
  "providerType": "mechanic",
  "specializations": ["battery", "electrical"],
  "distanceKm": 2.4,
  "rating": 4.5,
  "responseTimeMinutes": 20,
  "estimatedPriceRange": {
    "minimum": 2500,
    "maximum": 8000
  },
  "recommendationScore": 86.5,
  "availability": "available"
}
```

### Update Request Status

```http
PATCH /api/breakdown-requests/:id/status
Authorization: Bearer selected_provider_jwt_token
Content-Type: application/json
```

```json
{
  "status": "on_the_way"
}
```

Allowed provider statuses:

- `accepted`
- `on_the_way`
- `in_progress`
- `completed`

Only the selected provider can update these statuses.

### Cancel Request

```http
PATCH /api/breakdown-requests/:id/cancel
Authorization: Bearer driver_jwt_token
```

Only the driver who created the request can cancel it.

## Project Structure

```text
backend/
  src/
    config/
      db.js
    models/
      BreakdownRequest.js
      ProviderProfile.js
      User.js
    controllers/
      authController.js
      breakdownRequestController.js
      providerController.js
    routes/
      authRoutes.js
      breakdownRequestRoutes.js
      healthRoutes.js
      providerRoutes.js
    middleware/
      authMiddleware.js
      errorMiddleware.js
    services/
    utils/
      generateToken.js
      domainConstants.js
      providerValidation.js
      requestValidation.js
      validation.js
    seed/
  server.js
  package.json
  .env.example
  .gitignore
  README.md
```
