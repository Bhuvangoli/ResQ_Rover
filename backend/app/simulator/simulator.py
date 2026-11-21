"""
Hardware simulator — generates realistic demo telemetry.

All data is clearly labeled as SIMULATED.
Sends data through the same telemetry service as real hardware.
"""
from __future__ import annotations

import asyncio
import math
import random
from datetime import datetime, timezone
from typing import Optional

from app.core.logging_config import logger
from app.core.settings import settings

_running = False
_sequence = 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_reading(step: int) -> dict:
    """Generate one simulated telemetry reading with plausible variation."""
    t = step * 0.1
    base_temp = 28.0 + 15.0 * abs(math.sin(t * 0.3))
    temperature_c = round(base_temp + random.gauss(0, 1.5), 2)

    base_mq2 = 400 + 300 * abs(math.sin(t * 0.2))
    mq2_raw = max(0, int(base_mq2 + random.gauss(0, 50)))

    base_dist = 80.0 + 60.0 * abs(math.cos(t * 0.4))
    distance_cm = round(max(5.0, base_dist + random.gauss(0, 5)), 1)

    motion = random.random() < 0.08  # ~8% chance per reading

    battery = max(5.0, min(100.0, 85.0 - step * 0.03 + random.gauss(0, 0.5)))

    rssi = round(-55 + random.gauss(0, 8), 1)

    return {
        "deviceId": "rover-01",
        "timestamp": _now_iso(),
        "sequence": step,
        "temperatureC": temperature_c,
        "mq2Raw": mq2_raw,
        "distanceCm": distance_cm,
        "motionDetected": motion,
        "batteryPercent": round(battery, 1),
        "rssiDbm": rssi,
        "sensorStatus": {
            "temperature": "ok",
            "mq2": "ok",
            "distance": "ok",
            "pir": "ok",
        },
    }


async def run_simulator() -> None:
    """Background task: generate and ingest simulated telemetry at ~1 Hz."""
    global _running, _sequence

    if settings.HARDWARE_MODE != "simulation":
        logger.info("Simulator disabled (HARDWARE_MODE=%s)", settings.HARDWARE_MODE)
        return

    _running = True
    logger.info("Simulator started (HARDWARE_MODE=simulation) — data labeled SIMULATED")

    # Import here to avoid circular imports at module load time
    from app.db.database import SessionLocal
    from app.schemas.telemetry import TelemetryIngest
    from app.services.telemetry_service import ingest as ingest_telemetry
    from app.services.device_service import upsert_device
    from app.services.alert_service import evaluate_and_store, auto_resolve_alerts
    from app.services.mission_service import get_active_mission
    from app.realtime.connection_manager import manager

    while _running:
        await asyncio.sleep(2.0)  # 0.5 Hz to avoid overwhelming in demo

        try:
            reading = _generate_reading(_sequence)
            _sequence += 1

            payload = TelemetryIngest(**reading)

            with SessionLocal() as db:
                # Ensure device is tracked
                upsert_device(db, payload.deviceId)

                # Associate with active mission if one exists
                active = get_active_mission(db)
                mission_id = active.id if active else None

                record, is_dup = ingest_telemetry(db, payload, source_mode="simulated", mission_id=mission_id)

                # Evaluate alert rules
                telem_dict = {
                    "temperature_c": record.temperature_c,
                    "mq2_raw": record.mq2_raw,
                    "distance_cm": record.distance_cm,
                    "motion_detected": record.motion_detected,
                    "battery_percent": record.battery_percent,
                }
                new_alerts = evaluate_and_store(db, telem_dict, mission_id, payload.deviceId)
                auto_resolve_alerts(db, payload.deviceId, telem_dict)

                # Broadcast telemetry
                await manager.broadcast("telemetry:update", {
                    "recordId": record.id,
                    "deviceId": record.device_id,
                    "deviceTimestamp": record.device_timestamp.isoformat() if record.device_timestamp else None,
                    "receivedAt": record.received_at.isoformat(),
                    "temperatureC": record.temperature_c,
                    "mq2Raw": record.mq2_raw,
                    "distanceCm": record.distance_cm,
                    "motionDetected": record.motion_detected,
                    "batteryPercent": record.battery_percent,
                    "rssiDbm": record.rssi_dbm,
                    "sourceMode": "simulated",  # Always labeled
                    "isDuplicate": is_dup,
                })

                # Broadcast new alerts
                for alert in new_alerts:
                    await manager.broadcast("alert:created", {
                        "id": alert.id,
                        "ruleId": alert.rule_id,
                        "severity": alert.severity,
                        "title": alert.title,
                        "description": alert.description,
                        "deviceId": alert.device_id,
                        "missionId": alert.mission_id,
                        "status": alert.status,
                        "createdAt": alert.created_at.isoformat(),
                        "sourceMode": "simulated",
                    })

                # Broadcast device status
                await manager.broadcast("device:status", {
                    "deviceId": payload.deviceId,
                    "status": "online",
                    "lastSeenAt": reading["timestamp"],
                    "batteryPercent": reading.get("batteryPercent"),
                    "rssiDbm": reading.get("rssiDbm"),
                    "sourceMode": "simulated",
                })

        except Exception as exc:
            logger.error("Simulator error: %s", exc, exc_info=True)


def stop_simulator() -> None:
    global _running
    _running = False
    logger.info("Simulator stopped.")
