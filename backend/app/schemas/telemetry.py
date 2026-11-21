"""Pydantic schemas for telemetry ingestion and responses."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class TelemetryIngest(BaseModel):
    """Payload sent by rover/simulator to POST /api/telemetry."""

    model_config = {"populate_by_name": True}

    deviceId: str = Field(min_length=1)
    timestamp: Optional[datetime] = None
    sequence: Optional[int] = Field(default=None, ge=0)
    temperatureC: Optional[float] = None
    mq2Raw: Optional[int] = Field(default=None, ge=0)
    distanceCm: Optional[float] = Field(default=None, ge=0)
    motionDetected: Optional[bool] = None
    batteryPercent: Optional[float] = Field(default=None, ge=0, le=100)
    batteryVoltage: Optional[float] = Field(default=None, ge=0)
    rssiDbm: Optional[float] = None
    sensorStatus: Optional[Dict[str, Any]] = None

    @field_validator("deviceId")
    @classmethod
    def device_id_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("deviceId must not be empty")
        return v.strip()


class TelemetryIngestResponse(BaseModel):
    accepted: bool
    recordId: str
    serverTime: datetime
    timestampSource: str
    isDuplicate: bool = False


class TelemetryRecord(BaseModel):
    id: str
    deviceId: str
    missionId: Optional[str] = None
    deviceTimestamp: Optional[datetime] = None
    receivedAt: datetime
    timestampSource: str
    sequence: Optional[int] = None
    temperatureC: Optional[float] = None
    mq2Raw: Optional[int] = None
    distanceCm: Optional[float] = None
    motionDetected: Optional[bool] = None
    batteryPercent: Optional[float] = None
    batteryVoltage: Optional[float] = None
    rssiDbm: Optional[float] = None
    sourceMode: str
    isDuplicate: bool

    model_config = {"from_attributes": True}
