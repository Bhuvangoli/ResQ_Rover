from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ObservationCreate(BaseModel):
    missionId: str
    blueprintId: Optional[str] = None
    type: str
    severity: Optional[str] = None
    label: str
    description: Optional[str] = None
    xNormalized: Optional[float] = None
    yNormalized: Optional[float] = None
    locationMethod: str = "manual"
    sourceEventId: Optional[str] = None


class ObservationOut(BaseModel):
    id: str
    missionId: str
    blueprintId: Optional[str] = None
    type: str
    severity: Optional[str] = None
    label: str
    description: Optional[str] = None
    xNormalized: Optional[float] = None
    yNormalized: Optional[float] = None
    locationMethod: str
    sourceEventId: Optional[str] = None
    createdAt: datetime

    model_config = {"from_attributes": True}
