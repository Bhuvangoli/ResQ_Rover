# ResQ Rover --- Product Overview PRD

**Document type:** Product requirements\
**Product:** ResQ Rover\
**Status:** Initial implementation specification\
**Primary deployment:** Local laptop development; later deployable to a
Raspberry Pi or local edge computer.

## 1. Product vision

ResQ Rover is a remotely operated reconnaissance rover intended to help
responders obtain preliminary situational awareness in hazardous or
inaccessible environments. It combines mobile robotics, environmental
sensing, camera imagery, communication monitoring, event logging and a
building-plan visualization.

The dashboard must present measured information clearly and
conservatively. It must help an operator understand what the rover has
measured, when it was measured, whether the sensor is online, and where
the observation is believed to have occurred.

## 2. Product goals

1.  Present live and historical sensor telemetry.
2.  Present camera status and, once firmware supports it, a live camera
    stream.
3.  Display clear alerts when configured thresholds are crossed.
4.  Calculate a transparent, configurable hazard indicator without
    claiming certified risk assessment.
5.  Let an operator upload a building blueprint and record observations
    against it.
6.  Display rover connectivity, battery and device status when those
    fields are available.
7.  Maintain a timestamped mission/event history.
8.  Generate concise scenario summaries from verified sensor and vision
    events.
9.  Work locally without requiring a cloud account or external AI
    service.
10. Keep the frontend, backend, vision service and existing ESP32
    firmware loosely coupled.

## 3. Non-goals for the first release

-   No mandatory AI model, YOLO model or model training.
-   No autonomous navigation or SLAM.
-   No automatic indoor positioning unless a separate localization
    source is integrated.
-   No certified gas analysis, fire detection certification or
    declaration that an area is safe.
-   No direct control of motors until hardware command protocol,
    acknowledgements and stop behavior are verified.
-   No cloud dependency for core local operation.
-   No MP4 encoding on the ESP32-CAM.

## 4. Target users

-   Rover operator controlling and monitoring a mission.
-   Technical team configuring sensors, thresholds and connectivity.
-   Reviewer/instructor viewing a mission demonstration and its recorded
    evidence.

## 5. System architecture

```text
ESP32 sensor/motor controller (if present)
        │ HTTP telemetry POST or agreed USB-serial JSON adapter
        ▼
Python communication adapter / FastAPI backend
        │
        ├── SQLAlchemy 2.x ORM ── in-memory SQLite (:memory:)
        │                         (prototype metadata; process lifetime only)
        │
        ├── local file storage (blueprints, snapshots, recordings, exports)
        │
        ├── REST API (JSON / multipart uploads)
        │
        └── FastAPI WebSockets (telemetry, alerts, mission/device status)
                         │
                         ▼
                 React + Vite dashboard
                 Tailwind CSS + Recharts
                 SVG / HTML Canvas blueprint overlay

ESP32-CAM ── tested camera transport (not assumed to exist) ──►
browser or FastAPI ingestion endpoint
                         │
                         ▼
              Optional OpenCV processing
              Optional future YOLO provider
```

The FastAPI backend is the system's source of truth for validated telemetry,
alert state and mission events. React obtains an initial snapshot through REST
and receives subsequent event updates through FastAPI WebSockets. The browser
must not invent sensor values. SQLAlchemy 2.x is the ORM; SQLite configured as
`:memory:` is the database engine. Database rows are lost when the backend
process exits or restarts. Binary assets remain in the configured local file
storage area and are not stored as database blobs.

## 6. Approved technology stack

- Frontend: React.js + Vite.
- Styling: Tailwind CSS.
- Backend: Python 3 + FastAPI; Pydantic request/response schemas.
- ORM: SQLAlchemy 2.x.
- Database engine: in-memory SQLite (`sqlite+pysqlite:///:memory:`) for the prototype.
- Real-time communication: FastAPI WebSockets.
- Charts: Recharts.
- Rover/floor-plan visualization: SVG and/or HTML Canvas overlays.
- Image processing: OpenCV optional; it must not be required for core telemetry.
- Object detection: YOLO optional future enhancement, disabled by default.
- Testing: Vitest/React Testing Library for frontend; pytest and FastAPI TestClient
  for backend; use compatible package versions at implementation time.

Do not substitute a persistent database or introduce PostgreSQL, MongoDB,
MySQL, Node.js or Express. SQLAlchemy is not a database engine. Do not add
an alternative real-time framework. Verify package compatibility at
implementation time rather than pinning obsolete versions blindly.

