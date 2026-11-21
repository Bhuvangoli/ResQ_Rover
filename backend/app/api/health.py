"""Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import get_db
from app.core.settings import settings

router = APIRouter()


@router.get("/health")
async def health(db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "data": {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "ok" if db_ok else "error",
            "databaseNote": "In-memory SQLite — data is lost on restart.",
            "hardwareMode": settings.HARDWARE_MODE,
            "version": "1.0.0",
        }
    }
