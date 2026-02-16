# SWIRI System Testing Guide

## Three Critical Features Implementation Status

### 1. GPS Tracking for Child ✅ IMPLEMENTED & WORKING

**Feature**: Watch sends child location to Flutter application in real-time.

**Implementation**:
- ✅ Location model with GeoJSON coordinates
- ✅ POST `/api/locations` endpoint to receive GPS data from watch
- ✅ Real-time Socket.IO event `location:update` broadcasts to Flutter app
- ✅ Geofence checking automatically on every location update
- ✅ Latest location retrieval via GET `/api/locations/latest/:childId`

**Testing**:
```bash
# Test location creation with GPS coordinates
curl -X POST http://localhost:4000/api/locations \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_id_here",
    "deviceId": "device_id_here",
    "coordinates": [31.2357, 30.0444],
    "accuracy": 10,
    "speed": 5.2,
    "heading": 180
  }'

# Expected Response:
{
  "success": true,
  "statusCode": 201,
  "data": {
    "location": {
      "_id": "...",
      "child": "...",
      "coordinates": {
        "type": "Point",
        "coordinates": [31.2357, 30.0444]
      },
      "accuracy": 10,
      "speed": 5.2,
      "heading": 180,
      "recordedAt": "2026-02-16T..."
    }
  }
}
```

**Socket.IO Event**: Flutter app receives `location:update` event in real-time.

---

### 2. Alarm System ✅ IMPLEMENTED & WORKING

**Feature**: When something happens, send alarm to the frontend.

**Implementation**:
- ✅ Alert model with types: geofence, sos, vitals, movement, custom
- ✅ Alert severity levels: low, medium, high, critical
- ✅ POST `/api/alerts` endpoint for manual alert creation
- ✅ POST `/api/sos` endpoint triggers critical SOS alert
- ✅ Real-time Socket.IO event `alert:new` broadcasts to Flutter app
- ✅ Real-time Socket.IO event `sos:new` for emergency alerts
- ✅ Automatic geofence alerts when child leaves safe zone
- ✅ Automatic AI risk alerts when danger detected from vitals

**Testing**:

#### Manual Alert
```bash
curl -X POST http://localhost:4000/api/alerts \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "severity": "high",
    "childId": "child_id_here",
    "message": "Custom alert message",
    "coordinates": [31.2357, 30.0444],
    "imageUrl": "https://camera.example.com/alert.jpg"
  }'
```

#### SOS Alert
```bash
curl -X POST http://localhost:4000/api/sos \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_id_here",
    "triggeredBy": "child",
    "coordinates": [31.2357, 30.0444],
    "imageUrl": "https://camera.example.com/sos.jpg"
  }'
```

**Socket.IO Events**: 
- `alert:new` - sent to guardians and child rooms
- `sos:new` - sent to guardians with critical priority

---

### 3. Camera Integration ✅ NEWLY IMPLEMENTED

**Feature**: Connect with cameras to attach image with the alert.

**Implementation**:
- ✅ Added `imageUrl` field to Alert model
- ✅ Added `imageUrl` field to SosEvent model
- ✅ All alert-generating endpoints support optional `imageUrl` parameter
- ✅ Images URLs validated as proper URI format
- ✅ Camera images included in Socket.IO alert broadcasts

**Supported Endpoints**:

1. **Manual Alerts** - POST `/api/alerts`
2. **SOS Events** - POST `/api/sos`
3. **Location Updates** - POST `/api/locations` (image attached to geofence alerts)
4. **AI Risk Assessment** - POST `/api/analytics/ai-risk/:childId` (image attached to danger alerts)

**Testing**:

#### Alert with Camera Image
```bash
curl -X POST http://localhost:4000/api/alerts \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "movement",
    "severity": "medium",
    "childId": "child_id_here",
    "message": "Unusual movement detected",
    "coordinates": [31.2357, 30.0444],
    "imageUrl": "https://s3.amazonaws.com/swiri-cameras/child123/movement-20260216.jpg"
  }'
```

