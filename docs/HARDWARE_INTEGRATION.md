# Hardware Integration Contract

**ResQ Rover — Hardware Adapter Interface**

This document defines the expected data contracts, communication protocols,
and integration points for connecting physical rover hardware to the ResQ Rover backend.

> ⚠ The physical hardware is under development separately. This document defines
> the interface so the software and firmware teams can work independently.

---

## 1. Current Hardware State

Based on the PlatformIO firmware in `TBP_Project/`:

| Component | Status | Notes |
|---|---|---|
| ESP32-CAM | Present | OV2640, RGB565, VGA, SD card write |
| Camera HTTP stream | **Not implemented** | No MJPEG server in current firmware |
| Sensor telemetry | **Not implemented** | No HTTP client or serial JSON in current firmware |
| Motor control | **Not implemented** | No motor driver or command protocol |
| Wi-Fi stack | Unknown | Not confirmed in current firmware |
| Serial JSON | Unknown | UART1 RX GPIO 13 listens for `CAPTURE` command only |

---

## 2. Telemetry Data Contract

Rover hardware must POST JSON to `POST /api/telemetry` using this schema:

```json
{
  "deviceId": "rover-01",
  "timestamp": "2026-11-13T16:00:00.000Z",
  "sequence": 1042,
  "temperatureC": 42.5,
  "mq2Raw": 1850,
  "distanceCm": 120.0,
  "motionDetected": true,
  "batteryPercent": 78.0,
  "batteryVoltage": 3.85,
  "rssiDbm": -62.0,
  "sensorStatus": {
    "temperature": "ok",
    "mq2": "ok",
    "distance": "ok",
    "pir": "ok"
  }
}
```

### Field Specifications

| Field | Type | Required | Notes |
|---|---|---|---|
| `deviceId` | string | **Yes** | Non-empty device identifier |
| `timestamp` | ISO-8601 UTC | No | If absent, server uses receipt time |
| `sequence` | integer ≥ 0 | No | Monotonically increasing; enables duplicate detection |
| `temperatureC` | float | No | Degrees Celsius |
| `mq2Raw` | integer ≥ 0 | No | Raw ADC value — **not ppm** — no calibration applied |
| `distanceCm` | float ≥ 0 | No | Ultrasonic distance in centimeters |
| `motionDetected` | boolean | No | PIR sensor state — **not human detection** |
| `batteryPercent` | float 0–100 | No | Battery level |
| `batteryVoltage` | float ≥ 0 | No | Battery voltage |
| `rssiDbm` | float | No | Signal strength in dBm |
| `sensorStatus` | object | No | Per-sensor health indicators |

Omit any field if the hardware cannot provide it. Never fabricate missing values.

### Response

```json
{
  "accepted": true,
  "recordId": "uuid-string",
  "serverTime": "2026-11-13T16:00:00.000Z",
  "timestampSource": "device",
  "isDuplicate": false
}
```

---

## 3. Command Output (Rover ← Dashboard)

> **Commands are disabled in the current prototype** until the following prerequisites are met:
> - Exact motor controller and wiring confirmed
> - Command acknowledgement protocol defined
> - Communication-loss emergency-stop behavior tested
> - Fail-safe (stop on disconnect) verified

Future command schema (not yet implemented):

```json
{
  "commandId": "uuid",
  "deviceId": "rover-01",
  "command": "move_forward",
  "parameters": { "speedPercent": 50, "durationMs": 2000 },
  "issuedAt": "2026-11-13T16:00:00.000Z",
  "expiresAt": "2026-11-13T16:00:05.000Z"
}
```

---

## 4. WebSocket Events (Backend → Dashboard)

| Event | Trigger | Payload Key |
|---|---|---|
| `telemetry:update` | New telemetry record accepted | `recordId`, `deviceId`, sensor fields, `sourceMode` |
| `device:status` | Device state change | `deviceId`, `status`, `lastSeenAt` |
| `alert:created` | New alert triggered | Alert object |
| `alert:updated` | Alert acknowledged or resolved | `id`, `status`, updates |
| `mission:updated` | Mission lifecycle change | Mission object |
| `observation:created` | New observation saved | Observation object |
| `camera:status` | Camera state change | `status`, `streamUrl` |
| `vision:event` | Vision processing result | Vision event object |

All events use this envelope:

```json
{
  "event": "telemetry:update",
  "timestamp": "2026-11-13T16:00:00.000Z",
  "data": { ... }
}
```

---

## 5. Transport Options

### Option A: HTTP POST (Preferred for first integration)

The rover or a gateway posts to `POST /api/telemetry` using the JSON schema above.

- Simple, stateless, works with any HTTP client
- Backend URL: `http://<host>:8000/api/telemetry`
- No authentication required by default; optional `X-Device-Key` header if `DEVICE_API_KEY` is set

### Option B: USB Serial (Alternative)

If Wi-Fi is unavailable, a Python serial adapter can relay data from USB.

Requirements:
- Line-delimited UTF-8 JSON (one object per line, terminated with `\n`)
- Baud rate: 115200 (match firmware `HardwareSerial` config)
- Parser must handle partial lines and reconnect on disconnect
- Must reject malformed JSON and log errors

The serial adapter feeds data through the same `TelemetryIngest` service as HTTP.

**Note:** Implement only after confirming the actual COM port and baud rate.

---

## 6. Camera Integration

See `VISION_PRD.md` for full camera integration plan.

Short summary:
1. Confirm firmware can expose MJPEG stream or transmit JPEG snapshots
2. Implement backend endpoint or proxy as needed
3. Update `CAMERA_STREAM_URL` in backend `.env`
4. Frontend Camera page will display the stream automatically

**Do not implement camera client until the firmware endpoint is confirmed.**

---

## 7. Hardware Adapter Interface

The backend's `app/adapters/` directory is reserved for hardware transport adapters.

Each adapter must:
1. Parse incoming data (HTTP or serial)
2. Create a `TelemetryIngest` schema object
3. Call `telemetry_service.ingest()` — the same path the simulator uses
4. Never duplicate validation or broadcasting logic

The adapter interface:

```python
class HardwareAdapter(Protocol):
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
```

---

## 8. Hardware Mode Switching

```env
# Simulation mode (no hardware needed)
HARDWARE_MODE=simulation

# Real hardware mode (simulator disabled)
HARDWARE_MODE=real
```

In `real` mode, the simulator does not run. The dashboard will correctly show
offline/stale state when no hardware is sending data.

---

## 9. How to Test Hardware Integration

1. Set `HARDWARE_MODE=real` in backend `.env`
2. Start the backend: `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. POST a test telemetry payload to `http://127.0.0.1:8000/api/telemetry`
4. Verify the response `accepted: true` and check the dashboard updates
5. Connect the actual rover and confirm data flows end-to-end
6. Verify alerts fire for threshold violations

---

## 10. Known Limitations (Prototype)

- Database is in-memory SQLite; all data is lost on restart
- No command protocol implemented yet
- Camera stream not available yet
- No authentication on most endpoints (suitable for local LAN only)
- Serial adapter not yet implemented (requires confirmed port/baud)
