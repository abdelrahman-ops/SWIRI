# SWIRI — Full System Workflow & Entity Journey

## 1) System Purpose

SWIRI is a proactive child-safety backend that combines:
- Real-time location tracking
- SOS emergency handling
- Geofence and schedule-based alerts
- Attendance tracking for schools
- Activity summaries and behavior analytics
- AI risk detection from wearable raw sensor streams

The backend exposes REST APIs, Socket.IO events, and persistent MongoDB storage.

---

## 2) High-Level Architecture

### Core Layers
1. **Routes Layer**
   - Receives HTTP requests
   - Validates request schema
   - Applies auth/role middleware
   - Passes execution to controllers

2. **Controller Layer**
   - Implements domain logic
   - Reads/writes data via Mongoose models
   - Calls AI service integrations
   - Emits socket notifications when required

3. **Service Layer**
   - External integrations (AI model URL)
   - Isolates third-party call logic from controllers

4. **Data Layer (MongoDB + Mongoose)**
   - Stores users, children, devices, locations, alerts, attendance, activity summaries, SOS events, and AI risk assessments

5. **Realtime Layer (Socket.IO)**
   - Authenticated socket sessions
   - Room-based notifications (`user:<id>`, `child:<id>`, `school:<id>`)

6. **Cross-Cutting Middleware**
   - Request context (`x-request-id`)
   - Validation
   - Authentication and role guards
   - Standardized success/error envelopes

---

## 3) Main Entities and Their Roles

## 3.1 User
Represents all account types:
- `parent`
- `school`
- `staff`
- `admin`
- `driver`

Key responsibilities:
- Authenticates into system
- Can be linked to one school
- Parents are linked to one or many children

## 3.2 School
- Stores school metadata and geolocation
- Manages attendance/safety context during school hours

## 3.3 Child
- Core protected entity
- Linked to guardians (`User`), school, and optionally one wearable device

## 3.4 Device
- Wearable tracker/watch/band
- Bound to a child
- Feeds telemetry and location

## 3.5 Location
- Time-stamped geolocation points per child/device
- Drives live tracking and geofence checks

## 3.6 Geofence
- Circular safe zone + schedule (days/time)
- Used to trigger out-of-zone alerts only during configured windows

## 3.7 Alert
- Unified alert model (`geofence`, `sos`, `vitals`, etc.)
- Sent to guardians/school users and can be consumed in real-time

## 3.8 ActivitySummary
- Daily aggregate metrics (steps, active/rest minutes, heart rate stats)
- Used for trend-based insights

## 3.9 SosEvent
- Emergency incident opened by child/device/automation
- Can be resolved later

## 3.10 Attendance
- School check-in/check-out records
- Sources: `nfc`, `ble`, or `manual`

## 3.11 RiskAssessment
- Stores wearable raw arrays + AI inference result
- Optionally linked to triggered critical alert

---

## 4) End-to-End Journeys

## 4.1 Authentication Journey (Parent/School/Staff)
1. Client signs up (`/api/auth/signup`)
2. Backend validates payload (email/phone/password/terms)
3. Password is hashed and user is stored
4. JWT token returned in standard success envelope
5. Client uses token in `Authorization: Bearer <token>` for protected APIs

Login supports identifier by email or phone.

---

## 4.2 Parent Onboarding Journey
1. Parent creates child (`/api/children`)
2. Device is registered and assigned (`/api/devices`, `/api/devices/:id/assign`)
3. Parent configures geofence (`/api/geofences`)
4. Location ingestion starts (`/api/locations`)
5. Parent receives real-time events through socket rooms

---

## 4.3 School Operational Journey
1. School account creates school profile (`/api/schools`)
2. Students are associated with school
3. Attendance events are recorded (`/api/attendance`)
4. School dashboard fetches attendance list and safety events
5. Access is controlled by role and policy boundaries

---

## 4.4 Real-Time Location + Geofence Journey
1. Watch/device sends location payload
2. Backend stores location record
3. Backend checks active geofences for child
4. If child exits configured zone during valid schedule:
   - Creates geofence alert
   - Emits `alert:new` to guardians/child room
5. Client dashboard reflects live map + alerting

---

## 4.5 SOS Journey
1. Child/device triggers SOS (`/api/sos`)
2. Backend creates `SosEvent`
3. Backend creates critical `Alert`
4. Socket emits `sos:new` and `alert:new` to guardians/child
5. Authorized user resolves event (`/api/sos/:sosId/resolve`)