#### SOS with Camera Image
```bash
curl -X POST http://localhost:4000/api/sos \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_id_here",
    "triggeredBy": "device",
    "coordinates": [31.2357, 30.0444],
    "imageUrl": "https://camera-cdn.swiri.com/sos-emergency-12345.jpg"
  }'
```

#### Location with Camera (for geofence alert)
```bash
curl -X POST http://localhost:4000/api/locations \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_id_here",
    "deviceId": "device_id_here",
    "coordinates": [31.2357, 30.0444],
    "imageUrl": "https://camera.example.com/geofence-violation.jpg"
  }'
```
If child is outside geofence during active schedule, alert will include the image.

#### AI Risk with Camera Image
```bash
curl -X POST http://localhost:4000/api/analytics/ai-risk/child_id_here \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "heart_rate_raw": [80, 82, 90, 135, 145],
    "accelerometer_raw": [1.1, 1.2, 3.5, 4.0, 3.8],
    "imageUrl": "https://camera.example.com/vitals-danger.jpg"
  }'
```
If danger is detected, alert will include the camera image.

---

## Integration Testing

### Socket.IO Connection from Flutter

```javascript
// Flutter app should connect like this:
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket socket = IO.io('http://your-backend:4000', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': true,
  'auth': {
    'token': 'jwt_token_here'
  }
});

// Listen for location updates
socket.on('location:update', (data) {
  print('Location update: ${data['location']}');
  // Update map with new coordinates
});

// Listen for alerts
socket.on('alert:new', (data) {
  print('Alert: ${data['alert']['message']}');
  print('Image URL: ${data['alert']['imageUrl']}'); // NEW: Camera image
  // Show alert notification with image
});

// Listen for SOS events
socket.on('sos:new', (data) {
  print('EMERGENCY SOS: ${data['alert']['message']}');
  print('Image URL: ${data['alert']['imageUrl']}'); // NEW: Camera image
  // Trigger emergency UI with camera image
});
```

---

## Validation Checklist

### GPS Tracking ✅
- [x] Location model created and indexed
- [x] POST /api/locations endpoint accepts GPS data
- [x] Coordinates stored in GeoJSON Point format
- [x] Socket.IO emits location:update events
- [x] Latest location can be retrieved
- [x] Geofence checking on location updates
- [x] Camera images supported in location requests

### Alarm System ✅
- [x] Alert model with multiple types and severity levels
- [x] POST /api/alerts endpoint for manual alerts
- [x] POST /api/sos endpoint for SOS events
- [x] Socket.IO emits alert:new events
- [x] Socket.IO emits sos:new events
- [x] Automatic geofence alerts created
- [x] Automatic AI risk alerts created
- [x] Alerts sent to correct recipients (guardians)
- [x] Camera images supported in all alerts

### Camera Integration ✅
- [x] imageUrl field added to Alert model
- [x] imageUrl field added to SosEvent model
- [x] imageUrl parameter in POST /api/alerts
- [x] imageUrl parameter in POST /api/sos
- [x] imageUrl parameter in POST /api/locations
- [x] imageUrl parameter in POST /api/analytics/ai-risk/:childId
- [x] URL validation using Joi
- [x] Images included in Socket.IO broadcasts
- [x] Documentation updated

---

## Expected Behavior Summary

1. **Watch sends GPS location** → Backend stores → Flutter receives real-time update → Map shows child position
2. **Geofence violation detected** → Backend creates high-severity alert → Flutter receives notification (with camera image if provided)
3. **Child presses SOS button** → Backend creates critical alert + SOS event → Flutter shows emergency alert (with camera image if provided)
4. **AI detects danger from vitals** → Backend creates critical vitals alert → Flutter shows warning (with camera image if provided)
5. **Camera captures event** → Image URL sent with any alert → Flutter displays image in alert notification

---

## Notes

- All responses follow standard API envelope format (success/error)
- All alerts broadcast via Socket.IO to relevant rooms (child:<id>, user:<id>)
- Authentication required for all endpoints (JWT Bearer token)
- Images are stored externally (CDN/cloud storage) - only URLs stored in database
- Recommended image storage: AWS S3, Azure Blob Storage, or similar CDN
