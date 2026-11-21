# ResQ Rover --- Hardware Integration and Communication PRD

## 1. Objective

Define a stable, testable interface between existing ESP32 firmware, any
sensor/motor controller or gateway, camera hardware, Python/FastAPI backend and
dashboard.

## 2. Existing firmware facts

The supplied PlatformIO configuration: - Platform: `espressif32` -
Board: `esp32cam` - Framework: Arduino - Monitor speed: 115200 baud

The supplied `src/main.cpp`: - initializes the ESP32-CAM camera; - uses
`PIXFORMAT_RGB565`, VGA; - mounts SD_MMC in 1-bit mode; - listens on
`HardwareSerial(1)` with RX GPIO 13 and no TX pin; - waits for
newline-terminated `CAPTURE`; - saves a captured frame to SD as
`/IMG_####.rgb565`.

The current code does not include: - sensor telemetry packet
generation; - HTTP API client; - Wi-Fi telemetry transport; - MJPEG
stream server; - snapshot transfer to FastAPI backend; - motor control; - a
documented acknowledgement protocol.

Do not assume these features exist.

## 3. Hardware separation

The ESP32-CAM has limited GPIO availability and camera/SD pin
assignments occupy many pins. Do not assign sensors, motor driver or
UART pins without checking the exact board and wiring. If a separate
ESP32 DevKit or gateway is used, document its responsibilities and
wiring.

Potential split: - ESP32-CAM: camera capture/stream/snapshot. - Separate
ESP32 DevKit: sensors, motors and telemetry. - Gateway/laptop/Raspberry
Pi: protocol bridge and backend host.

This is a proposed architecture, not an assertion about the user's
current assembled hardware. Confirm actual controllers before
implementing pin-level firmware changes.

## 4. Telemetry transport

Preferred first integration for local development: - ESP32/gateway sends
JSON telemetry over HTTP POST to `POST /api/telemetry`, or - gateway
sends newline-delimited JSON over USB serial to a backend serial
adapter.

Choose one transport for the first hardware milestone. Do not implement
multiple transports simultaneously unless required.

Example normalized packet:

``` json
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

If the hardware cannot provide a field, omit it or send null. Never
fabricate it.

## 5. Serial protocol requirements

If USB serial is selected: - line-delimited UTF-8 JSON; - one complete
JSON object per line; - newline terminator; - explicit baud rate from
configuration; - parser handles partial lines and reconnects; - maximum
line length; - reject malformed JSON and log parse errors; - include
`deviceId`, `timestamp` or a documented backend timestamp fallback, and
`sequence` where possible.

If camera UART is used, the current one-way RX arrangement is
insufficient for a reliable bidirectional command/acknowledgement
protocol. Any firmware change must define both directions, framing,
timeout and acknowledgement. Do not share UART pins with other functions
without validating the board pin map.

## 6. Camera integration contract

The camera must use one of the explicitly tested methods: 1. HTTP
MJPEG/JPEG stream from ESP32-CAM; 2. periodic JPEG snapshots sent to
backend; 3. serial transfer with a documented binary framing protocol;
4. gateway-mediated SD card retrieval.

For browser live viewing, prefer a camera-hosted MJPEG stream or a
dedicated video proxy. FastAPI WebSockets are for metadata/events, not continuous
video frames.

The current `.rgb565` SD files need width, height, byte order and frame
length metadata to decode. Prefer JPEG for snapshots and browser
display. MP4 recording, if required, should be performed by a host-side
process.

## 7. Commands and safety

Do not enable movement commands from dashboard until: - exact motor
controller and wiring are confirmed; - command schema is documented; -
command acknowledgement and timeout are implemented; -
communication-loss behavior is defined; - emergency stop is tested; -
motor outputs default to stopped on boot/reset/loss of control link.

Any movement command must include command ID, target device, issue time
and expiry/timeout. Backend must not report command success until a
device acknowledgement is received.

For first software milestones, use read-only monitoring and a simulator.
Keep motor controls hidden or disabled.

## 8. Communication status

Track where available: - transport type; - connected/disconnected; -
last packet time; - RSSI/link quality; - packet sequence gaps; -
reconnect count; - gateway status.

Do not claim LoRa, ESP-NOW, Wi-Fi or Bluetooth will reliably penetrate
concrete, steel or fire-affected structures. Measure performance in the
intended environment. LoRa is suitable for low-bandwidth
telemetry/alerts, not live video.

## 9. Acceptance criteria

-   A simulator can post telemetry using the same schema as hardware.
-   Backend validates and displays telemetry.
-   Hardware transport is documented and tested end-to-end.
-   Missing fields remain missing, not fabricated.
-   Camera status is accurate and does not imply an existing stream.
-   Control commands remain disabled until acknowledgement and fail-safe
    tests pass.


## 10. FastAPI backend compatibility

The server-side integration target is Python 3 + FastAPI. Hardware HTTP
telemetry is submitted to `POST /api/telemetry` using the normalized JSON
contract above. FastAPI validates the payload with Pydantic, records receipt
time, stores accepted telemetry through SQLAlchemy 2.x in the in-memory
SQLite database, and publishes a `telemetry:update` event over FastAPI
WebSockets only after successful ingestion.

If USB serial is selected, implement a Python adapter using a serial library
only after the actual port, baud rate, framing and hardware are confirmed.
The adapter must run as a managed background task/thread and pass parsed
messages through the same telemetry service used by the HTTP route. Do not
duplicate validation or business logic. Serial library choice and exact
device path are deployment details, not assumed hardware facts.

The browser receives updates from the FastAPI WebSocket endpoint (initial
contract: `WS /api/ws`) using JSON event envelopes. REST remains the source
for initial state and history. WebSockets are not a durable queue; clients
must refresh REST state after reconnecting. Continuous camera frames must
use a separately tested camera transport, never the telemetry WebSocket.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
