"""Blueprint upload and retrieval service."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.models.blueprint import Blueprint

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg"}
ALLOWED_SIGNATURES = {
    b"\x89PNG": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}
MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


def _detect_mime(data: bytes) -> Optional[str]:
    for sig, mime in ALLOWED_SIGNATURES.items():
        if data[:len(sig)] == sig:
            return mime
    return None


def _safe_storage_path(storage_root: Path, relative: str) -> Path:
    p = (storage_root / relative).resolve()
    if not str(p).startswith(str(storage_root.resolve())):
        raise ValueError("Path traversal detected.")
    return p


def upload_blueprint(
    db: Session,
    name: str,
    original_filename: str,
    content: bytes,
    building_id: Optional[str] = None,
) -> Blueprint:
    if len(content) > MAX_SIZE_BYTES:
        raise ValueError(f"File exceeds maximum size of {MAX_SIZE_BYTES // 1024 // 1024} MB.")

    detected_mime = _detect_mime(content)
    if detected_mime is None or detected_mime not in ALLOWED_MIME_TYPES:
        raise ValueError("Only PNG and JPEG images are supported.")

    ext = ".png" if detected_mime == "image/png" else ".jpg"
    server_filename = f"{uuid.uuid4()}{ext}"
    storage_key = f"blueprints/{server_filename}"

    bp_dir = settings.storage_path / "blueprints"
    bp_dir.mkdir(parents=True, exist_ok=True)
    dest = _safe_storage_path(settings.storage_path, storage_key)
    dest.write_bytes(content)

    bp = Blueprint(
        name=name,
        file_name=original_filename,
        storage_key=storage_key,
        mime_type=detected_mime,
        building_id=building_id,
    )
    db.add(bp)
    db.commit()
    db.refresh(bp)
    return bp


def list_blueprints(db: Session) -> List[Blueprint]:
    return list(db.execute(select(Blueprint).order_by(Blueprint.created_at.desc())).scalars().all())


def get_blueprint_path(storage_key: str) -> Path:
    return _safe_storage_path(settings.storage_path, storage_key)
