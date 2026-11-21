"""Dashboard snapshot endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.database import get_db
from app.services.alert_service import list_alerts
from app.services.device_service import list_devices
from app.services.mission_service import get_active_mission, list_missions
from app.services.telemetry_service import get_latest

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(db: Session = Depends(get_db)):
    devices = list_devices(db)
    latest_telemetry = get_latest(db)
    active_alerts = list_alerts(db, status="active")
    active_mission = get_active_mission(db)
    recent_missions = list_missions(db)[:5]

    return {
        "data": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hardwareMode": settings.HARDWARE_MODE,
            "cameraStreamUrl": settings.CAMERA_STREAM_URL or None,
            "cameraStatus": "unavailable" if not settings.CAMERA_STREAM_URL else "configured",
            "devices": [
                {
                    "id": d.id,
                    "deviceId": d.device_id,
                    "name": d.name,
                    "status": d.status,
                    "lastSeenAt": d.last_seen_at.isoformat() if d.last_seen_at else None,
                }
                for d in devices
            ],
            "latestTelemetry": [
                {
                    "id": r.id,
                    "deviceId": r.device_id,
                    "receivedAt": r.received_at.isoformat(),
                    "temperatureC": r.temperature_c,
                    "mq2Raw": r.mq2_raw,
                    "distanceCm": r.distance_cm,
                    "motionDetected": r.motion_detected,
                    "batteryPercent": r.battery_percent,
                    "rssiDbm": r.rssi_dbm,
                    "sourceMode": r.source_mode,
                }
                for r in latest_telemetry
            ],
            "activeAlerts": len(active_alerts),
            "activeMission": {
                "id": active_mission.id,
                "name": active_mission.name,
                "status": active_mission.status,
                "startedAt": active_mission.started_at.isoformat() if active_mission.started_at else None,
            } if active_mission else None,
            "recentMissions": [
                {
                    "id": m.id,
                    "name": m.name,
                    "status": m.status,
                    "createdAt": m.created_at.isoformat(),
                }
                for m in recent_missions
            ],
        }
    }
