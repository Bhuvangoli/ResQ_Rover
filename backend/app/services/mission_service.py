"""Mission lifecycle service."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.mission import Mission
from app.schemas.mission import MissionCreate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_mission(db: Session, payload: MissionCreate) -> Mission:
    mission = Mission(
        name=payload.name,
        description=payload.description,
        building_id=payload.buildingId,
        status="planned",
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


def list_missions(db: Session) -> List[Mission]:
    return list(db.execute(select(Mission).order_by(Mission.created_at.desc())).scalars().all())


def get_mission(db: Session, mission_id: str) -> Mission:
    m = db.execute(select(Mission).where(Mission.id == mission_id)).scalar_one_or_none()
    if m is None:
        raise NotFoundError("Mission", mission_id)
    return m


def get_active_mission(db: Session) -> Optional[Mission]:
    return db.execute(
        select(Mission).where(Mission.status == "active")
    ).scalar_one_or_none()


def start_mission(db: Session, mission_id: str) -> Mission:
    mission = get_mission(db, mission_id)

    # Prevent multiple active missions
    active = get_active_mission(db)
    if active and active.id != mission_id:
        raise ConflictError(f"Mission '{active.name}' (id={active.id}) is already active.")

    if mission.status == "active":
        raise ConflictError("Mission is already active.")
    if mission.status in ("completed", "aborted"):
        raise ConflictError(f"Mission is already {mission.status}.")

    mission.status = "active"
    mission.started_at = _now()
    db.commit()
    db.refresh(mission)
    return mission


def stop_mission(db: Session, mission_id: str, aborted: bool = False) -> Mission:
    mission = get_mission(db, mission_id)
    if mission.status not in ("active", "planned"):
        raise ConflictError(f"Mission cannot be stopped from status '{mission.status}'.")

    mission.status = "aborted" if aborted else "completed"
    mission.ended_at = _now()
    db.commit()
    db.refresh(mission)
    return mission
