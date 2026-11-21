from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.device_id"), nullable=False, index=True)
    mission_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("missions.id"), nullable=True, index=True)
    device_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    timestamp_source: Mapped[str] = mapped_column(String, default="device")
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mq2_raw: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    distance_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    motion_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    battery_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    battery_voltage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rssi_dbm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sensor_status_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_mode: Mapped[str] = mapped_column(String, default="real")  # real | simulated
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
