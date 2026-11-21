from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DeviceStatus(BaseModel):
    id: str
    deviceId: str
    name: Optional[str] = None
    deviceType: Optional[str] = None
    firmwareVersion: Optional[str] = None
    lastSeenAt: Optional[datetime] = None
    status: str  # online|offline|stale
    createdAt: datetime

    model_config = {"from_attributes": True}
