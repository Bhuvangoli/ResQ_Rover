# ResQ Rover --- Vision and Camera PRD

**Stack:** Python 3, OpenCV; optional YOLO provider in a later
milestone.

## 1. Objective

Provide a camera integration and optional computer-vision service for
snapshots, video recording and basic visual events. The vision service
must be optional: failure or absence must not interrupt sensor
telemetry, backend operation or dashboard use.

## 2. Current camera firmware baseline

The supplied ESP32-CAM firmware currently: - configures an
OV2640-compatible camera using `PIXFORMAT_RGB565`; - captures VGA
frames; - writes captured buffers to SD card as `.rgb565`; - accepts the
UART command `CAPTURE` on UART1 RX GPIO 13 at 115200 baud; - does not
currently expose an HTTP/MJPEG stream; - does not currently transmit
captured image bytes to the backend.

The current firmware therefore cannot be assumed to supply a live
browser video feed. Before implementing the camera client, inspect and
document the actual camera transport. Do not fabricate a stream URL or
claim live streaming works.

## 3. Camera integration phases

### Phase A --- Honest camera status

-   Backend exposes camera status and configured stream URL.
-   Frontend displays connected/unavailable state.
-   No placeholder video is presented as real footage.

### Phase B --- Snapshot transfer

Choose and document one tested transfer method: - ESP32-CAM sends JPEG
snapshot over a supported network endpoint; or - ESP32-CAM transfers
image bytes over a defined serial protocol; or - a gateway retrieves
files from SD card using a defined method.

Do not attempt to send raw RGB565 files to the browser without
conversion and metadata. Prefer JPEG snapshots for network transfer.

### Phase C --- Live stream

Preferred prototype path: camera firmware serves an HTTP MJPEG stream or
another browser-compatible stream. The frontend displays the stream
directly if browser/network policy permits. Do not route continuous
video frames through FastAPI WebSockets.

If MJPEG cannot be implemented reliably on the current board, document
an alternative capture cadence (periodic JPEG snapshots) rather than
pretending it is full-motion video.

### Phase D --- Recording

-   Optional backend/vision-side recording using FFmpeg or OpenCV.
-   Store recordings with mission ID, start/end time and camera/device
    ID.
-   Use configurable resolution, frame rate and retention.
-   Ensure recording stops cleanly and files are finalized.
-   Do not require MP4 generation on the ESP32.

## 4. RGB565 handling

RGB565 is a packed pixel format, not a video container and not an MP4
file. - If RGB565 snapshots must be supported, obtain width/height, byte
order and exact frame length. - Convert to an image using OpenCV or a
tested decoder. - Validate the expected byte count (`width × height × 2`
for 16-bit RGB565). - Confirm channel order and endianness using a test
image. - Prefer changing the camera capture output to JPEG for
transmission if firmware changes are approved. - Never label a raw
`.rgb565` file as `.jpg` or `.mp4`.

## 5. OpenCV features (optional)

Initial useful features: - decode and validate incoming JPEG frames; -
save timestamped snapshots; - optionally record a stream; - basic
frame-difference/motion event detection; - image quality checks
(empty/black frame, decode failure); - publish `vision:event` events to
backend.

Frame-difference detection is only a visual change indicator. It is not
proof of a person, victim or hazard.

## 6. YOLO (optional future enhancement)

YOLO is not required for the first release. If added: - isolate it
behind a `Detector` interface/provider; - make model path, confidence
threshold and inference interval configurable; - do not download model
weights automatically at runtime; - document model license, source,
supported classes and hardware requirements; - run inference on selected
frames, not every frame by default; - emit class, confidence, timestamp,
frame reference and model version; - do not infer unconsciousness,
injury, identity or rescue need from a bounding box; - human detection
must be phrased as "possible person detected" and treated as an
observation requiring operator review; - visual fire/smoke detection
requires a suitable model and validation dataset; do not assume a
generic pretrained model can do it accurately.

## 7. Service interface

A small Python service may expose: - `GET /health` - `POST /frames` for
JPEG frame ingestion if that architecture is chosen - `POST /analyze`
for explicit analysis request - `GET /status`

Alternatively, backend can invoke a local Python process/worker. Choose
one architecture and document it. Do not build two competing interfaces.

Events published through the FastAPI backend event publisher should include:

``` json
{
  "eventId": "generated-id",
  "deviceId": "camera-01",
  "missionId": "mission-id",
  "timestamp": "2026-11-13T16:00:00.000Z",
  "type": "visual_motion",
  "label": "Visual change detected",
  "confidence": null,
  "frameId": "snapshot-id",
  "model": "opencv-frame-difference"
}
```

## 8. Performance and resilience

-   Vision processing must not block the FastAPI request/event loop.
-   Bound frame queue length; drop old frames rather than allowing
    unbounded memory growth.
-   Configurable inference rate and image size.
-   Handle camera disconnect and corrupt frames.
-   Log processing latency and dropped-frame count.
-   If OpenCV/YOLO is unavailable, dashboard and telemetry continue
    normally.

## 9. Acceptance criteria

-   Health/status endpoint works if vision is installed.
-   JPEG snapshots can be validated and saved with metadata.
-   Optional recording can be started/stopped and produces a playable
    file.
-   Invalid frames are rejected safely.
-   Basic motion event is clearly labelled as visual change, not person
    detection.
-   YOLO is disabled by default and can be omitted entirely.
-   Current ESP32-CAM limitations are clearly documented.


## 10. Integration with the approved backend

The core backend is already Python/FastAPI. OpenCV must remain an optional
dependency and must be imported only by the optional vision module. Prefer a
bounded background worker/task for image processing; do not perform expensive
decoding or inference inside a synchronous API request or WebSocket broadcast
loop. The worker submits validated vision-event data to the backend's shared
event/service layer, which persists metadata in the in-memory SQLite database
and publishes the event to connected clients. Do not create a second
competing server unless a later approved deployment decision requires process
isolation.

The backend's default installation must work without `opencv-python`,
Ultralytics, YOLO weights or GPU libraries. Optional extras and setup steps
must be documented separately. OpenCV is optional; YOLO remains optional and
disabled by default.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
