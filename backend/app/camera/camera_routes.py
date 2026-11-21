"""
FastAPI camera endpoints.

GET /api/camera/stream  — MJPEG multipart stream; consumed by the React <img>
GET /api/camera/status  — JSON stats for receiver, reassembler and frame store
"""
from __future__ import annotations

import asyncio
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

router = APIRouter(prefix="/api/camera", tags=["Camera"])

# Injected at startup via configure_camera()
_frame_store   = None
_udp_receiver  = None


def configure_camera(frame_store, udp_receiver) -> None:
    global _frame_store, _udp_receiver
    _frame_store   = frame_store
    _udp_receiver  = udp_receiver


# ---------------------------------------------------------------------------
# MJPEG generator
# ---------------------------------------------------------------------------

MJPEG_BOUNDARY = b"frame"
# Target ~30 fps; sleep 33 ms between checks.
# If a new frame hasn't arrived we re-check without sending a duplicate.
POLL_INTERVAL = 0.033


async def _mjpeg_generator(request: Request) -> AsyncGenerator[bytes, None]:
    """
    Yields MJPEG multipart chunks.

    Skips frames whose ID hasn't changed since the last yield so the client
    always receives the latest available frame without duplication.
    Exits cleanly when the client disconnects.
    """
    last_frame_id = None

    while True:
        # Respect client disconnects
        if await request.is_disconnected():
            break

        frame = _frame_store.get_latest() if _frame_store else None

        if frame is not None and frame["frame_id"] != last_frame_id:
            last_frame_id = frame["frame_id"]
            jpeg = frame["jpeg"]
            yield (
                b"--" + MJPEG_BOUNDARY + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n"
                b"\r\n" +
                jpeg +
                b"\r\n"
            )

        await asyncio.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/stream", summary="Live MJPEG camera stream")
async def camera_stream(request: Request):
    """
    MJPEG multipart stream from the ESP32-CAM UDP broadcast receiver.

    Consume with an HTML <img src="/api/camera/stream"> element.
    The stream runs until the client disconnects or the server shuts down.
    Video frames are never routed through the FastAPI request body — only
    the JPEG bytes from the LatestFrameStore are sent here.
    """
    return StreamingResponse(
        _mjpeg_generator(request),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control":    "no-cache, no-store, must-revalidate",
            "Pragma":           "no-cache",
            "X-Accel-Buffering": "no",   # prevents nginx buffering the stream
        },
    )


@router.get("/status", summary="Camera receiver and frame stats")
async def camera_status():
    receiver_stats = _udp_receiver.get_stats()  if _udp_receiver  else {"running": False}
    frame_stats    = _frame_store.get_stats()   if _frame_store    else {"has_frame": False}
    return JSONResponse({
        "data": {
            "receiver": receiver_stats,
            "frames":   frame_stats,
        }
    })
