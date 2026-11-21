"""Device status endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.device_service import list_devices

router = APIRouter()


@router.get("/devices")
async def get_devices(db: Session = Depends(get_db)):
    devices = list_devices(db)
    return {
        "data": [
            {
                "id": d.id,
                "deviceId": d.device_id,
                "name": d.name,
                "deviceType": d.device_type,
                "firmwareVersion": d.firmware_version,
                "lastSeenAt": d.last_seen_at.isoformat() if d.last_seen_at else None,
                "status": d.status,
                "createdAt": d.created_at.isoformat(),
            }
            for d in devices
        ]
    }
