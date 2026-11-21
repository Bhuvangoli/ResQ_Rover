"""Alert listing and acknowledgement endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.database import get_db
from app.realtime.connection_manager import manager
from app.schemas.alert import AlertAcknowledge
from app.services.alert_service import acknowledge_alert, list_alerts

router = APIRouter()


@router.get("/alerts")
async def get_alerts(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    alerts = list_alerts(db, status=status)
    return {"data": [_alert_dict(a) for a in alerts]}


@router.post("/alerts/{alert_id}/acknowledge")
async def ack_alert(
    alert_id: str,
    body: AlertAcknowledge = AlertAcknowledge(),
    db: Session = Depends(get_db),
):
    alert = acknowledge_alert(db, alert_id, operator_name=body.operatorName)
    if alert is None:
        raise NotFoundError("Alert", alert_id)

    await manager.broadcast("alert:updated", {
        "id": alert.id,
        "status": alert.status,
        "acknowledgedAt": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "acknowledgedBy": alert.acknowledged_by,
    })

    return {"data": _alert_dict(alert)}


def _alert_dict(a) -> dict:
    return {
        "id": a.id,
        "missionId": a.mission_id,
        "deviceId": a.device_id,
        "ruleId": a.rule_id,
        "severity": a.severity,
        "title": a.title,
        "description": a.description,
        "triggerValueJson": a.trigger_value_json,
        "thresholdJson": a.threshold_json,
        "status": a.status,
        "createdAt": a.created_at.isoformat(),
        "acknowledgedAt": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        "acknowledgedBy": a.acknowledged_by,
        "resolvedAt": a.resolved_at.isoformat() if a.resolved_at else None,
    }