---

## 4.6 AI Risk Detection Journey (Raw Watch Data)

### Input from watch (raw arrays)
```json
{
  "heart_rate_raw": [80, 82, 90, 135, 145],
  "accelerometer_raw": [1.1, 1.2, 3.5, 4.0, 3.8]
}
```

### Backend flow
1. Client posts to `/api/analytics/ai-risk/:childId`
2. Backend validates payload
3. Backend calls external AI model URL (`AI_RISK_MODEL_URL`)
4. Backend receives AI response:
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
5. Backend stores complete inference in `RiskAssessment`
6. If danger condition (`prediction_code = 2` or `status_label = DANGER`):
   - Create critical `vitals` alert
   - Emit socket notifications to guardians
7. History can be fetched via `GET /api/analytics/ai-risk/:childId`

---

## 4.7 Activity & Behavior Insight Journey
1. System/app stores daily summary (`/api/activities`)
2. Analytics endpoint (`/api/analytics/behavior/:childId`) compares recent day vs baseline
3. Returns flags (e.g., low activity, heart-rate spike)
4. Dashboard uses this for awareness and proactive follow-up

---

## 5) API Response Contract

## 5.1 Success Envelope
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

## 5.2 Error Envelope
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

This ensures clients can reliably parse every response.

---

## 6) Realtime Event Contract

Common server-emitted events:
- `location:update`
- `alert:new`
- `sos:new`

Room strategy:
- `user:<userId>` for personal notifications
- `child:<childId>` for child-centric streams
- `school:<schoolId>` for school-scoped streams

---

## 7) Security and Reliability Principles

- JWT-based authentication for protected routes
- Role guard for authorization (`parent`, `school`, `admin`, etc.)
- Joi validation at route level
- Centralized error normalization and formatting
- Request correlation via `x-request-id`
- Rate limiting and secure headers (`helmet`)

---

## 8) Full Entity Interaction Map (Summary)

1. **User** authenticates
2. **Parent** creates **Child**
3. **Device** assigned to **Child**
4. **Location** stream updates child position
5. **Geofence** rules evaluate location and may generate **Alert**
6. **SosEvent** generates critical **Alert** and realtime notifications
7. **Attendance** records school entry/exit
8. **ActivitySummary** stores periodic health/activity data
9. **RiskAssessment** stores AI decisions from raw watch arrays
10. **Alert** acts as unified output for urgent action

---

## 9) Suggested Next Iteration

- Add multi-tenant data partitioning per school
- Add event/audit log for every critical state transition
- Add retry/timeout/circuit-breaker around AI service calls
- Add push notification channels (FCM/APNs/SMS)
- Add RBAC policy matrix document per endpoint

---

## 10) Operational Checklist

- Configure `.env` values (`MONGO_URI`, `JWT_SECRET`, `AI_RISK_MODEL_URL`)
- Keep AI API key secret (`AI_RISK_MODEL_API_KEY`)
- Monitor request IDs in logs for incident tracing
- Use Postman collections for integration testing

This document reflects the complete implemented journey up to the current state of the SWIRI backend.

---

## 11) Visual Diagrams (Actual Runtime Flow)

> These Mermaid diagrams can be rendered directly in GitHub/Markdown viewers that support Mermaid.

### 11.1 System Architecture Diagram

```mermaid
flowchart LR
   A[Mobile Parent App] -->|HTTPS + JWT| B[Express API]
   S[School Dashboard] -->|HTTPS + JWT| B
   W[Wearable Watch/Band] -->|Location + Raw Sensor Data| B

   B --> R[Routes Layer]
   R --> M[Validation/Auth Middleware]
   M --> C[Controllers]
   C --> D[(MongoDB)]
   C --> AI[External AI Model URL]
   C --> IO[Socket.IO Gateway]
   IO --> A
   IO --> S

   subgraph Data Models
     U[User]
     CH[Child]
     DV[Device]
     LC[Location]
     GF[Geofence]
     AL[Alert]
     SO[SosEvent]
     AT[Attendance]
     AC[ActivitySummary]
     RA[RiskAssessment]
   end

   D --- U
   D --- CH
   D --- DV
   D --- LC
   D --- GF
   D --- AL
   D --- SO
   D --- AT
   D --- AC
   D --- RA
```

### 11.2 Authentication Flow (Normal Path)

