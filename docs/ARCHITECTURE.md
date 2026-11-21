# ResQ Rover — Architecture

## System Overview

```text
Physical Rover / Simulator
          |
          v (HTTP POST /api/telemetry)
Hardware Adapter  <-- or --> USB Serial Adapter
          |
          v
Pydantic Validation (TelemetryIngest schema)
          |
          v
Backend Services (telemetry_service, alert_service, mission_service)
          |
          +----> SQLAlchemy 2.x / in-memory SQLite (ephemeral)
          |
          v
WebSocket Event Manager (ConnectionManager.broadcast)
          |
          v
React Dashboard (live updates via ws://localhost:5173/api/ws)
```

## Component Responsibilities

### Frontend (`ResQ_Rover/frontend/`)
- React 18 + Vite 5
- Tailwind CSS v3 for styling
- Recharts for charts
- Native browser WebSocket API (no Socket.IO)
- Pages: Overview, Live Monitoring, Camera, Building Map, Alerts, Missions, Settings
- Hooks: `useDashboard` (REST snapshot + WS events), `useWebSocket`
- Services: `api.js` (REST), `websocket.js` (WS client)

### Backend (`ResQ_Rover/backend/`)
- Python 3.13 + FastAPI 0.115
- Pydantic 2.x for request/response validation
- SQLAlchemy 2.x with in-memory SQLite (StaticPool, shared connection)
- FastAPI WebSockets for real-time event delivery

#### Module Structure
```
app/
├── main.py          FastAPI app factory, lifespan, router registration
├── api/             FastAPI route handlers
│   ├── health.py    GET /api/health
│   ├── dashboard.py GET /api/dashboard
│   ├── devices.py   GET /api/devices
│   ├── telemetry.py POST+GET /api/telemetry
│   ├── alerts.py    GET /api/alerts, POST /api/alerts/{id}/acknowledge
│   ├── missions.py  CRUD + lifecycle + export
│   ├── blueprints.py Blueprint upload and listing
│   ├── observations.py Observation CRUD
│   └── websocket.py WS /api/ws
├── core/            Settings, logging, error types
├── db/              Engine, session, Base, init_db
├── models/          SQLAlchemy ORM models
├── schemas/         Pydantic request/response schemas
├── services/        Business logic (device, telemetry, alert, mission, etc.)
├── realtime/        ConnectionManager (WebSocket broadcast)
├── simulator/       Hardware simulator (simulation mode only)
└── adapters/        Hardware transport adapters (reserved for real hardware)
```

## Database

- In-memory SQLite (`sqlite+pysqlite:///:memory:`)
- StaticPool with `check_same_thread=False` for shared cross-request access
- Foreign keys enabled via PRAGMA
- Schema created at startup via `Base.metadata.create_all(engine)`
- **All rows are lost on restart** — this is intentional for the prototype

## Real-time Communication

- WebSocket route: `WS /api/ws`
- Event envelope: `{ "event": "...", "timestamp": "...", "data": {...} }`
- Events: `telemetry:update`, `device:status`, `alert:created`, `alert:updated`,
  `mission:updated`, `observation:created`, `camera:status`, `vision:event`
- Frontend reconnects with exponential backoff (1s → 30s max)
- On reconnect, frontend fetches REST snapshot to fill gaps

## Hardware Mode

- `HARDWARE_MODE=simulation`: Simulator runs, generates labeled SIMULATED data
- `HARDWARE_MODE=real`: Simulator disabled; real hardware POSTs to `/api/telemetry`
- Both modes use identical backend service and WebSocket pipeline

## File Storage

- Base path: `ResQ_Rover/storage/`
- Subdirectories: `blueprints/`, `images/snapshots/`, `recordings/`, `exports/`, `logs/`
- Files survive restart; SQLite metadata does not (orphan risk noted in docs)
- UUID-based server-side filenames, no client-controlled paths
