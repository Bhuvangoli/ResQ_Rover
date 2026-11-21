from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AlertOut(BaseModel):
    id: str
    missionId: Optional[str] = None
    deviceId: Optional[str] = None
    ruleId: str
    severity: str
    title: str
    description: Optional[str] = None
    triggerValueJson: Optional[str] = None
    thresholdJson: Optional[str] = None
    status: str
    createdAt: datetime
    acknowledgedAt: Optional[datetime] = None
    acknowledgedBy: Optional[str] = None
    resolvedAt: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlertAcknowledge(BaseModel):
    operatorName: Optional[str] = None