```mermaid
sequenceDiagram
   participant UI as Mobile UI
   participant API as Express API
   participant DB as MongoDB

   UI->>API: POST /api/auth/signup
   API->>API: Validate payload + hash password
   API->>DB: Create User
   DB-->>API: User saved
   API-->>UI: 201 success + JWT token

   UI->>API: POST /api/auth/login
   API->>DB: Find user by email/phone
   DB-->>API: User record
   API->>API: Verify password
   API-->>UI: 200 success + JWT token
```

### 11.3 Real-Time Location + Geofence Flow (Normal/Alert Path)

```mermaid
sequenceDiagram
   participant Watch as Wearable
   participant API as Express API
   participant DB as MongoDB
   participant GEO as Geofence Engine
   participant IO as Socket.IO
   participant Parent as Parent App

   Watch->>API: POST /api/locations (lat,lng,telemetry)
   API->>DB: Save Location
   API->>GEO: Evaluate active geofences + schedule

   alt Inside zone
      API-->>Parent: 201 location saved
      API->>IO: Emit location:update
   else Outside zone during active schedule
      API->>DB: Create Alert(type=geofence)
      API->>IO: Emit alert:new to user:<guardianId>
      IO-->>Parent: Real-time danger notification
      API-->>Parent: 201 location saved + alert created
   end
```

### 11.4 SOS Emergency Flow

```mermaid
sequenceDiagram
   participant Child as Child Device
   participant API as Express API
   participant DB as MongoDB
   participant IO as Socket.IO
   participant Parent as Parent App

   Child->>API: POST /api/sos
   API->>DB: Create SosEvent
   API->>DB: Create Alert(type=sos, severity=critical)
   API->>IO: Emit sos:new + alert:new
   IO-->>Parent: Immediate emergency notification
   API-->>Parent: 201 SOS created

   Parent->>API: PATCH /api/sos/:sosId/resolve
   API->>DB: Update SosEvent status=resolved
   API-->>Parent: 200 resolved
```

### 11.5 AI Risk Detection Flow (Raw Arrays -> Model -> Save -> Alert)

```mermaid
sequenceDiagram
   participant Watch as Wearable
   participant API as Express API
   participant AI as AI Model Service
   participant DB as MongoDB
   participant IO as Socket.IO
   participant Parent as Parent App

   Watch->>API: POST /api/analytics/ai-risk/:childId\nheart_rate_raw[], accelerometer_raw[]
   API->>AI: POST AI_RISK_MODEL_URL with raw arrays
   AI-->>API: prediction_code, confidence_percentage, status_label, calculated_features
   API->>DB: Save RiskAssessment(raw + aiResponse)

   alt status_label == DANGER or prediction_code == 2
      API->>DB: Create Alert(type=vitals, severity=critical)
      API->>IO: Emit alert:new to guardians
      IO-->>Parent: Critical AI danger notification
   else Normal/Safe
      API-->>Parent: Assessment saved (no critical alert)
   end

   API-->>Parent: 201 AI risk assessment processed
```

### 11.6 Entity Relationship Diagram (Operational)

```mermaid
erDiagram
   USER ||--o{ CHILD : guardian_of
   SCHOOL ||--o{ CHILD : enrolls
   CHILD ||--o| DEVICE : assigned_device
   CHILD ||--o{ LOCATION : has_positions
   CHILD ||--o{ GEOFENCE : monitored_by
   CHILD ||--o{ ALERT : receives_alerts
   CHILD ||--o{ SOSEVENT : emergency_events
   SCHOOL ||--o{ ATTENDANCE : records
   CHILD ||--o{ ATTENDANCE : attendance_logs
   CHILD ||--o{ ACTIVITYSUMMARY : daily_metrics
   CHILD ||--o{ RISKASSESSMENT : ai_inferences
   ALERT ||--o| RISKASSESSMENT : may_be_triggered_by
```

### 11.7 Request Lifecycle in Backend

```mermaid
flowchart TD
   A[Incoming HTTP Request] --> B[requestContext middleware]
   B --> C[responseEnvelope middleware]
   C --> D[Rate limit + security middleware]
   D --> E[Route match]
   E --> F[Validation middleware]
   F --> G[Auth + Role middleware]
   G --> H[Controller logic]
   H --> I[(MongoDB/AI Service/Socket Emit)]
   I --> J[ApiResponse success envelope]

   F -->|validation fails| K[ApiError]
   G -->|auth fails| K
   H -->|unexpected error| K
   K --> L[Global errorHandler]
   L --> M[Standard error envelope]
```
