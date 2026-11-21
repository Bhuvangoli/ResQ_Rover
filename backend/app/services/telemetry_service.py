"""Telemetry ingestion, storage and retrieval service."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry
from app.models.device import Device
from app.schemas.telemetry import TelemetryIngest


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _detect_duplicate(db: Session, device_id: str, sequence: Optional[int]) -> bool:
    """Return True if a record with same device_id+sequence already exists."""
    if sequence is None:
        return False
    existing = db.execute(
        select(Telemetry).where(
            Telemetry.device_id == device_id,
            Telemetry.sequence == sequence,
        )
    ).scalar_one_or_none()
    return existing is not None


def ingest(
    db: Session,
    payload: TelemetryIngest,
    source_mode: str,
    mission_id: Optional[str],
) -> Tuple[Telemetry, bool]:
    """
    Validate, store and return a Telemetry record.
    Returns (record, is_new_duplicate).
    Duplicates are accepted but flagged.
    """
    received_at = _now()
    is_duplicate = _detect_duplicate(db, payload.deviceId, payload.sequence)

    if payload.timestamp is not None:
        device_ts = payload.timestamp
        ts_source = "device"
    else:
        device_ts = None
        ts_source = "server_received"

    record = Telemetry(
        device_id=payload.deviceId,
        mission_id=mission_id,
        device_timestamp=device_ts,
        received_at=received_at,
        timestamp_source=ts_source,
        sequence=payload.sequence,
        temperature_c=payload.temperatureC,
        mq2_raw=payload.mq2Raw,
        distance_cm=payload.distanceCm,
        motion_detected=payload.motionDetected,
        battery_percent=payload.batteryPercent,
        battery_voltage=payload.batteryVoltage,
        rssi_dbm=payload.rssiDbm,
        sensor_status_json=json.dumps(payload.sensorStatus) if payload.sensorStatus else None,
        raw_payload_json=payload.model_dump_json(),
        source_mode=source_mode,
        is_duplicate=is_duplicate,
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record, is_duplicate


def get_latest(db: Session, device_id: Optional[str] = None) -> List[Telemetry]:
    """Return the most recent telemetry record per device."""
    if device_id:
        rows = db.execute(
            select(Telemetry)
            .where(Telemetry.device_id == device_id)
            .order_by(Telemetry.received_at.desc())
            .limit(1)
        ).scalars().all()
    else:
        # Latest record per device via subquery strategy
        from sqlalchemy import func

        sub = (
            select(Telemetry.device_id, func.max(Telemetry.received_at).label("max_ts"))
            .group_by(Telemetry.device_id)
            .subquery()
        )
        rows = db.execute(
            select(Telemetry).join(
                sub,
                (Telemetry.device_id == sub.c.device_id)
                & (Telemetry.received_at == sub.c.max_ts),
            )
        ).scalars().all()

    return list(rows)


def get_history(
    db: Session,
    device_id: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    limit: int = 200,
    mission_id: Optional[str] = None,
) -> List[Telemetry]:
    q = select(Telemetry).order_by(Telemetry.received_at.desc()).limit(limit)

    if device_id:
        q = q.where(Telemetry.device_id == device_id)
    if from_dt:
        q = q.where(Telemetry.received_at >= from_dt)
    if to_dt:
        q = q.where(Telemetry.received_at <= to_dt)
    if mission_id:
        q = q.where(Telemetry.mission_id == mission_id)

    return list(db.execute(q).scalars().all())
