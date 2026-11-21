# ResQ Rover --- Frontend PRD

**Application:** ResQ Rover Operations Dashboard\
**Stack:** React.js + Vite, Tailwind CSS, Recharts; REST + native browser WebSocket API
connected to FastAPI WebSocket endpoints.

## 1. Objective

Build a responsive, professional operations dashboard for monitoring the
rover, its environmental sensors, camera, communication status, alerts,
mission timeline and building hazard map. The dashboard must be usable
on a laptop first and remain usable on a tablet.

## 2. Design direction

-   Professional industrial/emergency-operations interface.
-   Dark theme may be the default, but maintain readable contrast and
    accessible status colors.
-   Use clear typography, restrained color, consistent spacing and
    compact information hierarchy.
-   Avoid decorative gauges that obscure exact values.
-   Use labels and units alongside every measurement.
-   Use icons consistently; never rely on color alone to communicate
    status.
-   Responsive layout: desktop two/three-column dashboard; tablet
    stacked sections; mobile simplified read-only view.
-   Provide loading, empty, offline, stale, error and demo states.

## 3. Navigation and pages

### 3.1 Overview / Operations

Primary live monitoring page containing: - Active mission name and
mission status. - Backend connection status. - Rover
online/offline/last-seen state. - Sensor summary cards. - Camera
panel. - Hazard indicator with explanation and data completeness. -
Active alerts panel. - Communication/battery status where available. -
Recent event timeline.

### 3.2 Live Monitoring

-   Temperature reading with unit and timestamp.
-   MQ-2 raw/relative gas-smoke sensor reading; do not label as ppm
    unless calibration metadata exists.
-   Distance reading in cm or mm, clearly identified as the ultrasonic
    sensor's nearest measured distance.
-   PIR/motion event state.
-   Battery percentage/voltage only if supplied by firmware.
-   Sensor online/error/stale state.
-   Recent history chart with selectable time range.
-   Show raw and derived values separately.

### 3.3 Camera

-   Stream display component supporting a configured MJPEG URL or
    browser-compatible stream source.
-   Snapshot gallery with timestamp and event association.
-   Camera status: connected, disconnected, initializing, unavailable.
-   Retry/reconnect action.
-   Do not assume the current firmware already exposes a stream.
-   If stream is unavailable, show a placeholder explaining that camera
    transport/firmware integration is pending.
-   Do not convert RGB565 raw frames to MP4 in the browser. Any
    conversion/recording is a backend/vision responsibility.

### 3.4 Building Map

-   Upload PNG/JPEG floor plan.
-   Display floor plan with zoom and pan.
-   Add/edit/delete manually placed markers.
-   Marker types: gas/smoke observation, high temperature, motion event,
    obstacle, snapshot, rover waypoint, operator note.
-   Marker includes timestamp, source, severity/category and linked
    event.
-   Filters by marker type and time.
-   Legend and map calibration controls.
-   Explicitly state "manual/estimated location" where no localization
    system is connected.
-   Never place a marker at an inferred exact location from sensor
    values alone.

### 3.5 Alerts

-   Active and acknowledged alerts.
-   Severity: info, warning, critical; severity comes from configured
    backend rules.
-   Display trigger value, configured threshold, timestamp,
    sensor/device and acknowledgement status.
-   Acknowledge alert with operator identity/name if authentication
    exists.
-   Do not allow the frontend to independently invent alert severity.

### 3.6 Mission History

-   List missions with start/end time and status.
-   Mission detail timeline with telemetry events, alerts, snapshots and
    operator notes.
-   Filter by date, event type and severity.
-   Export mission data as CSV/JSON through backend endpoints.

### 3.7 Settings

-   Backend URL and connection test.
-   Camera stream URL and test.
-   Threshold configuration (only if backend supports authenticated
    persistence).
-   Sensor display units and stale-data duration.
-   Demo/simulator mode.
-   Do not store secrets in browser local storage.

## 4. Reusable components

Suggested components: - `AppShell`, `Sidebar`, `TopStatusBar` -
`ConnectionBadge`, `DeviceStatusCard` - `SensorMetricCard`,
`SensorHealthIndicator` - `TemperatureChart`, `GasTrendChart`,
`DistanceChart` - `CameraStream`, `SnapshotGallery` - `HazardIndicator`,
`AlertList`, `AlertCard` - `BuildingPlanViewer`, `MapMarker`,
`MapLegend`, `MapCalibrationPanel` - `MissionTimeline`,
`MissionSelector` - `EmptyState`, `ErrorState`, `LoadingSkeleton`,
`StaleDataLabel` - `DemoModeBanner`

