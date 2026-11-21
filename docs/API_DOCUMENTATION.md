# ResQ Rover — API Documentation

Full interactive documentation is available at `http://127.0.0.1:8000/docs` (Swagger UI).
OpenAPI JSON schema: `http://127.0.0.1:8000/openapi.json`

## Base URL

`http://127.0.0.1:8000`

## REST Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | App and database health check |
| GET | `/api/dashboard` | Full dashboard snapshot |
| GET | `/api/devices` | Device status list |
| GET | `/api/telemetry/latest` | Latest reading per device |
| GET | `/api/telemetry/history` | Paginated telemetry history |
| POST | `/api/telemetry` | Ingest a telemetry reading |
| GET | `/api/alerts` | List alerts (filterable by status) |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/api/missions` | List all missions |
| POST | `/api/missions` | Create a mission |
| GET | `/api/missions/{id}` | Mission detail |
| POST | `/api/missions/{id}/start` | Start a mission |
| POST | `/api/missions/{id}/stop` | Stop/complete a mission |
| GET | `/api/missions/{id}/export` | Export mission data (CSV or JSON) |
| POST | `/api/blueprints` | Upload a floor plan image |
| GET | `/api/blueprints` | List uploaded blueprints |
| POST | `/api/observations` | Create an observation/marker |
| GET | `/api/observations` | List observations |

## WebSocket

`ws://127.0.0.1:8000/api/ws`

Events emitted by server:
- `telemetry:update`
- `device:status`
- `alert:created`
- `alert:updated`
- `mission:updated`
- `observation:created`
- `camera:status`
- `vision:event`

## Response Envelopes

Success: `{ "data": ... }`

Error: `{ "error": { "code": "...", "message": "...", "details": ... } }`

## Standard Query Parameters

- `deviceId` — filter by device
- `missionId` — filter by mission
- `from` / `to` — ISO-8601 datetime range
- `limit` — record count (default 200, max 1000)
- `status` — filter alerts by status (active|acknowledged|resolved)
- `format` — export format (csv|json)
