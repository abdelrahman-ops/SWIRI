# Swiri Backend (Node.js + Express + MongoDB)

Backend API for the Swiri child-safety platform. Includes:
- Real-time location tracking (Socket.IO)
- SOS alerts
- Geofencing + time-based notifications
- Attendance tracking (NFC/BLE/manual)
- Activity summaries
- Role-based access (parent, school, staff, admin, driver)

## Quick Start
1. Copy `.env.example` to `.env` and update values.
2. Install dependencies.
3. Start the server.

## Scripts
- `npm run dev` - start with nodemon
- `npm start` - production

## Main Endpoints (REST)
- POST `/api/auth/signup`
- POST `/api/auth/register` (alias)
- POST `/api/auth/login`
- POST `/api/auth/forgot-password`
- GET `/api/users/me`
- PATCH `/api/users/me`
- POST `/api/children`
- GET `/api/children`
- GET `/api/children/:childId`
- PATCH `/api/children/:childId`
- POST `/api/schools`
- GET `/api/schools`
- POST `/api/devices`
- POST `/api/devices/:deviceId/assign`
- GET `/api/devices`
- POST `/api/locations`
- GET `/api/locations/latest/:childId`
- POST `/api/geofences`
- GET `/api/geofences`
- POST `/api/alerts`
- GET `/api/alerts`
- POST `/api/activities`
- GET `/api/activities/:childId`
- GET `/api/analytics/behavior/:childId`
- POST `/api/sos`
- PATCH `/api/sos/:sosId/resolve`
- POST `/api/attendance`
- GET `/api/attendance`

## Socket Events
Server emits to rooms:
- `child:<childId>`
- `user:<userId>`

Events:
- `location:update`
- `alert:new`
- `sos:new`

Client should connect with token:
```json
{
  "auth": { "token": "<jwt>" }
}
```

## Notes
- Geofence checks run on location ingestion.
- Privacy cut-off can be enforced at the API gateway or by role/time rules on client UI.
- Project uses ES Modules (`type: module`) and centralized API route mounting from [src/routes/index.js](src/routes/index.js).
- Postman collection available at [postman/Swiri Backend.postman_collection.json](postman/Swiri%20Backend.postman_collection.json).
