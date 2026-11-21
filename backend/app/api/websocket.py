"""WebSocket endpoint."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging_config import logger
from app.realtime.connection_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients send pings if needed
            data = await websocket.receive_text()
            # Acknowledge pings
            if data == "ping":
                await websocket.send_text('{"event":"pong","data":{}}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
        manager.disconnect(websocket)