Use a clear component/data boundary. Components should not make
arbitrary direct HTTP calls; use a centralized API client and FastAPI WebSockets
service.

## 5. Real-time behavior

-   Fetch initial dashboard snapshot from REST API.
-   Connect to FastAPI WebSockets and subscribe to telemetry, device status,
    alert and mission events.
-   Reconnect automatically with backoff.
-   On reconnect, fetch a fresh snapshot to fill gaps.
-   Display last update time for each sensor/device.
-   Mark a reading stale after a configurable period (initial default
    may be 10 seconds, configurable).
-   Avoid excessive re-renders; batch or throttle chart updates if
    needed.
-   Keep a bounded in-memory chart window; older history comes from the
    API.

## 6. Suggested API/event contract

REST endpoints are served by FastAPI and documented through its generated
OpenAPI schema at `/docs` and `/openapi.json`.

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/devices`
- `GET /api/telemetry/latest`
- `GET /api/telemetry/history?deviceId=&from=&to=&limit=`
- `GET /api/alerts?status=`
- `POST /api/alerts/{alert_id}/acknowledge`
- `GET /api/missions`
- `POST /api/missions`
- `GET /api/missions/{mission_id}`
- `POST /api/missions/{mission_id}/start`
- `POST /api/missions/{mission_id}/stop`
- `POST /api/blueprints` (multipart upload)
- `GET /api/blueprints`
- `POST /api/observations`
- `GET /api/observations?missionId=`
- `GET /api/missions/{mission_id}/export?format=csv|json`

Real-time: `WS /api/ws` (single event stream) or a documented, consistently
implemented scoped equivalent. The server sends JSON envelopes with
`event`, `timestamp` and `data`. Event names preserve the product contract:
`telemetry:update`, `device:status`, `alert:created`, `alert:updated`,
`mission:updated`, `observation:created`, `camera:status`, `vision:event`.
These are application event names, not Socket.IO rooms or packets.

Example envelope:

```json
{
  "event": "telemetry:update",
  "timestamp": "2026-11-13T16:00:00.000Z",
  "data": {
    "recordId": "telemetry-id",
    "deviceId": "rover-01",
    "temperatureC": 42.5,
    "mq2Raw": 1850,
    "distanceCm": 120,
    "motionDetected": true,
    "sourceMode": "real"
  }
}
```

The backend PRD defines validation and persistence behavior. The WebSocket
connection supplements REST; it does not replace REST history queries.

## 7. Data display rules

-   Display `—` for missing values, not zero.
-   Show unit, timestamp and source.
-   Distinguish live, stale, simulated and unavailable values.
-   Use "MQ-2 raw ADC" or "relative sensor reading" unless calibrated.
-   Motion means PIR triggered, not "human detected".
-   A camera image is not proof of victim identity or condition.
-   Hazard indicator must show its basis and data completeness.
-   Never show a green "safe" state or "safe to enter" message.

## 8. Accessibility and usability

-   Keyboard-accessible navigation and controls.
-   Visible focus indicators.
-   Sufficient text/background contrast.
-   Charts have textual summaries or accessible labels.
-   Status is communicated through text and icon as well as color.
-   Confirm destructive actions such as deleting missions or
    observations.

## 9. Error handling

-   Backend offline: banner and last known update; do not present stale
    values as live.
-   WebSocket disconnected: show reconnecting state.
-   Camera offline: show camera placeholder without breaking page.
-   Vision service offline: show "vision analysis unavailable"; sensor
    monitoring continues.
-   Invalid blueprint: explain supported formats/size.
-   API error: concise message and retry action.

## 10. Demo mode

Provide a clearly labelled simulator mode: - Generates plausible but
explicitly simulated readings. - Includes configurable event
scenarios. - Does not mix simulated and real telemetry. - Banner and
per-reading label identify simulated data. - Demo mode can be run
without ESP32 hardware.

## 11. Acceptance criteria

1.  Dashboard starts using documented commands.
2.  Initial REST data loads and FastAPI WebSocket events update live cards.
3.  Disconnect/reconnect states are visible and recover.
4.  Missing and stale readings are handled correctly.
5.  Camera placeholder works before stream integration.
6.  Blueprint upload and manual marker workflow works.
7.  Alerts and mission timeline reflect backend data.
8.  CSV/JSON export can be downloaded.
9.  Demo mode is clearly labelled and can be toggled.
10. Frontend does not calculate or fabricate hardware measurements.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
