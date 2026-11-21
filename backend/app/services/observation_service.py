"""Observation CRUD service."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.observation import Observation
from app.schemas.observation import ObservationCreate


def create_observation(db: Session, payload: ObservationCreate) -> Observation:
    obs = Observation(
        mission_id=payload.missionId,
        blueprint_id=payload.blueprintId,
        type=payload.type,
        severity=payload.severity,
        label=payload.label,
        description=payload.description,
        x_normalized=payload.xNormalized,
        y_normalized=payload.yNormalized,
        location_method=payload.locationMethod,
        source_event_id=payload.sourceEventId,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


def list_observations(
    db: Session, mission_id: Optional[str] = None
) -> List[Observation]:
    q = select(Observation).order_by(Observation.created_at.desc())
    if mission_id:
        q = q.where(Observation.mission_id == mission_id)
    return list(db.execute(q).scalars().all())
