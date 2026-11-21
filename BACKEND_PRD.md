# ResQ Rover --- Backend PRD

**Stack:** Python 3, FastAPI, Pydantic, SQLAlchemy 2.x, in-memory SQLite,
FastAPI WebSockets.

## 1. Objective

Build the local Python backend that receives device telemetry, validates and
timestamps it, stores prototype mission metadata, evaluates configurable
alert rules, exposes REST APIs and broadcasts real-time events to the React
dashboard. The backend must run without camera/vision dependencies.

## 2. Architecture

Use small, testable modules with these responsibilities:

- `app/main.py` --- FastAPI application factory, lifespan and router registration.
- `app/api/` --- FastAPI `APIRouter` modules and route handlers.
- `app/schemas/` --- Pydantic request/response models.
- `app/models/` --- SQLAlchemy 2.x declarative ORM models.
- `app/db/` --- engine, session factory, dependency and schema initialization.
- `app/services/` --- telemetry ingestion, device status, alerts, missions,
  observations, exports and media metadata business logic.
- `app/realtime/` --- WebSocket connection manager and event publisher.
- `app/adapters/` --- hardware transport adapters (HTTP and, only if selected,
  USB serial).
- `app/simulator/` --- demo telemetry generator, isolated from real ingestion.
- `app/core/` --- settings, logging, errors and shared utilities.
- `tests/` --- pytest unit, API, WebSocket and integration tests.

Route handlers validate/translate HTTP input and call services. Services own
business rules and transaction boundaries. ORM models are not returned directly;
serialize through Pydantic response schemas. Do not put all logic in `main.py`.

## 3. Runtime and configuration

Use `pydantic-settings` or an equivalent small settings module. Provide
`.env.example`; never commit `.env`, credentials or API keys.

| Variable | Default / behavior |
|---|---|
| `HOST` | `127.0.0.1`; LAN binding only when explicitly configured |
| `PORT` | `8000` |
| `CORS_ORIGINS` | Explicit frontend origin, e.g. `http://localhost:5173` |
| `DATABASE_URL` | `sqlite+pysqlite:///:memory:`; no persistent DB URL |
| `TELEMETRY_STALE_AFTER_MS` | Configurable freshness threshold |
| `CAMERA_STREAM_URL` | Optional, empty unless actually configured |
| `DEVICE_API_KEY` | Optional shared device token for local network |
| `STORAGE_ROOT` | Local file root, e.g. `../storage` |
| `LOG_LEVEL` | `INFO` |

The in-memory SQLite engine must use one shared connection across FastAPI
request threads, e.g. SQLAlchemy `create_engine` with
`connect_args={"check_same_thread": False}` and `poolclass=StaticPool`.
Use a single application-scoped engine and `sessionmaker`; create a fresh
Session per request/task and close it reliably. The exact URI and pool setup
must be covered by a test proving records are visible across requests in the
same process. Do not configure a file path, WAL mode or persistent DB backup.

## 4. Database integration

Use SQLAlchemy 2.x typed declarative mappings (`DeclarativeBase`, `Mapped`,
`mapped_column`, `relationship`) and SQLAlchemy `select()` statements.
Use `Session`/`sessionmaker` with explicit commit/rollback boundaries.
Foreign keys must be enabled on SQLite connections. Initialize prototype
schema with `Base.metadata.create_all(engine)` during application startup.
Because the selected database is ephemeral, database migration tooling and
durable database backup are not part of this prototype baseline. Schema is
re-created empty at each process start. Do not claim mission/telemetry rows
survive restart. Keep large files on disk and store only metadata/relative
storage keys in SQLite.

## 5. Pydantic validation and telemetry ingestion

Endpoint: `POST /api/telemetry`

Accept JSON with:
- `deviceId` (required non-empty string)
- `timestamp` (optional ISO-8601 timestamp; if absent, use receipt time and
  record `timestampSource="server_received"`)
- `sequence` (optional non-negative integer)
- `temperatureC` (optional number)
- `mq2Raw` (optional integer/raw ADC)
- `distanceCm` (optional number)
- `motionDetected` (optional boolean)
- `batteryPercent` (optional 0--100)
- `batteryVoltage` (optional number)
- `rssiDbm` (optional number)
- `sensorStatus` (optional object)
- source mode is assigned by trusted simulator route/configuration; do not
  trust an arbitrary client field to label real data as simulated.

Example:

```json
{
  "deviceId": "rover-01",
  "timestamp": "2026-11-13T16:00:00.000Z",
  "sequence": 1042,
  "temperatureC": 42.5,
  "mq2Raw": 1850,
  "distanceCm": 120,
  "motionDetected": true,
  "batteryPercent": 78
}
```

Use Pydantic models with strict types where practical, explicit field aliases
for camelCase API names, bounds where justified, and `extra="forbid"` or a
documented compatibility policy. Do not assume ADC resolution until firmware
is confirmed. `mq2Raw` is raw sensor output, not ppm.

Requirements:
- Reject malformed payloads with FastAPI/Pydantic 422 responses; use a
  consistent application error shape for domain errors.
- Preserve raw values and record `receivedAt` separately.
- Detect duplicate/out-of-order sequence values when supplied; define whether
  duplicates are rejected or accepted as flagged records.
- Associate telemetry with active mission when applicable.
- Commit accepted telemetry before publishing `telemetry:update`; on commit
  failure return an error and do not broadcast accepted data.
- Return a stable response containing `accepted`, `recordId` and server time.
- Apply request size limits and a configurable ingestion rate limit at the
  application/gateway layer. Do not add an unapproved external service.

## 6. Device status

