"""Observation endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.realtime.connection_manager import manager
from app.schemas.observation import ObservationCreate
from app.services.observation_service import create_observation, list_observations

router = APIRouter()


def _obs_dict(o) -> dict:
    return {
        "id": o.id,
        "missionId": o.mission_id,
        "blueprintId": o.blueprint_id,
        "type": o.type,
        "severity": o.severity,
        "label": o.label,
        "description": o.description,
        "xNormalized": o.x_normalized,
        "yNormalized": o.y_normalized,
        "locationMethod": o.location_method,
        "sourceEventId": o.source_event_id,
        "createdAt": o.created_at.isoformat(),
    }


@router.post("/observations", status_code=201)
async def post_observation(payload: ObservationCreate, db: Session = Depends(get_db)):
    obs = create_observation(db, payload)
    await manager.broadcast("observation:created", _obs_dict(obs))
    return {"data": _obs_dict(obs)}


@router.get("/observations")
async def get_observations(
    missionId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    obs = list_observations(db, mission_id=missionId)
    return {"data": [_obs_dict(o) for o in obs]}
