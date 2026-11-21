"""
Backend API tests using FastAPI TestClient.
Tests: health, telemetry ingestion/validation, missions, alerts, DB visibility.
"""
import json
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import os
    os.environ["HARDWARE_MODE"] = "simulation"
    os.environ["CORS_ORIGINS"] = "http://localhost:5173"

    from app.main import app
    from app.db.database import init_db
    init_db()

    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "ok"
    assert data["database"] == "ok"


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
def test_dashboard(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    assert "data" in r.json()


# ---------------------------------------------------------------------------
# Telemetry: valid ingestion
# ---------------------------------------------------------------------------
def test_telemetry_ingest_valid(client):
    payload = {
        "deviceId": "test-rover-01",
        "temperatureC": 42.5,
        "mq2Raw": 1850,
        "distanceCm": 120.0,
        "motionDetected": False,
        "batteryPercent": 78.0,
    }
    r = client.post("/api/telemetry", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["accepted"] is True
    assert body["recordId"]
    assert body["timestampSource"] == "server_received"


# ---------------------------------------------------------------------------
# Telemetry: invalid payload
# ---------------------------------------------------------------------------
def test_telemetry_ingest_missing_device_id(client):
    payload = {"temperatureC": 30.0}
    r = client.post("/api/telemetry", json=payload)
    assert r.status_code == 422


def test_telemetry_ingest_empty_device_id(client):
    payload = {"deviceId": "   "}
    r = client.post("/api/telemetry", json=payload)
    assert r.status_code == 422


def test_telemetry_ingest_invalid_battery(client):
    payload = {"deviceId": "test-rover-01", "batteryPercent": 150}
    r = client.post("/api/telemetry", json=payload)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Telemetry: duplicate sequence detection
# ---------------------------------------------------------------------------
def test_telemetry_duplicate_sequence(client):
    payload = {"deviceId": "test-rover-dup", "sequence": 999, "temperatureC": 30.0}
    r1 = client.post("/api/telemetry", json=payload)
    assert r1.status_code == 201
    assert r1.json()["isDuplicate"] is False

    r2 = client.post("/api/telemetry", json=payload)
    assert r2.status_code == 201
    assert r2.json()["isDuplicate"] is True


# ---------------------------------------------------------------------------
# In-memory DB cross-request visibility
# ---------------------------------------------------------------------------
def test_db_cross_request_visibility(client):
    """Records written in one request must be visible in a subsequent request."""
    payload = {"deviceId": "test-db-visibility", "temperatureC": 55.0}
    r1 = client.post("/api/telemetry", json=payload)
    assert r1.status_code == 201

    r2 = client.get("/api/telemetry/latest?deviceId=test-db-visibility")
    assert r2.status_code == 200
    items = r2.json()["data"]
    assert any(item["deviceId"] == "test-db-visibility" for item in items)


# ---------------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------------
def test_devices_list(client):
    client.post("/api/telemetry", json={"deviceId": "test-device-list"})
    r = client.get("/api/devices")
    assert r.status_code == 200
    data = r.json()["data"]
    ids = [d["deviceId"] for d in data]
    assert "test-device-list" in ids


# ---------------------------------------------------------------------------
# Missions: lifecycle
# ---------------------------------------------------------------------------
def test_mission_lifecycle(client):
    # Create
    r = client.post("/api/missions", json={"name": "Test Mission Alpha", "description": "Integration test"})
    assert r.status_code == 201
    mid = r.json()["data"]["id"]

    # List
    r2 = client.get("/api/missions")
    assert r2.status_code == 200
    ids = [m["id"] for m in r2.json()["data"]]
    assert mid in ids

    # Detail
    r3 = client.get(f"/api/missions/{mid}")
    assert r3.status_code == 200

    # Start
    r4 = client.post(f"/api/missions/{mid}/start")
    assert r4.status_code == 200
    assert r4.json()["data"]["status"] == "active"

    # Stop
    r5 = client.post(f"/api/missions/{mid}/stop")
    assert r5.status_code == 200
    assert r5.json()["data"]["status"] == "completed"


def test_mission_not_found(client):
    r = client.get("/api/missions/does-not-exist")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
def test_alert_created_by_high_temp(client):
    payload = {"deviceId": "alert-test-rover", "temperatureC": 85.0}
    client.post("/api/telemetry", json=payload)

    r = client.get("/api/alerts?status=active")
    assert r.status_code == 200
    alerts = r.json()["data"]
    assert any(a["ruleId"] == "temp_critical" and a["deviceId"] == "alert-test-rover" for a in alerts)


def test_alert_acknowledgement(client):
    payload = {"deviceId": "ack-test-rover", "temperatureC": 85.0}
    client.post("/api/telemetry", json=payload)

    r = client.get("/api/alerts?status=active")
    alerts = r.json()["data"]
    rover_alerts = [a for a in alerts if a["deviceId"] == "ack-test-rover"]
    assert rover_alerts

    alert_id = rover_alerts[0]["id"]
    r2 = client.post(f"/api/alerts/{alert_id}/acknowledge", json={"operatorName": "Test Operator"})
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "acknowledged"
    assert r2.json()["data"]["acknowledgedBy"] == "Test Operator"


# ---------------------------------------------------------------------------
# Telemetry history
# ---------------------------------------------------------------------------
def test_telemetry_history(client):
    for i in range(5):
        client.post("/api/telemetry", json={"deviceId": "history-test", "temperatureC": float(20 + i)})

    r = client.get("/api/telemetry/history?deviceId=history-test&limit=10")
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 5


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------
def test_observation_lifecycle(client):
    # Create a mission first
    mr = client.post("/api/missions", json={"name": "Obs Mission"})
    mid = mr.json()["data"]["id"]

    obs_payload = {
        "missionId": mid,
        "type": "gas_smoke",
        "label": "Elevated smoke near exit",
        "locationMethod": "manual",
    }
    r = client.post("/api/observations", json=obs_payload)
    assert r.status_code == 201
    obs = r.json()["data"]
    assert obs["missionId"] == mid
    assert obs["type"] == "gas_smoke"

    # List filtered
    r2 = client.get(f"/api/observations?missionId={mid}")
    assert r2.status_code == 200
    assert len(r2.json()["data"]) >= 1


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def test_mission_export_json(client):
    mr = client.post("/api/missions", json={"name": "Export Test Mission"})
    mid = mr.json()["data"]["id"]
    client.post(f"/api/missions/{mid}/start")
    client.post("/api/telemetry", json={"deviceId": "export-rover", "temperatureC": 30.0})
    client.post(f"/api/missions/{mid}/stop")

    r = client.get(f"/api/missions/{mid}/export?format=json")
    assert r.status_code == 200


def test_mission_export_csv(client):
    mr = client.post("/api/missions", json={"name": "CSV Export Test"})
    mid = mr.json()["data"]["id"]

    r = client.get(f"/api/missions/{mid}/export?format=csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
