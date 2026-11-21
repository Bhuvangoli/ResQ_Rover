from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(String, ForeignKey("missions.id"), nullable=False, index=True)
    blueprint_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("blueprints.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    x_normalized: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y_normalized: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_method: Mapped[str] = mapped_column(String, default="manual")
    source_event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
