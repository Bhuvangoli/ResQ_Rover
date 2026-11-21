"""Mission lifecycle endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
import io
import json

from app.db.database import get_db
from app.realtime.connection_manager import manager
from app.schemas.mission import MissionCreate
from app.services.mission_service import (
    create_mission, get_mission, list_missions, start_mission, stop_mission,
)
from app.services.export_service import export_mission_csv, export_mission_json

router = APIRouter()


def _mission_dict(m) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "description": m.description,
        "buildingId": m.building_id,
        "status": m.status,
        "startedAt": m.started_at.isoformat() if m.started_at else None,
        "endedAt": m.ended_at.isoformat() if m.ended_at else None,
        "createdAt": m.created_at.isoformat(),
    }


@router.get("/missions")
async def get_missions(db: Session = Depends(get_db)):
    return {"data": [_mission_dict(m) for m in list_missions(db)]}


@router.post("/missions", status_code=201)
async def post_mission(payload: MissionCreate, db: Session = Depends(get_db)):
    m = create_mission(db, payload)
    await manager.broadcast("mission:updated", _mission_dict(m))
    return {"data": _mission_dict(m)}


@router.get("/missions/{mission_id}")
async def get_mission_detail(mission_id: str, db: Session = Depends(get_db)):
    m = get_mission(db, mission_id)
    return {"data": _mission_dict(m)}


@router.post("/missions/{mission_id}/start")
async def start_mission_route(mission_id: str, db: Session = Depends(get_db)):
    m = start_mission(db, mission_id)
    await manager.broadcast("mission:updated", _mission_dict(m))
    return {"data": _mission_dict(m)}


@router.post("/missions/{mission_id}/stop")
async def stop_mission_route(mission_id: str, db: Session = Depends(get_db)):
    m = stop_mission(db, mission_id)
    await manager.broadcast("mission:updated", _mission_dict(m))
    return {"data": _mission_dict(m)}


@router.get("/missions/{mission_id}/export")
async def export_mission(
    mission_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
):
    if format == "csv":
        content = export_mission_csv(db, mission_id)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="mission_{mission_id}.csv"'},
        )
    else:
        data = export_mission_json(db, mission_id)
        content = json.dumps(data, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="mission_{mission_id}.json"'},
        )