Track device ID, online/offline/stale state, last seen, last telemetry time,
firmware version if supplied, battery/communication metadata if supplied and
sensor health. A device becomes stale after the configured interval.
Distinguish absence of recent telemetry from a device-reported fault.

## 7. Hazard and alert engine

Implement deterministic, configurable rules first. Examples:
- temperature exceeds configured threshold;
- MQ-2 raw reading exceeds configured relative threshold;
- distance falls below obstacle threshold;
- sensor reports an error;
- device telemetry becomes stale.

Each rule has rule ID/name, field, operator, threshold, severity, enabled
state, description and optional hysteresis/debounce. Avoid alert flapping.
Store alert transitions and acknowledgement in the current in-memory DB.
Do not generate a "human detected" alert from PIR alone; use "PIR motion
event". Do not label MQ-2 as ppm without validated calibration. Any hazard
index is a transparent experimental indicator; exclude motion by default,
show incomplete assessment when required data is absent/stale, and never
produce "safe to enter" decisions.

## 8. REST API

Implement the following functional API contract. Use `{id}` path parameters
in FastAPI route declarations and typed parameters. The identifiers below
are illustrative path variable names; preserve the resource semantics.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | App and in-memory DB health |
| GET | `/api/dashboard` | Initial dashboard snapshot |
| GET | `/api/devices` | Device status list |
| GET | `/api/telemetry/latest` | Latest readings |
| GET | `/api/telemetry/history` | Filtered, paginated history |
| POST | `/api/telemetry` | Ingest telemetry |
| GET | `/api/alerts` | List/filter alerts |
| POST | `/api/alerts/{alert_id}/acknowledge` | Acknowledge alert |
| GET | `/api/missions` | List missions |
| POST | `/api/missions` | Create mission |
| GET | `/api/missions/{mission_id}` | Mission detail |
| POST | `/api/missions/{mission_id}/start` | Start mission |
| POST | `/api/missions/{mission_id}/stop` | Stop mission |
| POST | `/api/blueprints` | Upload PNG/JPEG blueprint |
| GET | `/api/blueprints` | List blueprint metadata |
| POST | `/api/observations` | Create manual/system observation |
| GET | `/api/observations` | List/filter observations |
| GET | `/api/missions/{mission_id}/export` | CSV/JSON export |

Query parameter names should follow the existing frontend contract
(`deviceId`, `from`, `to`, `limit`, `status`, `missionId`, `format`) or be
documented consistently. Use Pydantic schemas for all request and response
bodies. FastAPI generates OpenAPI at `/openapi.json` and Swagger UI at
`/docs`; keep both enabled for local development.

Suggested success envelope: `{"data": ..., "meta": ...}`. Suggested error
envelope: `{"error":{"code":"...","message":"...","details":...}}`.
FastAPI's validation error response may be normalized to this shape by a
registered exception handler. Do not return ORM objects directly.

## 9. FastAPI WebSockets

Use FastAPI WebSocket route(s), initially `WS /api/ws`. A connection manager
tracks active clients, accepts connections, removes disconnected clients and
broadcasts JSON event envelopes. Event names preserve the product semantics:

- `telemetry:update`
- `device:status`
- `alert:created`
- `alert:updated`
- `mission:updated`
- `observation:created`
- `camera:status`
- `vision:event`

Envelope shape:

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

Send only validated, accepted events. Handle client disconnects and broadcast
failures without failing ingestion. WebSockets carry metadata/events, not
continuous video frames. On reconnect, the frontend must re-fetch REST
snapshots/history because WebSocket delivery is not durable. Bound per-client
queues or use a latest-value strategy so slow clients cannot cause unbounded
memory growth.

## 10. Mission lifecycle

Create missions with name, optional description and building identifier;
start and stop with timestamps; associate incoming telemetry, alerts,
snapshots and observations with the active mission; prevent multiple active
missions unless explicitly supported. Note that all mission rows disappear
on backend restart because the database is in-memory.

## 11. Uploads, file storage and exports

Blueprint image upload allows PNG/JPEG initially. Validate MIME type and file
signature, enforce size limits, generate server-side UUID filenames and store
under configured `STORAGE_ROOT`. Never accept arbitrary client filesystem
paths. Store relative storage keys in ORM records. Use streaming responses
for large downloads. Export mission telemetry CSV, event/alert CSV and
summary JSON; label simulated data and include units, timestamps and source.

Local files may survive a backend restart, but their metadata rows will not
because SQLite is in-memory. At startup, do not pretend to reconstruct file
metadata unless a deliberate safe reconciliation mechanism is specified.

## 12. Security and operations

Restrict CORS to configured origins. Validate all inputs. Support an optional
device API key header. Bind to localhost by default and document safe LAN
configuration. Keep secrets out of source control. Use structured logs with
timestamp, level and request/event context. Gracefully close WebSocket clients
and dispose the SQLAlchemy engine on shutdown. No cloud/LLM dependency in
core runtime.

## 13. Testing

Use pytest and FastAPI TestClient (including WebSocket test sessions).
Test Pydantic validation, rules, stale detection, mission lifecycle, API
success/error responses, WebSocket event envelopes, in-memory SQLite
cross-request visibility, schema creation and simulator-to-dashboard event
flow. Test duplicate/out-of-order sequence behavior.

## 14. Acceptance criteria

- Server starts from documented Uvicorn command.
- `/api/health` reports app and database status.
- Valid telemetry is validated, inserted into in-memory SQLite and broadcast.
- Invalid telemetry is rejected without corrupting data.
- Stale devices and alerts behave deterministically.
- Mission lifecycle, blueprint metadata, observations and exports work in
  the running process.
- Database rows are explicitly understood to be ephemeral across restart.
- Server continues operating if optional vision/OpenCV/YOLO is unavailable.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
