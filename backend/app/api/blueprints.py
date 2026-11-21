"""Blueprint upload and listing endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.blueprint_service import list_blueprints, upload_blueprint

router = APIRouter()


def _bp_dict(b) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "fileName": b.file_name,
        "storageKey": b.storage_key,
        "mimeType": b.mime_type,
        "widthPx": b.width_px,
        "heightPx": b.height_px,
        "buildingId": b.building_id,
        "createdAt": b.created_at.isoformat(),
    }


@router.post("/blueprints", status_code=201)
async def upload_blueprint_route(
    name: str = Form(...),
    buildingId: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    bp = upload_blueprint(
        db,
        name=name,
        original_filename=file.filename or "blueprint",
        content=content,
        building_id=buildingId,
    )
    return {"data": _bp_dict(bp)}


@router.get("/blueprints")
async def get_blueprints(db: Session = Depends(get_db)):
    bps = list_blueprints(db)
    return {"data": [_bp_dict(b) for b in bps]}
