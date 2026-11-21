"""Device status tracking and stale-detection service."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.device import Device


def _now() -> datetime:
    return datetime.now(timezone.utc)


def upsert_device(db: Session, device_id: str) -> Device:
    """Create or update device record, marking it online."""
    device = db.execute(
        select(Device).where(Device.device_id == device_id)
    ).scalar_one_or_none()

    if device is None:
        device = Device(device_id=device_id, name=device_id, status="online")
        db.add(device)
    else:
        device.status = "online"

    device.last_seen_at = _now()
    db.commit()
    db.refresh(device)
    return device


def list_devices(db: Session) -> List[Device]:
    """Return all known devices, applying stale detection."""
    devices = db.execute(select(Device)).scalars().all()
    threshold = timedelta(milliseconds=settings.TELEMETRY_STALE_AFTER_MS)
    now = _now()

    for device in devices:
        if device.last_seen_at:
            age = now - device.last_seen_at.replace(tzinfo=timezone.utc) if device.last_seen_at.tzinfo is None else now - device.last_seen_at
            if age > threshold:
                device.status = "stale"

    return list(devices)


def get_device(db: Session, device_id: str) -> Optional[Device]:
    return db.execute(
        select(Device).where(Device.device_id == device_id)
    ).scalar_one_or_none()
