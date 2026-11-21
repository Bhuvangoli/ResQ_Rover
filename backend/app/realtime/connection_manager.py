"""FastAPI WebSocket connection manager."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Set

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.core.logging_config import logger


class ConnectionManager:
    """Manages active WebSocket client connections and broadcasts events."""

    def __init__(self, max_queue: int = 100):
        self._clients: Set[WebSocket] = set()
        self._max_queue = max_queue

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        logger.info("WebSocket client connected. Total: %d", len(self._clients))

    def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)
        logger.info("WebSocket client disconnected. Total: %d", len(self._clients))

    async def broadcast(self, event: str, data: Dict[str, Any]) -> None:
        """Broadcast a JSON event envelope to all connected clients."""
        envelope = {
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        payload = json.dumps(envelope)
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_text(payload)
            except Exception as exc:
                logger.warning("Failed to send to client, removing: %s", exc)
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)

    @property
    def client_count(self) -> int:
        return len(self._clients)


# Singleton instance
manager = ConnectionManager()
