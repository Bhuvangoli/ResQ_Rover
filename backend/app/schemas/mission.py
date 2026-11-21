from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MissionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    buildingId: Optional[str] = None


class MissionOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    buildingId: Optional[str] = None
    status: str
    startedAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    createdAt: datetime

    model_config = {"from_attributes": True}
