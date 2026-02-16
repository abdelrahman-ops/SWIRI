# Swiri Backend (Node.js + Express + MongoDB)

Backend API for the Swiri child-safety platform. Includes:
- Real-time location tracking (Socket.IO)
- SOS alerts with camera integration
- Geofencing + time-based notifications
- Camera image attachment for alerts
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
- POST `/api/analytics/ai-risk/:childId`
- GET `/api/analytics/ai-risk/:childId`
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

## API Response Standard

All successful responses now follow a consistent envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {},
  "meta": null,
  "requestId": "uuid",
  "timestamp": "2026-02-15T10:00:00.000Z"
}
```

All error responses now follow:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": []
  },
  "requestId": "uuid",
  "timestamp": "2026-02-15T10:00:00.000Z"
}
```

## Design Pattern Improvements

- **Centralized error model** via [src/core/ApiError.js](src/core/ApiError.js)
- **Centralized success response model** via [src/core/ApiResponse.js](src/core/ApiResponse.js)
- **Request context pattern** via [src/middleware/requestContext.js](src/middleware/requestContext.js) for request tracing
- **Global error handling middleware** via [src/middleware/errorHandler.js](src/middleware/errorHandler.js)
- **Not found middleware** via [src/middleware/notFound.js](src/middleware/notFound.js)
- **Auto response envelope middleware** via [src/middleware/responseEnvelope.js](src/middleware/responseEnvelope.js)

## AI Risk Detection Flow (Watch -> AI -> DB)

Watch sends raw data arrays (last 5 seconds):

```json
{
  "heart_rate_raw": [80, 82, 90, 135, 145],
  "accelerometer_raw": [1.1, 1.2, 3.5, 4.0, 3.8]
}
```

Backend endpoint:
- POST `/api/analytics/ai-risk/:childId`

Backend forwards these values to `AI_RISK_MODEL_URL` and stores returned AI result in MongoDB (model: `RiskAssessment`).

Expected AI response format:

```json
{
  "prediction_code": 2,
  "confidence_percentage": 98.5,
  "status_label": "DANGER",
  "calculated_features": {
    "hr_mean": 106.4,
    "hr_gradient": 65.0,
    "acc_mean": 2.72,
    "acc_variance": 1.58
  }
}
```

If `prediction_code = 2` or `status_label = DANGER`, backend auto-creates a critical vitals alert and pushes socket notifications to guardians.

## Camera Integration

All alert-generating endpoints now support optional `imageUrl` parameter to attach camera images:

### Supported Endpoints

1. **POST `/api/alerts`** - Manual alert creation with image
   ```json
   {
     "type": "custom",
     "severity": "high",
     "childId": "...",
     "message": "Alert message",
     "imageUrl": "https://example.com/camera/image.jpg",
     "coordinates": [lng, lat]
   }
   ```

2. **POST `/api/sos`** - SOS event with camera image
   ```json
   {
     "childId": "...",
     "triggeredBy": "device",
     "coordinates": [lng, lat],
     "imageUrl": "https://example.com/camera/sos-image.jpg"
   }
   ```

3. **POST `/api/locations`** - Location update with camera image for geofence alerts
   ```json
   {
     "childId": "...",
     "deviceId": "...",
     "coordinates": [lng, lat],
     "imageUrl": "https://example.com/camera/location-image.jpg"
   }
   ```
   When a geofence violation is detected, the alert will include the provided image.

4. **POST `/api/analytics/ai-risk/:childId`** - AI risk assessment with camera image
   ```json
   {
     "heart_rate_raw": [80, 82, 90, 135, 145],
     "accelerometer_raw": [1.1, 1.2, 3.5, 4.0, 3.8],
     "imageUrl": "https://example.com/camera/vitals-image.jpg"
   }
   ```
   If danger is detected, the alert will include the camera image.

### Image URL Requirements

- Must be a valid URI/URL format
- Should be publicly accessible or use a secure signed URL
- Recommended: Use a CDN or cloud storage (S3, Azure Blob, etc.)
- Images are referenced by URL only (not stored in MongoDB)
