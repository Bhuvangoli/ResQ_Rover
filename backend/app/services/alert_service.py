"""Alert rule evaluation and lifecycle service."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert

# ---------------------------------------------------------------------------
# Configurable alert rules (defaults – can be overridden via env/config later)
# ---------------------------------------------------------------------------
DEFAULT_RULES = [
    {
        "id": "temp_high",
        "name": "High Temperature",
        "field": "temperature_c",
        "operator": "gt",
        "threshold": 60.0,
        "severity": "warning",
        "enabled": True,
        "description": "Temperature exceeds 60 °C",
    },
    {
        "id": "temp_critical",
        "name": "Critical Temperature",
        "field": "temperature_c",
        "operator": "gt",
        "threshold": 80.0,
        "severity": "critical",
        "enabled": True,
        "description": "Temperature exceeds 80 °C",
    },
    {
        "id": "gas_elevated",
        "name": "Elevated Gas/Smoke (MQ-2)",
        "field": "mq2_raw",
        "operator": "gt",
        "threshold": 2000,
        "severity": "warning",
        "enabled": True,
        "description": "MQ-2 raw ADC reading exceeds 2000 (relative threshold)",
    },
    {
        "id": "gas_critical",
        "name": "Critical Gas/Smoke (MQ-2)",
        "field": "mq2_raw",
        "operator": "gt",
        "threshold": 3500,
        "severity": "critical",
        "enabled": True,
        "description": "MQ-2 raw ADC reading exceeds 3500 (relative threshold)",
    },
    {
        "id": "obstacle_close",
        "name": "Obstacle Detected",
        "field": "distance_cm",
        "operator": "lt",
        "threshold": 20.0,
        "severity": "warning",
        "enabled": True,
        "description": "Distance sensor reads below 20 cm",
    },
    {
        "id": "battery_low",
        "name": "Low Battery",
        "field": "battery_percent",
        "operator": "lt",
        "threshold": 20.0,
        "severity": "warning",
        "enabled": True,
        "description": "Battery below 20%",
    },
    {
        "id": "pir_motion",
        "name": "PIR Motion Event",
        "field": "motion_detected",
        "operator": "eq",
        "threshold": True,
        "severity": "info",
        "enabled": True,
        "description": "PIR sensor triggered (motion event – not human detection)",
    },
]

RULES: Dict[str, Dict] = {r["id"]: r for r in DEFAULT_RULES}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _evaluate_rule(rule: Dict, value: Any) -> bool:
    op = rule["operator"]
    threshold = rule["threshold"]
    if op == "gt":
        return value is not None and value > threshold
    if op == "lt":
        return value is not None and value < threshold
    if op == "eq":
        return value is not None and value == threshold
    if op == "gte":
        return value is not None and value >= threshold
    if op == "lte":
        return value is not None and value <= threshold
    return False


def _field_value(telemetry_dict: Dict, field: str) -> Any:
    return telemetry_dict.get(field)


def evaluate_and_store(
    db: Session,
    telemetry: Dict[str, Any],
    mission_id: Optional[str],
    device_id: str,
) -> List[Alert]:
    """Evaluate all enabled rules against telemetry and store new alerts."""
    new_alerts: List[Alert] = []

    for rule in RULES.values():
        if not rule.get("enabled"):
            continue

        value = _field_value(telemetry, rule["field"])
        if not _evaluate_rule(rule, value):
            continue

        # Deduplication: if same rule+device already has an active alert, skip
        existing = db.execute(
            select(Alert).where(
                Alert.rule_id == rule["id"],
                Alert.device_id == device_id,
                Alert.status == "active",
            )
        ).scalar_one_or_none()

        if existing:
            continue

        alert = Alert(
            mission_id=mission_id,
            device_id=device_id,
            rule_id=rule["id"],
            severity=rule["severity"],
            title=rule["name"],
            description=rule["description"],
            trigger_value_json=json.dumps({"value": value, "field": rule["field"]}),
            threshold_json=json.dumps({"threshold": rule["threshold"], "operator": rule["operator"]}),
            status="active",
        )
        db.add(alert)
        new_alerts.append(alert)

    if new_alerts:
        db.commit()
        for a in new_alerts:
            db.refresh(a)

    return new_alerts


def list_alerts(db: Session, status: Optional[str] = None) -> List[Alert]:
    q = select(Alert).order_by(Alert.created_at.desc())
    if status:
        q = q.where(Alert.status == status)
    return list(db.execute(q).scalars().all())


def acknowledge_alert(
    db: Session, alert_id: str, operator_name: Optional[str] = None
) -> Optional[Alert]:
    alert = db.execute(select(Alert).where(Alert.id == alert_id)).scalar_one_or_none()
    if alert is None:
        return None
    alert.status = "acknowledged"
    alert.acknowledged_at = _now()
    alert.acknowledged_by = operator_name
    db.commit()
    db.refresh(alert)
    return alert


def auto_resolve_alerts(db: Session, device_id: str, telemetry: Dict[str, Any]) -> List[Alert]:
    """Resolve active alerts whose condition no longer holds."""
    resolved = []
    active_alerts = db.execute(
        select(Alert).where(Alert.device_id == device_id, Alert.status == "active")
    ).scalars().all()

    for alert in active_alerts:
        rule = RULES.get(alert.rule_id)
        if rule is None:
            continue
        value = _field_value(telemetry, rule["field"])
        if value is not None and not _evaluate_rule(rule, value):
            alert.status = "resolved"
            alert.resolved_at = _now()
            resolved.append(alert)

    if resolved:
        db.commit()

    return resolved
