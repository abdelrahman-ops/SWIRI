# Swiri Backend — Flutter Integration Guide

> **Base URL (Production):** `https://swiri.vercel.app`
> **Base URL (Local):** `http://localhost:4000`
>
> All API endpoints are prefixed with `/api` except `/health`.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Authentication](#2-authentication)
3. [Response Format](#3-response-format)
4. [Error Handling](#4-error-handling)
5. [Socket.IO Real-Time Events](#5-socketio-real-time-events)
6. [API Endpoints](#6-api-endpoints)
   - [Health](#61-health)
   - [Auth](#62-auth)
   - [Users](#63-users)
   - [Children](#64-children)
   - [Schools](#65-schools)
   - [Devices](#66-devices)
   - [Locations](#67-locations)
   - [Geofences](#68-geofences)
   - [Alerts](#69-alerts)
   - [SOS](#610-sos)
   - [Activities](#611-activities)
   - [Attendance](#612-attendance)
   - [Analytics & AI Risk](#613-analytics--ai-risk)
   - [Simulation](#614-simulation)
7. [Data Models](#7-data-models)
8. [Flutter Implementation Guide](#8-flutter-implementation-guide)
9. [Complete Flow Examples](#9-complete-flow-examples)

---

## 1. Overview & Architecture

Swiri is a child-safety system with 3 core features:

| Feature | Description | Endpoints |
|---------|-------------|-----------|
| **GPS Tracking** | Real-time location tracking with geofence safe zones | `/locations`, `/geofences` |
| **Alarm System** | Manual & automatic alerts + SOS emergency events | `/alerts`, `/sos` |
| **AI Risk Detection** | Wearable sensor data → AI classification → automatic danger alerts | `/analytics/ai-risk`, `/simulate` |

### How the pipeline works:

```
Watch sends sensor data (HR + accelerometer)
        ↓
AI classifies: normal / playing / danger
        ↓
RiskAssessment saved to DB
        ↓
Location saved (if coordinates provided)
        ↓
Geofences checked → breach alert if outside
        ↓
If DANGER → auto-create Alert + SOS
        ↓
Socket.IO events emitted to parent app in real-time
```

### Roles

| Role | Can Do |
|------|--------|
| `parent` | Manage own children, locations, geofences, alerts, SOS |
| `school` | Create schools, register devices, manage school children |
| `admin` | Full access to everything |
| `staff` | School staff operations |
| `driver` | Bus tracking (future) |

---

## 2. Authentication

All endpoints except `/health`, `/api/auth/signup`, `/api/auth/login`, and `/api/auth/forgot-password` require a JWT token.

### Header format:
```
Authorization: Bearer <JWT_TOKEN>
```

### Flutter implementation:
```dart
class ApiClient {
  static const String baseUrl = 'https://swiri.vercel.app';
  String? _token;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  void setToken(String token) => _token = token;
}
```

### Token structure (JWT payload):
```json
{
  "sub": "userId",
  "role": "parent",
  "iat": 1708000000,
  "exp": 1708604800
}
```

---

## 3. Response Format

All API responses follow a standard envelope:

### Success response:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": { ... },
  "meta": null,
  "requestId": "abc123",
  "timestamp": "2026-02-16T12:00:00.000Z"
}
```

### Some older endpoints return data directly (no envelope):
```json
{
  "children": [ ... ]
}
```

**Flutter tip:** Handle both formats:
```dart
dynamic parseData(Map<String, dynamic> json) {
  // Envelope format
  if (json.containsKey('data')) return json['data'];
  // Direct format (legacy)
  return json;
}
```

---

## 4. Error Handling

### Error response format:
```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": ["\"email\" is required"]
  },
  "requestId": "abc123"
}
```

### Error codes:

| HTTP Status | Error Code | Meaning |
|------------|------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request body/params |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 401 | `AUTH_FAILED` | Wrong email/password |
| 403 | `FORBIDDEN` | Role doesn't have permission |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Email/phone already in use |
| 500 | `INTERNAL_ERROR` | Server error |

### Flutter error handling:
```dart
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final List<String>? details;

  ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiException.fromResponse(http.Response response) {
    final json = jsonDecode(response.body);
    final error = json['error'] ?? {};
    return ApiException(
      statusCode: response.statusCode,
      code: error['code'] ?? 'UNKNOWN',
      message: error['message'] ?? json['message'] ?? 'Unknown error',
      details: (error['details'] as List?)?.cast<String>(),
    );
  }
}
```

---

## 5. Socket.IO Real-Time Events

Connect using the `socket_io_client` Flutter package.

### Connection:
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('https://swiri.vercel.app', <String, dynamic>{
  'transports': ['websocket'],
  'auth': {'token': jwtToken},
});
```

### Events to listen for:

| Event | Payload | When |
|-------|---------|------|
| `location:update` | `{ childId, location }` | New GPS location received |
| `alert:new` | `{ alert }` | Any alert created (geofence, vitals, sos, custom) |
| `sos:new` | `{ event, alert }` | SOS triggered (manual or auto) |
| `risk:assessed` | `{ childId, assessment }` | AI risk assessment completed |

### Rooms (auto-joined on connect):
- `user:<userId>` — Alerts/SOS for this parent
- `child:<childId>` — All events for this child
- `school:<schoolId>` — School-wide events

### Flutter listener example:
```dart
socket.on('alert:new', (data) {
  final alert = Alert.fromJson(data['alert']);
  // Show notification, update UI, etc.
  if (alert.severity == 'critical') {
    showUrgentNotification(alert);
  }
});

socket.on('location:update', (data) {
  final location = Location.fromJson(data['location']);
  updateMapMarker(data['childId'], location);
});

socket.on('sos:new', (data) {
  final sosEvent = SosEvent.fromJson(data['event']);
  showSOSDialog(sosEvent);
});

socket.on('risk:assessed', (data) {
  final assessment = RiskAssessment.fromJson(data['assessment']);
  updateRiskIndicator(data['childId'], assessment);
});
```

---

## 6. API Endpoints

### 6.1 Health

#### `GET /health`
No auth required. Use to check if the server is up.

**Response:**
```json
{ "status": "ok" }
```

---

### 6.2 Auth

#### `POST /api/auth/signup`
Create a new account.

**Body:**
```json
{
  "email": "parent@example.com",       // required, unique
  "phone": "+201234567890",            // required, unique
  "password": "MyPassword123",         // required, min 6 chars
  "confirmPassword": "MyPassword123",  // required, must match
  "agreedToTerms": true,              // required, must be true
  "role": "parent",                    // optional, default: "parent"
  "name": "Mariam"                     // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "token": "eyJhbGciOiJI...",
    "user": {
      "_id": "abc123",
      "name": "Mariam",
      "email": "parent@example.com",
      "phone": "+201234567890",
      "role": "parent",
      "children": [],
      "createdAt": "2026-02-16T12:00:00.000Z"
    }
  }
}
```

**Errors:** `409 CONFLICT` if email/phone already in use, `400 VALIDATION_ERROR` if passwords don't match.

---

#### `POST /api/auth/login`
Login with email or phone.

**Body:**
```json
{
  "identifier": "parent@example.com",  // email OR phone
  "password": "MyPassword123"
}
```

Alternative body (explicit fields):
```json
{
  "email": "parent@example.com",
  "password": "MyPassword123"
}
```
or:
```json
{
  "phone": "+201234567890",
  "password": "MyPassword123"
}
```

**Response (200):**
```json
{
  "data": {
    "token": "eyJhbGciOiJI...",
    "user": {
      "_id": "abc123",
      "name": "Mariam",
      "email": "parent@example.com",
      "role": "parent",
      "children": [
        { "_id": "child1", "name": "Adam", ... }
      ]
    }
  }
}
```

**Errors:** `401 AUTH_FAILED` if invalid credentials.

---

#### `POST /api/auth/forgot-password`

**Body:**
```json
{
  "identifier": "parent@example.com"
}
```

**Response (200):**
```json
{
  "data": {
    "sent": true
  },
  "message": "If an account exists, password reset instructions have been sent"
}
```

---

### 6.3 Users

#### `GET /api/users/me`
Get current authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "_id": "abc123",
    "name": "Mariam",
    "email": "parent@example.com",
    "phone": "+201234567890",
    "role": "parent",
    "children": [
      { "_id": "child1", "name": "Adam", "dateOfBirth": "2017-05-12T00:00:00.000Z" }
    ],
    "createdAt": "2026-02-16T12:00:00.000Z"
  }
}
```

---

#### `PATCH /api/users/me`
Update current user's profile.

**Body:**
```json
{
  "name": "Mariam Updated",   // optional
  "phone": "+201999999999"     // optional
}
```

**Response (200):** Updated user object.

---

### 6.4 Children

#### `POST /api/children`
Create a child profile. The logged-in parent is automatically added as guardian.

**Body:**
```json
{
  "name": "Adam",                  // required, min 2 chars
  "dateOfBirth": "2017-05-12",     // optional, ISO date
  "schoolId": "school_id_here",    // optional
  "guardianIds": ["userId1"]       // optional, defaults to current user
}
```

**Response (201):**
```json
{
  "child": {
    "_id": "child1",
    "name": "Adam",
    "dateOfBirth": "2017-05-12T00:00:00.000Z",
    "guardians": ["abc123"],
    "createdAt": "2026-02-16T12:00:00.000Z"
  }
}
```

---

#### `GET /api/children`
List all children belonging to the authenticated parent.

**Response (200):**
```json
{
  "children": [
    {
      "_id": "child1",
      "name": "Adam",
      "dateOfBirth": "2017-05-12T00:00:00.000Z",
      "guardians": [ { "_id": "abc123", "name": "Mariam" } ],
      "school": null,
      "device": null
    }
  ]
}
```

---

#### `GET /api/children/:childId`
Get a single child by ID.

**Response (200):**
```json
{
  "child": { ... }
}
```

---

#### `PATCH /api/children/:childId`
Update a child's profile.

**Body:**
```json
{
  "name": "Adam Updated",      // optional
  "dateOfBirth": "2017-06-01",  // optional
  "schoolId": "school_id"       // optional
}
```

---

### 6.5 Schools

#### `POST /api/schools` *(school/admin role only)*
Create a school. **Returns 403 for parent role.**

**Body:**
```json
{
  "name": "Future School",                // required
  "address": "123 Cairo Street",          // optional
  "coordinates": [31.2357, 30.0444]       // optional, [lng, lat]
}
```

**Response (201):**
```json
{
  "school": {
    "_id": "school1",
    "name": "Future School",
    "address": "123 Cairo Street",
    "location": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    }
  }
}
```

---

#### `GET /api/schools`
List all schools.

**Response (200):**
```json
{
  "schools": [ ... ]
}
```

---

### 6.6 Devices

#### `POST /api/devices` *(admin/school role only)*
Register a new wearable device. **Returns 403 for parent role.**

**Body:**
```json
{
  "serialNumber": "DEV-1001",    // required, unique
  "type": "watch"                // optional: "watch" | "band" | "tracker"
}
```

---

#### `POST /api/devices/:deviceId/assign` *(admin/school/parent)*
Assign a device to a child.

**Body:**
```json
{
  "childId": "child_id_here"
}
```

---

#### `GET /api/devices`
List all devices.

**Response (200):**
```json
{
  "devices": [
    {
      "_id": "dev1",
      "serialNumber": "DEV-1001",
      "type": "watch",
      "status": "active",
      "child": { "_id": "child1", "name": "Adam" },
      "lastSeenAt": "2026-02-16T12:00:00.000Z"
    }
  ]
}
```

---

### 6.7 Locations

#### `POST /api/locations`
Post a GPS location for a child. **Automatically checks geofences and creates breach alerts.**

**Body:**
```json
{
  "childId": "child_id",                 // required
  "coordinates": [31.2357, 30.0444],     // required, [longitude, latitude]
  "deviceId": "device_id",               // optional
  "accuracy": 10,                        // optional, meters
  "speed": 1.5,                          // optional, m/s
  "heading": 180,                        // optional, degrees
  "recordedAt": "2026-02-16T12:00:00Z",  // optional, defaults to now
  "imageUrl": "https://..."              // optional
}
```

**Response (201):**
```json
{
  "location": {
    "_id": "loc1",
    "child": "child_id",
    "coordinates": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "accuracy": 10,
    "recordedAt": "2026-02-16T12:00:00.000Z"
  }
}
```

**Side effects:**
- Emits `location:update` socket event
- Checks all active geofences for the child
- Creates `geofence` alert if child is outside a safe zone
- Emits `alert:new` socket event for breach alerts

---

#### `GET /api/locations/latest/:childId`
Get the most recent location for a child.

**Response (200):**
```json
{
  "location": {
    "_id": "loc1",
    "coordinates": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "accuracy": 10,
    "recordedAt": "2026-02-16T12:00:00.000Z"
  }
}
```

---

### 6.8 Geofences

#### `POST /api/geofences`
Create a safe zone for a child.

**Body:**
```json
{
  "name": "Home",                          // required
  "childId": "child_id",                   // required
  "coordinates": [31.2357, 30.0444],       // required, center [lng, lat]
  "radiusM": 500,                          // required, radius in meters (min 5)
  "schedule": {                            // optional
    "days": [0, 1, 2, 3, 4, 5, 6],       // 0=Sunday, 6=Saturday
    "start": "00:00",                      // HH:mm
    "end": "23:59"                         // HH:mm
  }
}
```

**Response (201):**
```json
{
  "geofence": {
    "_id": "geo1",
    "name": "Home",
    "child": "child_id",
    "center": {
      "type": "Point",
      "coordinates": [31.2357, 30.0444]
    },
    "radiusM": 500,
    "schedule": { "days": [0,1,2,3,4,5,6], "start": "00:00", "end": "23:59" },
    "active": true
  }
}
```

---

#### `GET /api/geofences?childId=<childId>`
List geofences. Optional `childId` query param to filter.

**Response (200):**
```json
{
  "geofences": [ ... ]
}
```

---

### 6.9 Alerts

#### `POST /api/alerts`
Create a manual alert.

**Body:**
```json
{
  "type": "custom",                        // required: "geofence" | "sos" | "vitals" | "movement" | "custom"
  "severity": "high",                      // optional: "low" | "medium" | "high" | "critical"
  "childId": "child_id",                   // required
  "message": "I saw something suspicious", // required
  "coordinates": [31.2357, 30.0444],       // optional
  "imageUrl": "https://...",               // optional
  "recipients": ["userId1", "userId2"]     // optional, who gets notified
}
```

**Response (201):**
```json
{
  "alert": {
    "_id": "alert1",
    "type": "custom",
    "severity": "high",
    "child": "child_id",
    "message": "I saw something suspicious",
    "location": { "type": "Point", "coordinates": [31.2357, 30.0444] },
    "resolved": false,
    "createdAt": "2026-02-16T12:00:00.000Z"
  }
}
```

**Side effects:** Emits `alert:new` to `child:<childId>` and `user:<recipientId>` rooms.

---

#### `GET /api/alerts?childId=<childId>`
List alerts. Optional `childId` query param to filter.

**Response (200):**
```json
{
  "alerts": [
    {
      "_id": "alert1",
      "type": "vitals",
      "severity": "critical",
      "child": "child_id",
      "message": "⚠️ DANGER detected for Adam: danger (87% confidence). HR=166.5 bpm",
      "resolved": false,
      "createdAt": "2026-02-16T12:00:00.000Z"
    }
  ]
}
```

**Alert types explained:**

| Type | Created By | Meaning |
|------|-----------|---------|
| `geofence` | Auto (location post) | Child left a safe zone |
| `vitals` | Auto (AI danger detection) | AI detected danger in sensor data |
| `sos` | Auto (danger) or manual | Emergency SOS |
| `movement` | Auto (AI playing detection) | High activity detected |
| `custom` | Manual (parent) | Parent-created alert |

---

### 6.10 SOS

#### `POST /api/sos`
Trigger an emergency SOS for a child.

**Body:**
```json
{
  "childId": "child_id",              // required
  "triggeredBy": "child",             // optional: "child" | "device" | "auto"
  "coordinates": [31.2357, 30.0444],  // optional
  "imageUrl": "https://..."           // optional
}
```

**Response (201):**
```json
{
  "event": {
    "_id": "sos1",
    "child": "child_id",
    "triggeredBy": "child",
    "status": "active",
    "location": { "type": "Point", "coordinates": [31.2357, 30.0444] },
    "createdAt": "2026-02-16T12:00:00.000Z"
  },
  "alert": {
    "_id": "alert_sos1",
    "type": "sos",
    "severity": "critical",
    "message": "SOS triggered for Adam",
    ...
  }
}
```

**Side effects:** Creates both an `SosEvent` and an `Alert`. Emits `sos:new` socket event to parent.

---

#### `PATCH /api/sos/:sosId/resolve`
Mark an SOS event as resolved.

**Response (200):**
```json
{
  "event": {
    "_id": "sos1",
    "status": "resolved",
    "resolvedAt": "2026-02-16T12:05:00.000Z"
  }
}
```

---

### 6.11 Activities

#### `POST /api/activities`
Create/update a daily activity summary (from the wearable).

**Body:**
```json
{
  "childId": "child_id",       // required
  "date": "2026-02-15",        // required, ISO date
  "steps": 4300,               // optional
  "activeMinutes": 72,         // optional
  "restMinutes": 540,          // optional
  "heartRateAvg": 95,          // optional
  "heartRateMax": 140          // optional
}
```

**Response (201):**
```json
{
  "summary": {
    "_id": "act1",
    "child": "child_id",
    "date": "2026-02-15T00:00:00.000Z",
    "steps": 4300,
    "activeMinutes": 72,
    "restMinutes": 540,
    "heartRateAvg": 95,
    "heartRateMax": 140
  }
}
```

**Note:** If a summary already exists for the same `childId + date`, it will be **updated** (upsert).

---

#### `GET /api/activities/:childId`
List activity summaries for a child (last 60 days).

**Response (200):**
```json
{
  "summaries": [ ... ]
}
```

---

### 6.12 Attendance

#### `POST /api/attendance`
Record school attendance (check-in or check-out).

**Body:**
```json
{
  "childId": "child_id",      // required
  "schoolId": "school_id",    // required
  "status": "in",             // required: "in" | "out"
  "source": "nfc"             // optional: "nfc" | "ble" | "manual"
}
```

**Response (201):**
```json
{
  "attendance": {
    "_id": "att1",
    "child": "child_id",
    "school": "school_id",
    "status": "in",
    "source": "nfc",
    "recordedAt": "2026-02-16T07:30:00.000Z"
  }
}
```

---

#### `GET /api/attendance?childId=<childId>&schoolId=<schoolId>`
List attendance records. Both query params are optional filters.

---

### 6.13 Analytics & AI Risk

#### `GET /api/analytics/behavior/:childId`
Get behavior insights by analyzing recent activity summaries.

**Response (200):**
```json
{
  "data": {
    "insights": {
      "status": "normal",             // "normal" | "attention" | "insufficient-data"
      "flags": [],                     // e.g. ["low-activity", "spike-heart-rate"]
      "latest": {
        "steps": 4300,
        "activeMinutes": 72,
        "heartRateAvg": 95,
        "heartRateMax": 140
      }
    }
  }
}
```

**Flags:**
- `low-activity` — Today's active minutes are less than 50% of the baseline
- `spike-heart-rate` — Today's max heart rate is more than 150% of the baseline

---

#### `POST /api/analytics/ai-risk/:childId`
Send raw sensor data to the AI model for risk classification.

**Body:**
```json
{
  "heart_rate_raw": [80, 82, 90, 85, 88, 92, 95, 100, 88, 86],    // required, min 3 values
  "accelerometer_raw": [1.1, 1.2, 1.0, 0.9, 1.3, 1.1, 1.0, 0.8, 1.2, 1.1],  // required, min 3 values
  "source": "watch",        // optional: "watch" | "band" | "manual" | "device"
  "imageUrl": "https://..." // optional
}
```

**Response (201):**
```json
{
  "data": {
    "assessment": {
      "_id": "risk1",
      "child": "child_id",
      "source": "watch",
      "rawPayload": {
        "heart_rate_raw": [80, 82, ...],
        "accelerometer_raw": [1.1, 1.2, ...]
      },
      "aiResponse": {
        "prediction_code": 0,
        "confidence_percentage": 99,
        "status_label": "normal",
        "calculated_features": {
          "hr_mean": 86.1,
          "hr_gradient": 12,
          "acc_mean": 1.07,
          "acc_variance": 0.017
        }
      },
      "triggeredAlert": null
    },
    "ai_result": {
      "prediction_code": 0,
      "confidence_percentage": 99,
      "status_label": "normal",
      "calculated_features": { ... }
    },
    "alert": null
  }
}
```

**AI Classification Results:**

| Code | Label | Meaning | Auto Actions |
|------|-------|---------|-------------|
| 0 | `normal` | Child is resting/walking normally | None |
| 1 | `playing` | Child is running/playing actively | Movement alert if confidence > 90% |
| 2 | `danger` | Potential danger detected | **Creates Alert + SOS automatically** |

**Calculated Features:**

| Feature | Unit | Normal Range | Danger Range |
|---------|------|-------------|-------------|
| `hr_mean` | bpm | 60–110 | ≥ 135 |
| `hr_gradient` | bpm | 0–10 | ≥ 15 |
| `acc_mean` | g | 0.5–1.5 | ≥ 2.5 |
| `acc_variance` | g² | 0–0.15 | ≥ 0.8 |

---

#### `GET /api/analytics/ai-risk/:childId`
List past AI risk assessments for a child (up to 100).

**Response (200):**
```json
{
  "data": {
    "assessments": [
      {
        "_id": "risk1",
        "aiResponse": {
          "prediction_code": 2,
          "status_label": "danger",
          "confidence_percentage": 87
        },
        "triggeredAlert": {
          "_id": "alert1",
          "type": "vitals",
          "severity": "critical"
        },
        "createdAt": "2026-02-16T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 6.14 Simulation

These endpoints trigger the **complete pipeline** end-to-end. Use them for testing and demos. They combine: AI classification → RiskAssessment save → Location save → Geofence check → Alert/SOS creation → Socket events.

---

#### `POST /api/simulate/watch-data`
Send custom raw sensor data through the full pipeline.

**Body:**
```json
{
  "childId": "child_id",                    // required
  "coordinates": [31.2357, 30.0444],        // optional, [lng, lat]
  "heart_rate_raw": [155, 160, 158, ...],   // required, min 5 values
  "accelerometer_raw": [3.2, 3.5, ...],     // required, min 5 values
  "source": "watch"                         // optional
}
```

**Response (201):**
```json
{
  "data": {
    "scenario": "custom",
    "classification": {
      "prediction_code": 2,
      "status_label": "danger",
      "confidence_percentage": 87.5
    },
    "features": {
      "hr_mean": 166.5,
      "hr_gradient": 15,
      "acc_mean": 3.52,
      "acc_variance": 0.188
    },
    "riskAssessmentId": "risk1",
    "locationId": "loc1",
    "triggeredAlert": "alert1",
    "timeline": [
      { "step": "ai_classification", "result": { ... } },
      { "step": "risk_assessment_saved", "id": "risk1" },
      { "step": "location_saved", "id": "loc1" },
      { "step": "geofence_breach", "fence": "Home", "distance": 250, "alertId": "alert2" },
      { "step": "danger_alert_created", "alertId": "alert1", "severity": "critical" },
      { "step": "sos_auto_triggered", "sosId": "sos1" },
      { "step": "sos_alert_created", "alertId": "alert3" }
    ]
  }
}
```

---

#### `POST /api/simulate/scenario/:type`
Auto-generate realistic sensor data for a preset scenario.

**URL params:**
- `type` — One of: `normal`, `playing`, `danger_struggle`, `danger_freeze`, `geofence_breach`, `sos`

**Body:**
```json
{
  "childId": "child_id",               // required
  "coordinates": [31.2357, 30.0444]    // optional (ignored for geofence_breach)
}
```

**Scenarios explained:**

| Scenario | HR (avg) | Acc Variance | Expected Classification | Auto Actions |
|----------|---------|-------------|------------------------|-------------|
| `normal` | ~85 bpm | ~0.05 | normal (99%) | None |
| `playing` | ~128 bpm | ~0.4 | playing (82%) | Movement alert if >90% |
| `danger_struggle` | ~155 bpm | ~1.2 | danger (80%) | Alert + SOS |
| `danger_freeze` | ~148 bpm | ~0.01 | danger (76%) | Alert + SOS |
| `geofence_breach` | ~90 bpm | ~0.1 | normal | Geofence alert |
| `sos` | ~160 bpm | ~1.5 | danger (85%) | Alert + SOS |

**Response (201):**
```json
{
  "data": {
    "scenario": "danger_struggle",
    "scenarioDescription": "Danger: struggle / assault pattern",
    "classification": {
      "prediction_code": 2,
      "status_label": "danger",
      "confidence_percentage": 80.4
    },
    "features": { ... },
    "riskAssessmentId": "risk1",
    "locationId": "loc1",
    "triggeredAlert": "alert1",
    "timeline": [ ... ],
    "generatedData": {
      "heart_rate_raw_sample": [155, 160, 142, 168, 151],
      "accelerometer_raw_sample": [2.8, 3.1, 2.5, 3.9, 2.2]
    }
  }
}
```

---

#### `POST /api/simulate/full-demo`
Run ALL 6 scenarios for a child sequentially.

> **Note:** This may timeout on Vercel free tier (10s limit). Prefer running individual scenarios.

**Body:**
```json
{
  "childId": "child_id",
  "coordinates": [31.2357, 30.0444]
}
```

**Response (201):**
```json
{
  "data": {
    "childId": "child_id",
    "scenarios": [
      { "scenario": "normal", "description": "Child at rest", "status": "normal", "confidence": 99, "alerts_triggered": 0 },
      { "scenario": "playing", "description": "Child running", "status": "playing", "confidence": 82, "alerts_triggered": 0 },
      { "scenario": "danger_struggle", "status": "danger", "confidence": 80, "alerts_triggered": 3 },
      { "scenario": "danger_freeze", "status": "danger", "confidence": 76, "alerts_triggered": 3 },
      { "scenario": "geofence_breach", "status": "normal", "confidence": 99, "alerts_triggered": 0 },
      { "scenario": "sos", "status": "danger", "confidence": 85, "alerts_triggered": 3 }
    ]
  }
}
```

---

## 7. Data Models

### User
```dart
class User {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;           // "parent" | "school" | "admin" | "staff" | "driver"
  final List<String> children; // Child IDs
  final String? school;        // School ID (for school role)
  final DateTime createdAt;
}
```

### Child
```dart
class Child {
  final String id;
  final String name;
  final DateTime? dateOfBirth;
  final List<String> guardians;  // User IDs
  final String? school;          // School ID
  final String? device;          // Device ID
  final DateTime createdAt;
}
```

### Location
```dart
class Location {
  final String id;
  final String childId;
  final double longitude;     // coordinates[0]
  final double latitude;      // coordinates[1]
  final double? accuracy;
  final double? speed;
  final double? heading;
  final DateTime recordedAt;
}
```

### Geofence
```dart
class Geofence {
  final String id;
  final String name;
  final String childId;
  final double longitude;     // center.coordinates[0]
  final double latitude;      // center.coordinates[1]
  final double radiusM;
  final GeofenceSchedule? schedule;
  final bool active;
}

class GeofenceSchedule {
  final List<int> days;       // 0=Sunday
  final String start;         // "07:00"
  final String end;           // "16:00"
}
```

### Alert
```dart
class Alert {
  final String id;
  final String type;           // "geofence" | "sos" | "vitals" | "movement" | "custom"
  final String severity;       // "low" | "medium" | "high" | "critical"
  final String childId;
  final String message;
  final double? longitude;
  final double? latitude;
  final String? imageUrl;
  final bool resolved;
  final DateTime createdAt;
}
```

### SosEvent
```dart
class SosEvent {
  final String id;
  final String childId;
  final String triggeredBy;    // "child" | "device" | "auto"
  final String status;         // "active" | "resolved"
  final double? longitude;
  final double? latitude;
  final DateTime? resolvedAt;
  final DateTime createdAt;
}
```

### RiskAssessment
```dart
class RiskAssessment {
  final String id;
  final String childId;
  final String source;              // "watch" | "band" | "manual" | "device"
  final AiResponse aiResponse;
  final String? triggeredAlertId;
  final DateTime createdAt;
}

class AiResponse {
  final int predictionCode;         // 0=normal, 1=playing, 2=danger
  final double confidencePercentage;
  final String statusLabel;         // "normal" | "playing" | "danger"
  final CalculatedFeatures features;
}

class CalculatedFeatures {
  final double hrMean;
  final double hrGradient;
  final double accMean;
  final double accVariance;
}
```

### ActivitySummary
```dart
class ActivitySummary {
  final String id;
  final String childId;
  final DateTime date;
  final int steps;
  final int activeMinutes;
  final int restMinutes;
  final double? heartRateAvg;
  final double? heartRateMax;
}
```

### Device
```dart
class Device {
  final String id;
  final String serialNumber;
  final String type;           // "watch" | "band" | "tracker"
  final String status;         // "active" | "inactive"
  final String? childId;
  final DateTime? lastSeenAt;
}
```

### School
```dart
class School {
  final String id;
  final String name;
  final String? address;
  final double? longitude;
  final double? latitude;
}
```

### Attendance
```dart
class Attendance {
  final String id;
  final String childId;
  final String schoolId;
  final String status;         // "in" | "out"
  final String source;         // "nfc" | "ble" | "manual"
  final DateTime recordedAt;
}
```

---

## 8. Flutter Implementation Guide

### Recommended packages

```yaml
# pubspec.yaml
dependencies:
  http: ^1.2.0              # HTTP client
  socket_io_client: ^2.0.3  # Real-time events
  shared_preferences: ^2.2.0 # Token persistence
  google_maps_flutter: ^2.5.0 # Map display
  geolocator: ^11.0.0       # Device GPS (for watch companion)
  flutter_local_notifications: ^17.0.0  # Push notifications
```

### API Service class

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class SwiriApi {
  static const String baseUrl = 'https://swiri.vercel.app';
  String? _token;

  // ── Auth ──────────────────────────────────────────

  Future<Map<String, dynamic>> signup({
    required String email,
    required String phone,
    required String password,
    String role = 'parent',
    String? name,
  }) async {
    final res = await _post('/api/auth/signup', {
      'email': email,
      'phone': phone,
      'password': password,
      'confirmPassword': password,
      'agreedToTerms': true,
      'role': role,
      if (name != null) 'name': name,
    });
    _token = _extract(res, 'token');
    return res;
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final res = await _post('/api/auth/login', {
      'identifier': identifier,
      'password': password,
    });
    _token = _extract(res, 'token');
    return res;
  }

  // ── Children ──────────────────────────────────────

  Future<Map<String, dynamic>> createChild({
    required String name,
    String? dateOfBirth,
  }) async {
    return _post('/api/children', {
      'name': name,
      if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
    });
  }

  Future<List<dynamic>> listChildren() async {
    final res = await _get('/api/children');
    return res['children'] ?? res['data']?['children'] ?? [];
  }

  // ── Locations ─────────────────────────────────────

  Future<Map<String, dynamic>> postLocation({
    required String childId,
    required double longitude,
    required double latitude,
    double? accuracy,
  }) async {
    return _post('/api/locations', {
      'childId': childId,
      'coordinates': [longitude, latitude],
      if (accuracy != null) 'accuracy': accuracy,
    });
  }

  Future<Map<String, dynamic>?> getLatestLocation(String childId) async {
    final res = await _get('/api/locations/latest/$childId');
    return res['location'] ?? res['data']?['location'];
  }

  // ── Geofences ─────────────────────────────────────

  Future<Map<String, dynamic>> createGeofence({
    required String name,
    required String childId,
    required double longitude,
    required double latitude,
    required double radiusM,
    List<int>? days,
    String? start,
    String? end,
  }) async {
    return _post('/api/geofences', {
      'name': name,
      'childId': childId,
      'coordinates': [longitude, latitude],
      'radiusM': radiusM,
      if (days != null) 'schedule': {
        'days': days,
        if (start != null) 'start': start,
        if (end != null) 'end': end,
      },
    });
  }

  Future<List<dynamic>> listGeofences({String? childId}) async {
    final query = childId != null ? '?childId=$childId' : '';
    final res = await _get('/api/geofences$query');
    return res['geofences'] ?? res['data']?['geofences'] ?? [];
  }

  // ── Alerts ────────────────────────────────────────

  Future<Map<String, dynamic>> createAlert({
    required String type,
    required String childId,
    required String message,
    String severity = 'medium',
    List<double>? coordinates,
  }) async {
    return _post('/api/alerts', {
      'type': type,
      'severity': severity,
      'childId': childId,
      'message': message,
      if (coordinates != null) 'coordinates': coordinates,
    });
  }

  Future<List<dynamic>> listAlerts({String? childId}) async {
    final query = childId != null ? '?childId=$childId' : '';
    final res = await _get('/api/alerts$query');
    return res['alerts'] ?? res['data']?['alerts'] ?? [];
  }

  // ── SOS ───────────────────────────────────────────

  Future<Map<String, dynamic>> triggerSos({
    required String childId,
    String triggeredBy = 'child',
    List<double>? coordinates,
  }) async {
    return _post('/api/sos', {
      'childId': childId,
      'triggeredBy': triggeredBy,
      if (coordinates != null) 'coordinates': coordinates,
    });
  }

  Future<Map<String, dynamic>> resolveSos(String sosId) async {
    return _patch('/api/sos/$sosId/resolve', {});
  }

  // ── Activities ────────────────────────────────────

  Future<Map<String, dynamic>> createActivity({
    required String childId,
    required String date,
    int? steps,
    int? activeMinutes,
    int? restMinutes,
    double? heartRateAvg,
    double? heartRateMax,
  }) async {
    return _post('/api/activities', {
      'childId': childId,
      'date': date,
      if (steps != null) 'steps': steps,
      if (activeMinutes != null) 'activeMinutes': activeMinutes,
      if (restMinutes != null) 'restMinutes': restMinutes,
      if (heartRateAvg != null) 'heartRateAvg': heartRateAvg,
      if (heartRateMax != null) 'heartRateMax': heartRateMax,
    });
  }

  Future<List<dynamic>> listActivities(String childId) async {
    final res = await _get('/api/activities/$childId');
    return res['summaries'] ?? res['data']?['summaries'] ?? [];
  }

  // ── Analytics ─────────────────────────────────────

  Future<Map<String, dynamic>> getBehaviorInsights(String childId) async {
    return _get('/api/analytics/behavior/$childId');
  }

  Future<Map<String, dynamic>> createAiRiskAssessment({
    required String childId,
    required List<double> heartRateRaw,
    required List<double> accelerometerRaw,
    String source = 'watch',
  }) async {
    return _post('/api/analytics/ai-risk/$childId', {
      'heart_rate_raw': heartRateRaw,
      'accelerometer_raw': accelerometerRaw,
      'source': source,
    });
  }

  Future<List<dynamic>> listAiRiskAssessments(String childId) async {
    final res = await _get('/api/analytics/ai-risk/$childId');
    return res['data']?['assessments'] ?? [];
  }

  // ── Simulation ────────────────────────────────────

  Future<Map<String, dynamic>> simulateWatchData({
    required String childId,
    required List<double> heartRateRaw,
    required List<double> accelerometerRaw,
    List<double>? coordinates,
  }) async {
    return _post('/api/simulate/watch-data', {
      'childId': childId,
      'heart_rate_raw': heartRateRaw,
      'accelerometer_raw': accelerometerRaw,
      if (coordinates != null) 'coordinates': coordinates,
    });
  }

  Future<Map<String, dynamic>> simulateScenario({
    required String childId,
    required String type, // normal, playing, danger_struggle, danger_freeze, geofence_breach, sos
    List<double>? coordinates,
  }) async {
    return _post('/api/simulate/scenario/$type', {
      'childId': childId,
      if (coordinates != null) 'coordinates': coordinates,
    });
  }

  // ── Attendance ────────────────────────────────────

  Future<Map<String, dynamic>> recordAttendance({
    required String childId,
    required String schoolId,
    required String status, // "in" | "out"
    String source = 'nfc',
  }) async {
    return _post('/api/attendance', {
      'childId': childId,
      'schoolId': schoolId,
      'status': status,
      'source': source,
    });
  }

  // ── HTTP helpers ──────────────────────────────────

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (res.statusCode >= 400) throw ApiException.fromResponse(res);
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode >= 400) throw ApiException.fromResponse(res);
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode >= 400) throw ApiException.fromResponse(res);
    return jsonDecode(res.body);
  }

  dynamic _extract(Map<String, dynamic> json, String key) {
    return json[key] ?? json['data']?[key];
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;

  ApiException({required this.statusCode, required this.code, required this.message});

  factory ApiException.fromResponse(http.Response response) {
    final json = jsonDecode(response.body);
    return ApiException(
      statusCode: response.statusCode,
      code: json['error']?['code'] ?? 'UNKNOWN',
      message: json['error']?['message'] ?? json['message'] ?? 'Error',
    );
  }

  @override
  String toString() => 'ApiException($statusCode $code): $message';
}
```

### Socket.IO service

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SwiriSocket {
  late IO.Socket socket;
  final String baseUrl;
  final String token;

  SwiriSocket({required this.baseUrl, required this.token}) {
    socket = IO.io(baseUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': token},
    });
  }

  void connect() {
    socket.connect();

    socket.onConnect((_) => print('Socket connected'));
    socket.onDisconnect((_) => print('Socket disconnected'));
    socket.onError((err) => print('Socket error: $err'));
  }

  void onLocationUpdate(void Function(String childId, Map<String, dynamic> location) callback) {
    socket.on('location:update', (data) {
      callback(data['childId'], data['location']);
    });
  }

  void onNewAlert(void Function(Map<String, dynamic> alert) callback) {
    socket.on('alert:new', (data) {
      callback(data['alert']);
    });
  }

  void onSos(void Function(Map<String, dynamic> event, Map<String, dynamic> alert) callback) {
    socket.on('sos:new', (data) {
      callback(data['event'], data['alert']);
    });
  }

  void onRiskAssessed(void Function(String childId, Map<String, dynamic> assessment) callback) {
    socket.on('risk:assessed', (data) {
      callback(data['childId'], data['assessment']);
    });
  }

  void disconnect() => socket.disconnect();
}
```

---

## 9. Complete Flow Examples

### Flow 1: App Startup (Parent)

```dart
final api = SwiriApi();

// 1. Login
await api.login(identifier: 'parent@example.com', password: '12345678');

// 2. Get user profile + children
final children = await api.listChildren();
final childId = children[0]['_id'];

// 3. Connect socket for real-time events
final socket = SwiriSocket(
  baseUrl: 'https://swiri.vercel.app',
  token: api._token!,
);
socket.connect();
socket.onNewAlert((alert) => showNotification(alert));
socket.onSos((event, alert) => showSOSDialog(event));

// 4. Get latest location
final location = await api.getLatestLocation(childId);

// 5. Get geofences for map overlay
final geofences = await api.listGeofences(childId: childId);

// 6. Get recent alerts
final alerts = await api.listAlerts(childId: childId);
```

### Flow 2: Watch Sends Data → Danger Detected

```dart
// Watch companion app collects sensor data periodically
final heartRates = [155, 160, 158, 162, 170, 175, 168, 172, 180, 165, ...];
final accelData  = [3.2, 3.5, 2.8, 3.9, 4.1, 3.7, ...];

// Send to AI for classification
final result = await api.createAiRiskAssessment(
  childId: childId,
  heartRateRaw: heartRates,
  accelerometerRaw: accelData,
);

// Check result
final prediction = result['data']['ai_result'];
if (prediction['prediction_code'] == 2) {
  // DANGER detected — alert was auto-created
  // Parent app receives socket event automatically
}
```

### Flow 3: Geofence Setup & Monitoring

```dart
// Parent creates a safe zone around home
await api.createGeofence(
  name: 'Home',
  childId: childId,
  longitude: 31.2357,
  latitude: 30.0444,
  radiusM: 500,
  days: [0, 1, 2, 3, 4, 5, 6],
  start: '00:00',
  end: '23:59',
);

// When watch posts a location outside the zone,
// a geofence alert is auto-created and pushed via socket
socket.onNewAlert((alert) {
  if (alert['type'] == 'geofence') {
    showGeofenceBreachNotification(alert);
  }
});
```

### Flow 4: SOS Button Press (Child)

```dart
// Child presses SOS button on watch
await api.triggerSos(
  childId: childId,
  triggeredBy: 'child',
  coordinates: [currentLng, currentLat],
);

// Parent receives socket event
socket.onSos((event, alert) {
  // Show emergency UI
  // Show location on map
  // Enable live tracking
});

// Parent resolves when safe
await api.resolveSos(event['_id']);
```

### Flow 5: Testing with Simulation

```dart
// Run a danger scenario to test your UI
final result = await api.simulateScenario(
  childId: childId,
  type: 'danger_struggle',
  coordinates: [31.2357, 30.0444],
);

// This triggers the full pipeline:
// - AI classifies as "danger"
// - RiskAssessment saved
// - Location saved
// - Geofences checked
// - Alert + SOS auto-created
// - Socket events emitted
// Your app should receive real-time notifications!
```

---

## Coordinate Format

All coordinates in the API use `[longitude, latitude]` format (GeoJSON standard).

| Example | Longitude | Latitude |
|---------|-----------|----------|
| Cairo | 31.2357 | 30.0444 |
| Alexandria | 29.9187 | 31.2001 |

**Flutter conversion:**
```dart
// From API → LatLng
final apiCoords = location['coordinates']['coordinates']; // [lng, lat]
final latLng = LatLng(apiCoords[1], apiCoords[0]);

// From LatLng → API
final coords = [latLng.longitude, latLng.latitude];
```

---

## Rate Limiting & Deployment Notes

- **Vercel free tier** has a 10-second function timeout. Individual endpoints work fine, but `/api/simulate/full-demo` may timeout.
- No explicit rate limiting is configured. Be reasonable with request frequency.
- MongoDB Atlas free tier is used — large batch operations should be chunked.
- Socket.IO may need polling fallback on some networks: `'transports': ['websocket', 'polling']`
