"""Export mission data as CSV or JSON."""
from __future__ import annotations

import csv
import io
import json
from datetime import timezone
from typing import List

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.mission import Mission
from app.models.telemetry import Telemetry
from app.services.mission_service import get_mission
from app.services.telemetry_service import get_history


def _fmt(dt) -> str:
    if dt is None:
        return ""
    if hasattr(dt, "tzinfo") and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def export_mission_csv(db: Session, mission_id: str) -> str:
    """Return CSV text of all telemetry for a mission."""
    mission = get_mission(db, mission_id)
    rows = get_history(db, mission_id=mission_id, limit=10000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "recordId", "deviceId", "missionId", "deviceTimestamp", "receivedAt",
        "timestampSource", "sequence", "temperatureC", "mq2Raw", "distanceCm",
        "motionDetected", "batteryPercent", "batteryVoltage", "rssiDbm",
        "sourceMode", "isDuplicate",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.device_id, r.mission_id, _fmt(r.device_timestamp),
            _fmt(r.received_at), r.timestamp_source, r.sequence,
            r.temperature_c, r.mq2_raw, r.distance_cm, r.motion_detected,
            r.battery_percent, r.battery_voltage, r.rssi_dbm,
            r.source_mode, r.is_duplicate,
        ])
    return buf.getvalue()


def export_mission_json(db: Session, mission_id: str) -> dict:
    """Return summary JSON for a mission."""
    mission = get_mission(db, mission_id)
    rows = get_history(db, mission_id=mission_id, limit=10000)

    from sqlalchemy import select
    alerts = db.execute(
        select(Alert).where(Alert.mission_id == mission_id)
    ).scalars().all()

    return {
        "mission": {
            "id": mission.id,
            "name": mission.name,
            "status": mission.status,
            "startedAt": _fmt(mission.started_at),
            "endedAt": _fmt(mission.ended_at),
            "createdAt": _fmt(mission.created_at),
        },
        "telemetryCount": len(rows),
        "telemetry": [
            {
                "id": r.id,
                "deviceId": r.device_id,
                "deviceTimestamp": _fmt(r.device_timestamp),
                "receivedAt": _fmt(r.received_at),
                "temperatureC": r.temperature_c,
                "mq2Raw": r.mq2_raw,
                "distanceCm": r.distance_cm,
                "motionDetected": r.motion_detected,
                "batteryPercent": r.battery_percent,
                "sourceMode": r.source_mode,
            }
            for r in rows
        ],
        "alerts": [
            {
                "id": a.id,
                "ruleId": a.rule_id,
                "severity": a.severity,
                "title": a.title,
                "status": a.status,
                "createdAt": _fmt(a.created_at),
            }
            for a in alerts
        ],
    }