## 7. Core user workflows

### 7.1 Start a mission

1.  Operator opens dashboard.
2.  Dashboard shows backend status and device connectivity.
3.  Operator creates a mission with a name and optional building/area
    description.
4.  Operator starts the mission.
5.  Incoming telemetry and events are associated with the active
    mission.

### 7.2 Monitor rover

1.  Dashboard receives telemetry.
2.  Latest values, timestamps and connection status update.
3.  Charts show recent history.
4.  Alerts appear when configured rules are met.
5.  Stale data is visibly marked.

### 7.3 Review camera

1.  Dashboard shows camera connection status.
2.  If a stream URL is configured and reachable, display the stream.
3.  If unavailable, show a clear placeholder and reason where known.
4.  If snapshots are received, show them with timestamp and source.

### 7.4 Map observations

1.  Operator uploads a floor-plan image (PNG/JPEG initially).
2.  Operator calibrates the plan by setting a scale or coordinate
    reference if required.
3.  Operator manually places rover/observation markers unless a reliable
    pose source is available.
4.  Hazard and observation markers are timestamped and categorized.
5.  Operator can filter markers by category and severity.

### 7.5 Review mission

1.  Operator opens mission history.
2.  Dashboard displays timeline of sensor events, snapshots, alerts and
    operator notes.
3.  Operator can export a mission summary and telemetry as CSV/JSON.

## 8. Telemetry principles

-   All telemetry must include a device identifier and timestamp.
-   Prefer UTC ISO-8601 timestamps in API payloads and database storage.
-   Include units and sensor status where known.
-   Preserve raw sensor values; derive display values separately.
-   Validate payloads and reject malformed or out-of-range data.
-   Record receipt time separately from device measurement time.
-   Do not silently substitute zero for missing readings.
-   Data older than the configured freshness threshold must be marked
    stale.

## 9. Hazard indication

The backend may calculate a configurable prototype hazard index from
available, normalized inputs. The formula, weights, threshold and
missing-data behavior must be documented in the UI and configuration.

Requirements: - Do not hard-code arbitrary weights as scientifically
validated. - Make the formula configurable. - Do not treat PIR/motion as
a hazard measurement. - Do not convert MQ-2 raw ADC into ppm without
calibration and a validated conversion. - If required inputs are missing
or stale, show "insufficient data" or "partial assessment" rather than a
misleading score. - Always label the score as an experimental indicator,
not a certified safety rating.

## 10. Security and privacy

-   Local network by default.
-   No credentials committed to source control.
-   Use `.env.example` with placeholder values and `.env` in
    `.gitignore`.
-   Validate and limit uploaded file types and sizes.
-   Do not expose unrestricted filesystem paths through APIs.
-   Restrict CORS to configured origins.
-   Add a simple local operator authentication option before any
    network-exposed deployment.
-   Avoid storing identifiable imagery longer than necessary; provide
    configurable retention/deletion.

## 11. Reliability

-   Dashboard must tolerate backend disconnect/reconnect.
-   Show last successful update time.
-   Avoid displaying stale values as live.
-   Buffer or queue events when feasible; report data loss when it
    cannot be recovered.
-   Backend should log errors with timestamps and request/event context.
-   Core telemetry and alerts must work without the optional vision
    service.

## 12. Release milestones

**M0 --- Skeleton:** frontend, backend, health endpoint, environment
config, README.\
**M1 --- Simulator:** simulated telemetry feeds dashboard and charts.\
**M2 --- Hardware telemetry:** real ESP32/gateway data accepted and
validated.\
**M3 --- Camera:** stream or snapshot transport implemented and tested.\
**M4 --- Missions and mapping:** blueprint upload, manual markers,
history.\
**M5 --- Vision:** optional OpenCV events; YOLO only if explicitly
enabled.\
**M6 --- Hardening:** tests, error states, retention, export, deployment
documentation.

## 13. Global acceptance criteria

-   A new developer can start frontend and backend using documented
    commands.
-   Dashboard can run in demo/simulator mode without hardware.
-   Real telemetry is validated before being broadcast or stored.
-   Stale/offline devices are clearly identified.
-   Camera-unavailable state is explicit.
-   Blueprint markers do not imply unverified localization.
-   No UI or report claims that the environment is safe.
-   Optional vision failure does not stop telemetry/dashboard operation.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
