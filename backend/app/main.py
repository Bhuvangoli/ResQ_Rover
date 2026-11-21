"""
ResQ Rover FastAPI Application
-------------------------------
Startup, lifespan, CORS configuration and router registration.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.errors import AppError, app_error_handler, generic_error_handler, _error_body
from app.core.logging_config import configure_logging, logger
from app.core.settings import settings
from app.db.database import init_db

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
from app.api import (
    health,
    dashboard,
    devices,
    telemetry,
    alerts,
    missions,
    blueprints,
    observations,
)
from app.api.websocket import router as ws_router

# Camera UDP receiver
from app.camera.frame_store import LatestFrameStore
from app.camera.udp_receiver import CameraUDPReceiver
from app.camera.camera_routes import router as camera_router, configure_camera

_camera_frame_store  = LatestFrameStore()
_camera_udp_receiver = CameraUDPReceiver(_camera_frame_store, port=settings.CAMERA_UDP_PORT)

# WROOM telemetry UDP receiver
from app.wroom.wroom_state import WroomState
from app.wroom.wroom_receiver import WroomUDPReceiver
from app.api.telemetry import configure_wroom_state

_wroom_state    = WroomState()
_wroom_receiver = WroomUDPReceiver(_wroom_state, port=settings.WROOM_UDP_PORT)


# ---------------------------------------------------------------------------
# Application lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("ResQ Rover backend starting up.")

    # Ensure storage subdirectories exist
    for sub in ("blueprints", "images/snapshots", "recordings", "exports", "logs"):
        (settings.storage_path / sub).mkdir(parents=True, exist_ok=True)

    # Initialize in-memory SQLite schema
    init_db()
    logger.info("In-memory SQLite schema initialized.")
    logger.info("NOTE: All database rows are EPHEMERAL — lost on backend restart.")

    # Start simulator if enabled
    simulator_task = None
    if settings.HARDWARE_MODE == "simulation":
        from app.simulator.simulator import run_simulator
        simulator_task = asyncio.create_task(run_simulator())
        logger.info("Hardware simulator started.")
    else:
        logger.info("Hardware mode is '%s'; simulator not started.", settings.HARDWARE_MODE)

    # Start camera UDP receiver
    if settings.CAMERA_UDP_ENABLED:
        configure_camera(_camera_frame_store, _camera_udp_receiver)
        _camera_udp_receiver.start()
        logger.info("[SYSTEM] Camera UDP receiver started on port %d.", settings.CAMERA_UDP_PORT)
    else:
        configure_camera(_camera_frame_store, _camera_udp_receiver)
        logger.info("[SYSTEM] Camera UDP receiver disabled (CAMERA_UDP_ENABLED=False).")

    # Start WROOM telemetry UDP receiver
    configure_wroom_state(_wroom_state)
    if settings.WROOM_UDP_ENABLED:
        _event_loop = asyncio.get_event_loop()

        async def _broadcast_wroom(packet: dict, sender_ip: str) -> None:
            await manager.broadcast("wroom:update", {
                "device":        packet.get("device"),
                "wifiConnected": packet.get("wifiConnected"),
                "rssiDbm":       packet.get("rssiDbm"),
                "motorsRunning": packet.get("motorsRunning"),
                "mode":          packet.get("mode"),
                "distanceCm":    packet.get("distanceCm"),
                "pirMotion":     packet.get("pirMotion"),
                "gasRaw":        packet.get("gasRaw"),
                "gasVoltage":    packet.get("gasVoltage"),
                "sensorReadings": packet.get("sensorReadings"),
                "freshness":     _wroom_state.get_freshness(),
                "senderIp":      sender_ip,
            })

        _wroom_receiver._on_valid_packet = _broadcast_wroom
        _wroom_receiver.start(loop=_event_loop)
        logger.info("[SYSTEM] WROOM UDP receiver started on port %d.", settings.WROOM_UDP_PORT)
    else:
        logger.info("[SYSTEM] WROOM UDP receiver disabled (WROOM_UDP_ENABLED=False).")

    yield

    # Shutdown
    if simulator_task:
        from app.simulator.simulator import stop_simulator
        stop_simulator()
        simulator_task.cancel()
        try:
            await simulator_task
        except asyncio.CancelledError:
            pass

    # Stop camera UDP receiver
    if settings.CAMERA_UDP_ENABLED:
        _camera_udp_receiver.stop()
        logger.info("[SYSTEM] Camera UDP receiver stopped.")

    # Stop WROOM UDP receiver
    if settings.WROOM_UDP_ENABLED:
        _wroom_receiver.stop()
        logger.info("[SYSTEM] WROOM UDP receiver stopped.")

    logger.info("ResQ Rover backend shut down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ResQ Rover API",
    description=(
        "Local backend for the ResQ Rover reconnaissance rover dashboard. "
        "Provides telemetry ingestion, real-time WebSocket events, mission management, "
        "alert evaluation and building blueprint support.\n\n"
        "**Note:** Database is in-memory SQLite. All rows are lost on restart."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, generic_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Serialize errors safely — Pydantic v2 errors may contain non-JSON types
    import json as _json
    try:
        safe_details = _json.loads(_json.dumps(exc.errors(), default=str))
    except Exception:
        safe_details = str(exc.errors())
    return JSONResponse(
        status_code=422,
        content=_error_body(
            "VALIDATION_ERROR",
            "Request validation failed.",
            details=safe_details,
        ),
    )


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------
API_PREFIX = "/api"

app.include_router(health.router, prefix=API_PREFIX, tags=["Health"])
app.include_router(dashboard.router, prefix=API_PREFIX, tags=["Dashboard"])
app.include_router(devices.router, prefix=API_PREFIX, tags=["Devices"])
app.include_router(telemetry.router, prefix=API_PREFIX, tags=["Telemetry"])
app.include_router(alerts.router, prefix=API_PREFIX, tags=["Alerts"])
app.include_router(missions.router, prefix=API_PREFIX, tags=["Missions"])
app.include_router(blueprints.router, prefix=API_PREFIX, tags=["Blueprints"])
app.include_router(observations.router, prefix=API_PREFIX, tags=["Observations"])
app.include_router(ws_router, prefix=API_PREFIX, tags=["WebSocket"])
app.include_router(camera_router, tags=["Camera"])   # already has /api/camera prefix
