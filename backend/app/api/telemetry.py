"""Telemetry ingestion, query and WROOM status endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.realtime.connection_manager import manager
from app.schemas.telemetry import TelemetryIngest, TelemetryIngestResponse, TelemetryRecord
from app.services import alert_service, device_service, telemetry_service, mission_service

router = APIRouter()

# Injected at startup via configure_wroom_state()
_wroom_state = None


def configure_wroom_state(state) -> None:
    global _wroom_state
    _wroom_state = state


@router.post("/telemetry", response_model=TelemetryIngestResponse, status_code=201)
async def ingest_telemetry(payload: TelemetryIngest, db: Session = Depends(get_db)):
    # Ensure device exists
    device_service.upsert_device(db, payload.deviceId)

    # Find active mission
    active_mission = mission_service.get_active_mission(db)
    mission_id = active_mission.id if active_mission else None

    record, is_dup = telemetry_service.ingest(db, payload, source_mode="real", mission_id=mission_id)

    # Evaluate alert rules
    telem_dict = {
        "temperature_c": record.temperature_c,
        "mq2_raw": record.mq2_raw,
        "distance_cm": record.distance_cm,
        "motion_detected": record.motion_detected,
        "battery_percent": record.battery_percent,
    }
    new_alerts = alert_service.evaluate_and_store(db, telem_dict, mission_id, payload.deviceId)
    alert_service.auto_resolve_alerts(db, payload.deviceId, telem_dict)

    # Broadcast telemetry via WebSocket
    await manager.broadcast("telemetry:update", {
        "recordId": record.id,
        "deviceId": record.device_id,
        "deviceTimestamp": record.device_timestamp.isoformat() if record.device_timestamp else None,
        "receivedAt": record.received_at.isoformat(),
        "temperatureC": record.temperature_c,
        "mq2Raw": record.mq2_raw,
        "distanceCm": record.distance_cm,
        "motionDetected": record.motion_detected,
        "batteryPercent": record.battery_percent,
        "rssiDbm": record.rssi_dbm,
        "sourceMode": "real",
        "isDuplicate": is_dup,
    })

    for alert in new_alerts:
        await manager.broadcast("alert:created", {
            "id": alert.id,
            "ruleId": alert.rule_id,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "deviceId": alert.device_id,
            "missionId": alert.mission_id,
            "status": alert.status,
            "createdAt": alert.created_at.isoformat(),
        })

    from datetime import timezone
    return TelemetryIngestResponse(
        accepted=True,
        recordId=record.id,
        serverTime=record.received_at,
        timestampSource=record.timestamp_source,
        isDuplicate=is_dup,
    )


@router.get("/telemetry/latest")
async def get_latest(
    deviceId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    rows = telemetry_service.get_latest(db, device_id=deviceId)
    return {"data": [_row_to_dict(r) for r in rows]}


@router.get("/telemetry/history")
async def get_history(
    deviceId: Optional[str] = Query(None),
    missionId: Optional[str] = Query(None),
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    rows = telemetry_service.get_history(
        db,
        device_id=deviceId,
        mission_id=missionId,
        from_dt=from_,
        to_dt=to,
        limit=limit,
    )
    return {"data": [_row_to_dict(r) for r in rows]}


def _row_to_dict(r) -> dict:
    return {
        "id": r.id,
        "deviceId": r.device_id,
        "missionId": r.mission_id,
        "deviceTimestamp": r.device_timestamp.isoformat() if r.device_timestamp else None,
        "receivedAt": r.received_at.isoformat(),
        "timestampSource": r.timestamp_source,
        "sequence": r.sequence,
        "temperatureC": r.temperature_c,
        "mq2Raw": r.mq2_raw,
        "distanceCm": r.distance_cm,
        "motionDetected": r.motion_detected,
        "batteryPercent": r.battery_percent,
        "batteryVoltage": r.battery_voltage,
        "rssiDbm": r.rssi_dbm,
        "sourceMode": r.source_mode,
        "isDuplicate": r.is_duplicate,
    }


@router.get("/telemetry/status")
async def wroom_status():
    """
    Diagnostic endpoint for WROOM UDP telemetry.

    Reports whether packets are being received and their freshness.
    'last_sender' is the ESP32's source IP — for diagnostics only,
    not a hardcoded address requirement.
    """
    if _wroom_state is None:
        return JSONResponse({"data": {"enabled": False}})
    status = _wroom_state.get_status()
    latest = _wroom_state.get_latest()
    return JSONResponse({
        "data": {
            "enabled":                 True,
            "freshness":               status["freshness"],
            "has_data":                status["has_data"],
            "last_received_at":        status["last_received_at"],
            "last_packet_age_seconds": status["last_packet_age_seconds"],
            "packets_received":        status["packets_received"],
            "invalid_packets":         status["invalid_packets"],
            "last_sender":             status["last_sender"],
            "latest":                  latest,
        }
    })
